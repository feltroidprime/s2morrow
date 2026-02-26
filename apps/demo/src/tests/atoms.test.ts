/**
 * Integration tests for Effect Atoms reactive state.
 *
 * Tests cover:
 * - wasmStatusAtom: initial value, transitions (loading → ready, loading → error)
 * - keypairAtom: initial Option.none, transition to Option.some
 * - signatureAtom: initial Option.none, transition to Option.some
 * - verificationStepAtom: initial idle, all step transitions
 * - messageAtom: initial empty string, updates
 * - deployStepAtom: initial idle, all 5-step deploy flow transitions
 * - deployedAddressAtom / deployTxHashAtom: Option transitions
 * - pipelineStepsAtom: initial 6 pending steps, status transitions
 * - pipelineActiveStepAtom: initial -1, increments
 * - pipelinePlayingAtom: initial false, toggle
 */

import { describe, it, expect, beforeEach } from "bun:test"
import { Registry } from "@effect-atom/atom"
import { Option } from "effect"

import {
  wasmStatusAtom,
  keypairAtom,
  signatureAtom,
  verificationStepAtom,
  messageAtom,
} from "../atoms/falcon"
import {
  deployStepAtom,
  deployedAddressAtom,
  deployTxHashAtom,
} from "../atoms/starknet"
import {
  pipelineStepsAtom,
  pipelineActiveStepAtom,
  pipelinePlayingAtom,
  INITIAL_PIPELINE_STEPS,
} from "../atoms/pipeline"
import {
  ContractAddress,
  TxHash,
} from "../services/types"
import type {
  FalconKeypair,
  FalconSignatureResult,
  VerificationStep,
} from "../services/types"

// Helper: create a fresh registry for each test
function makeRegistry() {
  return Registry.make()
}

// ─────────────────────────────────────────────────────────────────────────────
// wasmStatusAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("wasmStatusAtom", () => {
  it("has initial value 'loading'", () => {
    const registry = makeRegistry()
    expect(registry.get(wasmStatusAtom)).toBe("loading")
  })

  it("transitions from loading → ready", () => {
    const registry = makeRegistry()
    registry.set(wasmStatusAtom, "ready")
    expect(registry.get(wasmStatusAtom)).toBe("ready")
  })

  it("transitions from loading → error", () => {
    const registry = makeRegistry()
    registry.set(wasmStatusAtom, "error")
    expect(registry.get(wasmStatusAtom)).toBe("error")
  })

  it("transitions back to loading from ready (reset)", () => {
    const registry = makeRegistry()
    registry.set(wasmStatusAtom, "ready")
    registry.set(wasmStatusAtom, "loading")
    expect(registry.get(wasmStatusAtom)).toBe("loading")
  })

  it("subscribe fires on state change", () => {
    const registry = makeRegistry()
    const values: string[] = []
    registry.subscribe(wasmStatusAtom, (v) => values.push(v))
    registry.set(wasmStatusAtom, "ready")
    registry.set(wasmStatusAtom, "error")
    expect(values).toContain("ready")
    expect(values).toContain("error")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// keypairAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("keypairAtom", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    const val = registry.get(keypairAtom)
    expect(Option.isNone(val)).toBe(true)
  })

  it("transitions to Option.some when keypair is set", () => {
    const registry = makeRegistry()
    const mockKeypair: FalconKeypair = {
      secretKey: new Uint8Array([1, 2, 3]),
      verifyingKey: new Uint8Array([4, 5, 6]),
      publicKeyNtt: new Int32Array(512),
    }
    registry.set(keypairAtom, Option.some(mockKeypair))
    const val = registry.get(keypairAtom)
    expect(Option.isSome(val)).toBe(true)
    expect(Option.getOrThrow(val)).toBe(mockKeypair)
  })

  it("transitions back to Option.none on clear", () => {
    const registry = makeRegistry()
    const mockKeypair: FalconKeypair = {
      secretKey: new Uint8Array([1]),
      verifyingKey: new Uint8Array([2]),
      publicKeyNtt: new Int32Array(512),
    }
    registry.set(keypairAtom, Option.some(mockKeypair))
    registry.set(keypairAtom, Option.none())
    expect(Option.isNone(registry.get(keypairAtom))).toBe(true)
  })

  it("contains correct keypair data after set", () => {
    const registry = makeRegistry()
    const sk = new Uint8Array(32).fill(0xab)
    const vk = new Uint8Array(64).fill(0xcd)
    const ntt = new Int32Array(512).fill(42)
    const mockKeypair: FalconKeypair = {
      secretKey: sk,
      verifyingKey: vk,
      publicKeyNtt: ntt,
    }
    registry.set(keypairAtom, Option.some(mockKeypair))
    const val = Option.getOrThrow(registry.get(keypairAtom))
    expect(val.secretKey).toBe(sk)
    expect(val.verifyingKey).toBe(vk)
    expect(val.publicKeyNtt).toBe(ntt)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// signatureAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("signatureAtom", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(signatureAtom))).toBe(true)
  })

  it("transitions to Option.some with signature data", () => {
    const registry = makeRegistry()
    const mockSig: FalconSignatureResult = {
      signature: new Uint8Array(666).fill(0x01),
      salt: new Uint8Array(40).fill(0x02),
    }
    registry.set(signatureAtom, Option.some(mockSig))
    const val = registry.get(signatureAtom)
    expect(Option.isSome(val)).toBe(true)
    expect(Option.getOrThrow(val).signature.length).toBe(666)
    expect(Option.getOrThrow(val).salt.length).toBe(40)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// verificationStepAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("verificationStepAtom", () => {
  it("has initial value { step: 'idle' }", () => {
    const registry = makeRegistry()
    expect(registry.get(verificationStepAtom)).toEqual({ step: "idle" })
  })

  it("transitions to generating-keypair", () => {
    const registry = makeRegistry()
    const step: VerificationStep = { step: "generating-keypair" }
    registry.set(verificationStepAtom, step)
    expect(registry.get(verificationStepAtom)).toEqual(step)
  })

  it("transitions to signing", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, { step: "signing" })
    expect(registry.get(verificationStepAtom)).toEqual({ step: "signing" })
  })

  it("transitions to creating-hint", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, { step: "creating-hint" })
    expect(registry.get(verificationStepAtom)).toEqual({ step: "creating-hint" })
  })

  it("transitions to packing", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, { step: "packing" })
    expect(registry.get(verificationStepAtom)).toEqual({ step: "packing" })
  })

  it("transitions to verifying with substep", () => {
    const registry = makeRegistry()
    const step: VerificationStep = { step: "verifying", substep: "checking norm" }
    registry.set(verificationStepAtom, step)
    const val = registry.get(verificationStepAtom)
    expect(val).toEqual(step)
    expect((val as { step: "verifying"; substep: string }).substep).toBe("checking norm")
  })

  it("transitions to complete with valid=true", () => {
    const registry = makeRegistry()
    const step: VerificationStep = { step: "complete", valid: true, durationMs: 123 }
    registry.set(verificationStepAtom, step)
    const val = registry.get(verificationStepAtom)
    expect(val).toEqual(step)
    expect((val as { step: "complete"; valid: boolean; durationMs: number }).valid).toBe(true)
    expect((val as { step: "complete"; valid: boolean; durationMs: number }).durationMs).toBe(123)
  })

  it("transitions to complete with valid=false (invalid signature)", () => {
    const registry = makeRegistry()
    const step: VerificationStep = { step: "complete", valid: false, durationMs: 99 }
    registry.set(verificationStepAtom, step)
    const val = registry.get(verificationStepAtom) as { step: "complete"; valid: boolean; durationMs: number }
    expect(val.valid).toBe(false)
  })

  it("transitions to error with message", () => {
    const registry = makeRegistry()
    const step: VerificationStep = { step: "error", message: "WASM failed" }
    registry.set(verificationStepAtom, step)
    const val = registry.get(verificationStepAtom)
    expect(val).toEqual(step)
    expect((val as { step: "error"; message: string }).message).toBe("WASM failed")
  })

  it("resets to idle after error", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, { step: "error", message: "fail" })
    registry.set(verificationStepAtom, { step: "idle" })
    expect(registry.get(verificationStepAtom)).toEqual({ step: "idle" })
  })

  it("full verification flow: idle → generating-keypair → signing → verifying → complete", () => {
    const registry = makeRegistry()
    const steps: VerificationStep[] = [
      { step: "idle" },
      { step: "generating-keypair" },
      { step: "signing" },
      { step: "creating-hint" },
      { step: "packing" },
      { step: "verifying", substep: "norm check" },
      { step: "complete", valid: true, durationMs: 250 },
    ]
    for (const step of steps) {
      registry.set(verificationStepAtom, step)
      expect(registry.get(verificationStepAtom)).toEqual(step)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// messageAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("messageAtom", () => {
  it("has initial value empty string", () => {
    const registry = makeRegistry()
    expect(registry.get(messageAtom)).toBe("")
  })

  it("updates to a message string", () => {
    const registry = makeRegistry()
    registry.set(messageAtom, "Hello, Starknet!")
    expect(registry.get(messageAtom)).toBe("Hello, Starknet!")
  })

  it("clears back to empty string", () => {
    const registry = makeRegistry()
    registry.set(messageAtom, "Some message")
    registry.set(messageAtom, "")
    expect(registry.get(messageAtom)).toBe("")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deployStepAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("deployStepAtom", () => {
  it("has initial value { step: 'idle' }", () => {
    const registry = makeRegistry()
    expect(registry.get(deployStepAtom)).toEqual({ step: "idle" })
  })

  it("transitions to generating-keypair", () => {
    const registry = makeRegistry()
    registry.set(deployStepAtom, { step: "generating-keypair" })
    expect(registry.get(deployStepAtom)).toEqual({ step: "generating-keypair" })
  })

  it("transitions to packing", () => {
    const registry = makeRegistry()
    registry.set(deployStepAtom, { step: "packing" })
    expect(registry.get(deployStepAtom)).toEqual({ step: "packing" })
  })

  it("transitions to computing-address", () => {
    const registry = makeRegistry()
    registry.set(deployStepAtom, { step: "computing-address" })
    expect(registry.get(deployStepAtom)).toEqual({ step: "computing-address" })
  })

  it("transitions to awaiting-funds with address", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0x1234abcd")
    registry.set(deployStepAtom, { step: "awaiting-funds", address: addr })
    const val = registry.get(deployStepAtom)
    expect(val).toEqual({ step: "awaiting-funds", address: addr })
  })

  it("transitions to deploying with address", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0xabcd")
    registry.set(deployStepAtom, { step: "deploying", address: addr })
    expect(registry.get(deployStepAtom)).toEqual({ step: "deploying", address: addr })
  })

  it("transitions to deployed with address and txHash", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0xdeadbeef")
    const txHash = TxHash.make("0xcafe1234")
    registry.set(deployStepAtom, {
      step: "deployed",
      address: addr,
      txHash,
    })
    const val = registry.get(deployStepAtom)
    expect(val).toEqual({ step: "deployed", address: addr, txHash })
  })

  it("transitions to error with message", () => {
    const registry = makeRegistry()
    registry.set(deployStepAtom, { step: "error", message: "Insufficient funds" })
    const val = registry.get(deployStepAtom)
    expect(val).toEqual({ step: "error", message: "Insufficient funds" })
  })

  it("resets to idle after error", () => {
    const registry = makeRegistry()
    registry.set(deployStepAtom, { step: "error", message: "fail" })
    registry.set(deployStepAtom, { step: "idle" })
    expect(registry.get(deployStepAtom)).toEqual({ step: "idle" })
  })

  it("full deploy flow: idle → generating-keypair → packing → computing-address → awaiting-funds → deploying → deployed", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0xaabbccdd")
    const txHash = TxHash.make("0x11223344")

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
// deployedAddressAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("deployedAddressAtom", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(deployedAddressAtom))).toBe(true)
  })

  it("transitions to Option.some with contract address", () => {
    const registry = makeRegistry()
    const addr = ContractAddress.make("0xdeadbeef")
    registry.set(deployedAddressAtom, Option.some(addr))
    expect(Option.isSome(registry.get(deployedAddressAtom))).toBe(true)
    const value = Option.match(registry.get(deployedAddressAtom), {
      onNone: () => null,
      onSome: (current) => current,
    })
    expect(value).toBe(addr)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deployTxHashAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("deployTxHashAtom", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(deployTxHashAtom))).toBe(true)
  })

  it("transitions to Option.some with tx hash", () => {
    const registry = makeRegistry()
    const hash = TxHash.make("0xcafebabedeadbeef")
    registry.set(deployTxHashAtom, Option.some(hash))
    expect(Option.isSome(registry.get(deployTxHashAtom))).toBe(true)
    const value = Option.match(registry.get(deployTxHashAtom), {
      onNone: () => null,
      onSome: (current) => current,
    })
    expect(value).toBe(hash)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pipelineStepsAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("pipelineStepsAtom", () => {
  it("has 6 initial pipeline steps", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps).toHaveLength(6)
  })

  it("all initial steps have status 'pending'", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps.every((s) => s.status === "pending")).toBe(true)
  })

  it("initial steps have correct IDs in order", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const ids = steps.map((s) => s.id)
    expect(ids).toEqual([
      "sign-tx",
      "validate",
      "falcon-verify",
      "execute",
      "stark-proof",
      "settled",
    ])
  })

  it("falcon-verify step has 9.5M stepCount", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const verifyStep = steps.find((s) => s.id === "falcon-verify")!
    expect(verifyStep.stepCount).toBe(9500000)
  })

  it("transitions step 0 to active status", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const updated = steps.map((s, i) => ({
      ...s,
      status: (i === 0 ? "active" : "pending") as "pending" | "active" | "complete",
    }))
    registry.set(pipelineStepsAtom, updated)
    const newSteps = registry.get(pipelineStepsAtom)
    expect(newSteps[0].status).toBe("active")
    expect(newSteps[1].status).toBe("pending")
  })

  it("transitions step 0 to complete, step 1 to active", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const updated = steps.map((s, i) => ({
      ...s,
      status: (i === 0 ? "complete" : i === 1 ? "active" : "pending") as "pending" | "active" | "complete",
    }))
    registry.set(pipelineStepsAtom, updated)
    const newSteps = registry.get(pipelineStepsAtom)
    expect(newSteps[0].status).toBe("complete")
    expect(newSteps[1].status).toBe("active")
    expect(newSteps[2].status).toBe("pending")
  })

  it("transitions all steps to complete", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const updated = steps.map((s) => ({ ...s, status: "complete" as const }))
    registry.set(pipelineStepsAtom, updated)
    const newSteps = registry.get(pipelineStepsAtom)
    expect(newSteps.every((s) => s.status === "complete")).toBe(true)
  })

  it("resets all steps to pending", () => {
    const registry = makeRegistry()
    // First set some to complete
    const steps = registry.get(pipelineStepsAtom)
    registry.set(pipelineStepsAtom, steps.map((s) => ({ ...s, status: "complete" as const })))
    // Now reset
    registry.set(pipelineStepsAtom, INITIAL_PIPELINE_STEPS)
    expect(registry.get(pipelineStepsAtom).every((s) => s.status === "pending")).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pipelineActiveStepAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("pipelineActiveStepAtom", () => {
  it("has initial value -1 (no active step)", () => {
    const registry = makeRegistry()
    expect(registry.get(pipelineActiveStepAtom)).toBe(-1)
  })

  it("transitions to step 0 on play", () => {
    const registry = makeRegistry()
    registry.set(pipelineActiveStepAtom, 0)
    expect(registry.get(pipelineActiveStepAtom)).toBe(0)
  })

  it("advances through all 6 steps", () => {
    const registry = makeRegistry()
    for (let i = 0; i < 6; i++) {
      registry.set(pipelineActiveStepAtom, i)
      expect(registry.get(pipelineActiveStepAtom)).toBe(i)
    }
  })

  it("resets to -1", () => {
    const registry = makeRegistry()
    registry.set(pipelineActiveStepAtom, 3)
    registry.set(pipelineActiveStepAtom, -1)
    expect(registry.get(pipelineActiveStepAtom)).toBe(-1)
  })

  it("uses update to increment active step", () => {
    const registry = makeRegistry()
    registry.set(pipelineActiveStepAtom, 2)
    registry.update(pipelineActiveStepAtom, (prev) => prev + 1)
    expect(registry.get(pipelineActiveStepAtom)).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pipelinePlayingAtom
// ─────────────────────────────────────────────────────────────────────────────

describe("pipelinePlayingAtom", () => {
  it("has initial value false", () => {
    const registry = makeRegistry()
    expect(registry.get(pipelinePlayingAtom)).toBe(false)
  })

  it("transitions to true on play", () => {
    const registry = makeRegistry()
    registry.set(pipelinePlayingAtom, true)
    expect(registry.get(pipelinePlayingAtom)).toBe(true)
  })

  it("transitions to false on pause", () => {
    const registry = makeRegistry()
    registry.set(pipelinePlayingAtom, true)
    registry.set(pipelinePlayingAtom, false)
    expect(registry.get(pipelinePlayingAtom)).toBe(false)
  })

  it("toggle behavior via update", () => {
    const registry = makeRegistry()
    registry.update(pipelinePlayingAtom, (v) => !v)
    expect(registry.get(pipelinePlayingAtom)).toBe(true)
    registry.update(pipelinePlayingAtom, (v) => !v)
    expect(registry.get(pipelinePlayingAtom)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Registry isolation: each test gets fresh state
// ─────────────────────────────────────────────────────────────────────────────

describe("registry isolation", () => {
  it("registries are independent — mutations in one don't affect another", () => {
    const r1 = makeRegistry()
    const r2 = makeRegistry()
    r1.set(wasmStatusAtom, "ready")
    expect(r1.get(wasmStatusAtom)).toBe("ready")
    expect(r2.get(wasmStatusAtom)).toBe("loading") // r2 is fresh
  })

  it("pipeline steps are independent across registries", () => {
    const r1 = makeRegistry()
    const r2 = makeRegistry()
    const steps = r1.get(pipelineStepsAtom)
    r1.set(pipelineStepsAtom, steps.map((s) => ({ ...s, status: "complete" as const })))
    // r2 should still have all pending
    expect(r2.get(pipelineStepsAtom).every((s) => s.status === "pending")).toBe(true)
  })
})
