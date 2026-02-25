/**
 * Tests for verify-playground atom state (initial values and transitions).
 *
 * Coverage requirements:
 * - Every atom must have its initial value verified
 * - State transitions are tested via registry.set + registry.get
 */

import { describe, it, expect } from "bun:test"
import { Option } from "effect"
import { Registry } from "@effect-atom/atom"
import {
  wasmStatusAtom,
  keypairAtom,
  verificationStepAtom,
  messageAtom,
  signatureAtom,
  packedKeyAtom,
} from "../../atoms/falcon"
import type { FalconKeypair, PackedPublicKey, VerificationStep } from "../../services/types"

// Helper: create a fresh registry per test (isolated state)
function makeRegistry() {
  return Registry.make()
}

describe("wasmStatusAtom", () => {
  it("has initial value 'loading'", () => {
    const registry = makeRegistry()
    expect(registry.get(wasmStatusAtom)).toBe("loading")
  })

  it("transitions to 'ready'", () => {
    const registry = makeRegistry()
    registry.set(wasmStatusAtom, "ready")
    expect(registry.get(wasmStatusAtom)).toBe("ready")
  })

  it("transitions to 'error'", () => {
    const registry = makeRegistry()
    registry.set(wasmStatusAtom, "error")
    expect(registry.get(wasmStatusAtom)).toBe("error")
  })

  it("transitions loading → ready → error → loading", () => {
    const registry = makeRegistry()
    expect(registry.get(wasmStatusAtom)).toBe("loading")
    registry.set(wasmStatusAtom, "ready")
    expect(registry.get(wasmStatusAtom)).toBe("ready")
    registry.set(wasmStatusAtom, "error")
    expect(registry.get(wasmStatusAtom)).toBe("error")
    registry.set(wasmStatusAtom, "loading")
    expect(registry.get(wasmStatusAtom)).toBe("loading")
  })
})

describe("keypairAtom", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(keypairAtom))).toBe(true)
  })

  it("transitions to Some(keypair) after setting", () => {
    const registry = makeRegistry()
    const mockKeypair: FalconKeypair = {
      secretKey: new Uint8Array(1281),
      verifyingKey: new Uint8Array(896),
      publicKeyNtt: new Int32Array(512),
    }
    registry.set(keypairAtom, Option.some(mockKeypair))
    const val = registry.get(keypairAtom)
    expect(Option.isSome(val)).toBe(true)
    if (Option.isSome(val)) {
      expect(val.value.secretKey).toBeInstanceOf(Uint8Array)
      expect(val.value.verifyingKey).toBeInstanceOf(Uint8Array)
      expect(val.value.publicKeyNtt).toBeInstanceOf(Int32Array)
    }
  })

  it("can be reset to Option.none()", () => {
    const registry = makeRegistry()
    const mockKeypair: FalconKeypair = {
      secretKey: new Uint8Array(1281),
      verifyingKey: new Uint8Array(896),
      publicKeyNtt: new Int32Array(512),
    }
    registry.set(keypairAtom, Option.some(mockKeypair))
    expect(Option.isSome(registry.get(keypairAtom))).toBe(true)
    registry.set(keypairAtom, Option.none())
    expect(Option.isNone(registry.get(keypairAtom))).toBe(true)
  })
})

describe("verificationStepAtom", () => {
  it("has initial value { step: 'idle' }", () => {
    const registry = makeRegistry()
    const val = registry.get(verificationStepAtom)
    expect(val.step).toBe("idle")
  })

  it("transitions to generating-keypair", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, { step: "generating-keypair" })
    expect(registry.get(verificationStepAtom).step).toBe(
      "generating-keypair",
    )
  })

  it("transitions to signing", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, { step: "signing" })
    expect(registry.get(verificationStepAtom).step).toBe("signing")
  })

  it("transitions to creating-hint", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, { step: "creating-hint" })
    expect(registry.get(verificationStepAtom).step).toBe("creating-hint")
  })

  it("transitions to packing", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, { step: "packing" })
    expect(registry.get(verificationStepAtom).step).toBe("packing")
  })

  it("transitions to verifying with substep", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, {
      step: "verifying",
      substep: "ntt",
    })
    const val = registry.get(verificationStepAtom)
    expect(val.step).toBe("verifying")
    if (val.step === "verifying") {
      expect(val.substep).toBe("ntt")
    }
  })

  it("transitions to complete with result", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, {
      step: "complete",
      valid: true,
      durationMs: 42,
    })
    const val = registry.get(verificationStepAtom)
    expect(val.step).toBe("complete")
    if (val.step === "complete") {
      expect(val.valid).toBe(true)
      expect(val.durationMs).toBe(42)
    }
  })

  it("transitions to error with message", () => {
    const registry = makeRegistry()
    registry.set(verificationStepAtom, {
      step: "error",
      message: "WASM crash",
    })
    const val = registry.get(verificationStepAtom)
    expect(val.step).toBe("error")
    if (val.step === "error") {
      expect(val.message).toBe("WASM crash")
    }
  })

  it("full happy-path transition sequence", () => {
    const registry = makeRegistry()
    const steps: string[] = []
    const transitions: ReadonlyArray<VerificationStep> = [
      { step: "generating-keypair" },
      { step: "signing" },
      { step: "creating-hint" },
      { step: "packing" },
      { step: "verifying", substep: "ntt-s1" },
      { step: "complete", valid: true, durationMs: 1234 },
    ]

    // Walk through the full verification pipeline
    for (const s of transitions) {
      registry.set(verificationStepAtom, s)
      steps.push(registry.get(verificationStepAtom).step)
    }

    expect(steps).toEqual([
      "generating-keypair",
      "signing",
      "creating-hint",
      "packing",
      "verifying",
      "complete",
    ])
  })
})

describe("messageAtom", () => {
  it("has initial value empty string", () => {
    const registry = makeRegistry()
    expect(registry.get(messageAtom)).toBe("")
  })

  it("transitions to a non-empty message", () => {
    const registry = makeRegistry()
    registry.set(messageAtom, "Hello, Starknet!")
    expect(registry.get(messageAtom)).toBe("Hello, Starknet!")
  })

  it("can be cleared back to empty string", () => {
    const registry = makeRegistry()
    registry.set(messageAtom, "some message")
    registry.set(messageAtom, "")
    expect(registry.get(messageAtom)).toBe("")
  })
})

describe("signatureAtom", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(signatureAtom))).toBe(true)
  })

  it("can be set to Some(signature)", () => {
    const registry = makeRegistry()
    registry.set(signatureAtom, Option.some({
      signature: new Uint8Array(666),
      salt: new Uint8Array(40),
    }))
    const val = registry.get(signatureAtom)
    expect(Option.isSome(val)).toBe(true)
    if (Option.isSome(val)) {
      expect(val.value.signature).toBeInstanceOf(Uint8Array)
      expect(val.value.salt).toBeInstanceOf(Uint8Array)
    }
  })
})

describe("packedKeyAtom", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(packedKeyAtom))).toBe(true)
  })

  it("can be set to Some(PackedPublicKey) with 29 slots", () => {
    const registry = makeRegistry()
    const mockPacked: PackedPublicKey = {
      slots: Array.from({ length: 29 }, (_, i) =>
        `0x${i.toString(16).padStart(64, "0")}`,
      ),
    }
    registry.set(packedKeyAtom, Option.some(mockPacked))
    const val = registry.get(packedKeyAtom)
    expect(Option.isSome(val)).toBe(true)
    if (Option.isSome(val)) {
      expect(val.value.slots.length).toBe(29)
      expect(val.value.slots[0]).toMatch(/^0x/)
    }
  })

  it("can be reset to Option.none()", () => {
    const registry = makeRegistry()
    const mockPacked: PackedPublicKey = {
      slots: Array.from({ length: 29 }, (_, i) =>
        `0x${i.toString(16).padStart(64, "0")}`,
      ),
    }
    registry.set(packedKeyAtom, Option.some(mockPacked))
    expect(Option.isSome(registry.get(packedKeyAtom))).toBe(true)
    registry.set(packedKeyAtom, Option.none())
    expect(Option.isNone(registry.get(packedKeyAtom))).toBe(true)
  })
})
