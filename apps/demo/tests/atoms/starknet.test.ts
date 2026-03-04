/**
 * Unit tests for starknet.ts atoms.
 *
 * Tests cover:
 * - Default states of deployStepAtom, deployedAddressAtom, deployTxHashAtom
 * - keepAlive = true on all starknet atoms (deployment state persists)
 * - State transitions via Registry
 * - Branded ContractAddress / TxHash payloads in DeployStep
 */

import { describe, it, expect } from "bun:test"
import { Registry } from "@effect-atom/atom"
import { Option } from "effect"

import {
  deployStepAtom,
  deployedAddressAtom,
  deployTxHashAtom,
} from "../../src/atoms/starknet"
import type { DeployStep } from "../../src/atoms/starknet"
import { ContractAddress, TxHash } from "../../src/services/types"

function makeRegistry() {
  return Registry.make()
}

// Branded test fixtures
const TEST_ADDRESS = ContractAddress.make("0xdeadbeef")
const TEST_TX_HASH = TxHash.make("0xcafe0000")
const TEST_ADDRESS_2 = ContractAddress.make("0x1234")
const TEST_TX_HASH_2 = TxHash.make("0xabcd")

// ─────────────────────────────────────────────────────────────────────────────
// keepAlive properties
// ─────────────────────────────────────────────────────────────────────────────

describe("starknet atom.keepAlive properties", () => {
  it("deployStepAtom has keepAlive = true", () => {
    expect(deployStepAtom.keepAlive).toBe(true)
  })

  it("deployedAddressAtom has keepAlive = true", () => {
    expect(deployedAddressAtom.keepAlive).toBe(true)
  })

  it("deployTxHashAtom has keepAlive = true", () => {
    expect(deployTxHashAtom.keepAlive).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deployStepAtom — default state and transitions
// ─────────────────────────────────────────────────────────────────────────────

describe("deployStepAtom defaults", () => {
  it("has initial value { step: 'idle' }", () => {
    const registry = makeRegistry()
    expect(registry.get(deployStepAtom)).toEqual({ step: "idle" })
  })

  it("accepts all valid DeployStep values", () => {
    const registry = makeRegistry()
    const steps: DeployStep[] = [
      { step: "idle" },
      { step: "generating-keypair" },
      { step: "packing" },
      { step: "computing-address" },
      { step: "awaiting-funds", address: TEST_ADDRESS_2 },
      { step: "deploying", address: TEST_ADDRESS_2 },
      { step: "deployed", address: TEST_ADDRESS_2, txHash: TEST_TX_HASH_2 },
      { step: "error", message: "Deploy failed" },
    ]
    for (const step of steps) {
      registry.set(deployStepAtom, step)
      expect(registry.get(deployStepAtom)).toEqual(step)
    }
  })

  it("full deploy flow: idle → generating-keypair → packing → computing-address → awaiting-funds → deploying → deployed", () => {
    const registry = makeRegistry()
    const addr = TEST_ADDRESS
    const txHash = TEST_TX_HASH

    registry.set(deployStepAtom, { step: "generating-keypair" })
    expect(registry.get(deployStepAtom).step).toBe("generating-keypair")

    registry.set(deployStepAtom, { step: "packing" })
    expect(registry.get(deployStepAtom).step).toBe("packing")

    registry.set(deployStepAtom, { step: "computing-address" })
    expect(registry.get(deployStepAtom).step).toBe("computing-address")

    registry.set(deployStepAtom, { step: "awaiting-funds", address: addr })
    expect(registry.get(deployStepAtom).step).toBe("awaiting-funds")

    registry.set(deployStepAtom, { step: "deploying", address: addr })
    expect(registry.get(deployStepAtom).step).toBe("deploying")

    registry.set(deployStepAtom, { step: "deployed", address: addr, txHash })
    const final = registry.get(deployStepAtom)
    expect(final.step).toBe("deployed")
    if (final.step === "deployed") {
      expect(final.txHash).toBe(txHash)
      expect(final.address).toBe(addr)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deployedAddressAtom — default state
// ─────────────────────────────────────────────────────────────────────────────

describe("deployedAddressAtom defaults", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(deployedAddressAtom))).toBe(true)
  })

  it("accepts a ContractAddress branded value", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0xdeadbeef")
    registry.set(deployedAddressAtom, Option.some(addr))
    expect(Option.isSome(registry.get(deployedAddressAtom))).toBe(true)
  })

  it("holds Option<ContractAddress> — can extract branded address", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0x1234abcd")
    registry.set(deployedAddressAtom, Option.some(addr))
    const val = registry.get(deployedAddressAtom)
    expect(Option.isSome(val)).toBe(true)
    const extracted: ContractAddress = Option.getOrThrow(val)
    expect(extracted).toBe(addr)
    expect(typeof extracted).toBe("string")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deployTxHashAtom — default state
// ─────────────────────────────────────────────────────────────────────────────

describe("deployTxHashAtom defaults", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(deployTxHashAtom))).toBe(true)
  })

  it("accepts a TxHash branded value", () => {
    const registry = makeRegistry()
    const txHash = TxHash.make("0xcafebabedeadbeef")
    registry.set(deployTxHashAtom, Option.some(txHash))
    expect(Option.isSome(registry.get(deployTxHashAtom))).toBe(true)
  })

  it("holds Option<TxHash> — can extract branded hash", () => {
    const registry = makeRegistry()
    const txHash = TxHash.make("0xcafebabe")
    registry.set(deployTxHashAtom, Option.some(txHash))
    const val = registry.get(deployTxHashAtom)
    expect(Option.isSome(val)).toBe(true)
    const extracted: TxHash = Option.getOrThrow(val)
    expect(extracted).toBe(txHash)
    expect(typeof extracted).toBe("string")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DeployStep branded payload types — type-level verification
// ─────────────────────────────────────────────────────────────────────────────

describe("DeployStep branded payload types", () => {
  it("awaiting-funds address is ContractAddress (branded string)", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7")
    registry.set(deployStepAtom, { step: "awaiting-funds", address: addr })
    const state = registry.get(deployStepAtom)
    expect(state.step).toBe("awaiting-funds")
    if (state.step === "awaiting-funds") {
      const typedAddr: ContractAddress = state.address
      expect(typedAddr).toBe(addr)
    }
  })

  it("deploying address is ContractAddress (branded string)", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7")
    registry.set(deployStepAtom, { step: "deploying", address: addr })
    const state = registry.get(deployStepAtom)
    expect(state.step).toBe("deploying")
    if (state.step === "deploying") {
      const typedAddr: ContractAddress = state.address
      expect(typedAddr).toBe(addr)
    }
  })

  it("deployed step carries ContractAddress and TxHash brands", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7")
    const txHash = TxHash.make("0x7f3e2a1b9c4d5e6f0a1b2c3d4e5f6a7b")
    registry.set(deployStepAtom, { step: "deployed", address: addr, txHash })
    const state = registry.get(deployStepAtom) as Extract<DeployStep, { step: "deployed" }>
    expect(state.step).toBe("deployed")
    const typedAddr: ContractAddress = state.address
    const typedHash: TxHash = state.txHash
    expect(typedAddr).toBe(addr)
    expect(typedHash).toBe(txHash)
  })

  it("error step carries plain string message (not branded)", () => {
    const registry = makeRegistry()
    registry.set(deployStepAtom, { step: "error", message: "Deploy failed: insufficient fee" })
    const state = registry.get(deployStepAtom)
    expect(state.step).toBe("error")
    if (state.step === "error") {
      const msg: string = state.message
      expect(msg).toContain("insufficient fee")
    }
  })

  it("subscribe fires on each branded-payload step transition", () => {
    const registry = makeRegistry()
    const steps: string[] = []
    registry.subscribe(deployStepAtom, (v) => steps.push(v.step))
    const addr = ContractAddress.make("0xdeadbeef")
    const txHash = TxHash.make("0xcafe0000")
    registry.set(deployStepAtom, { step: "generating-keypair" })
    registry.set(deployStepAtom, { step: "packing" })
    registry.set(deployStepAtom, { step: "computing-address" })
    registry.set(deployStepAtom, { step: "awaiting-funds", address: addr })
    registry.set(deployStepAtom, { step: "deploying", address: addr })
    registry.set(deployStepAtom, { step: "deployed", address: addr, txHash })
    expect(steps).toEqual([
      "generating-keypair",
      "packing",
      "computing-address",
      "awaiting-funds",
      "deploying",
      "deployed",
    ])
  })
})
