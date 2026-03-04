/**
 * Unit tests for falcon.ts atoms.
 *
 * Tests cover:
 * - Default states of all 5 atoms
 * - keepAlive property on wasmStatusAtom and keypairAtom
 * - State transitions via Registry
 */

import { describe, it, expect } from "bun:test"
import { Registry } from "@effect-atom/atom"
import { Option } from "effect"

import {
  wasmStatusAtom,
  keypairAtom,
  signatureAtom,
  verificationStepAtom,
  messageAtom,
} from "../../src/atoms/falcon"
import type { FalconKeypair, FalconSignatureResult, VerificationStep } from "../../src/services/types"

function makeRegistry() {
  return Registry.make()
}

// ─────────────────────────────────────────────────────────────────────────────
// keepAlive properties — both must be true
// ─────────────────────────────────────────────────────────────────────────────

describe("atom.keepAlive properties", () => {
  it("wasmStatusAtom has keepAlive = true (persists without subscribers)", () => {
    expect(wasmStatusAtom.keepAlive).toBe(true)
  })

  it("keypairAtom has keepAlive = true (persists without subscribers)", () => {
    expect(keypairAtom.keepAlive).toBe(true)
  })

  it("signatureAtom has keepAlive = false (default, not persistent)", () => {
    expect(signatureAtom.keepAlive).toBe(false)
  })

  it("verificationStepAtom has keepAlive = false (default, not persistent)", () => {
    expect(verificationStepAtom.keepAlive).toBe(false)
  })

  it("messageAtom has keepAlive = false (default, not persistent)", () => {
    expect(messageAtom.keepAlive).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// wasmStatusAtom — default state
// ─────────────────────────────────────────────────────────────────────────────

describe("wasmStatusAtom defaults", () => {
  it("has initial value 'loading'", () => {
    const registry = makeRegistry()
    expect(registry.get(wasmStatusAtom)).toBe("loading")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// keypairAtom — default state
// ─────────────────────────────────────────────────────────────────────────────

describe("keypairAtom defaults", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(keypairAtom))).toBe(true)
  })

  it("accepts a FalconKeypair value wrapped in Option.some()", () => {
    const registry = makeRegistry()
    const mockKeypair: FalconKeypair = {
      secretKey: new Uint8Array(32),
      verifyingKey: new Uint8Array(64),
      publicKeyNtt: new Int32Array(512),
    }
    registry.set(keypairAtom, Option.some(mockKeypair))
    const val = registry.get(keypairAtom)
    expect(Option.isSome(val)).toBe(true)
    if (Option.isSome(val)) {
      expect(val.value.secretKey).toBeInstanceOf(Uint8Array)
      expect(val.value.publicKeyNtt).toBeInstanceOf(Int32Array)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// signatureAtom — default state
// ─────────────────────────────────────────────────────────────────────────────

describe("signatureAtom defaults", () => {
  it("has initial value Option.none()", () => {
    const registry = makeRegistry()
    expect(Option.isNone(registry.get(signatureAtom))).toBe(true)
  })

  it("accepts a FalconSignatureResult value", () => {
    const registry = makeRegistry()
    const mockSig: FalconSignatureResult = {
      signature: new Uint8Array(666),
      salt: new Uint8Array(40),
    }
    registry.set(signatureAtom, Option.some(mockSig))
    const val = registry.get(signatureAtom)
    expect(Option.isSome(val)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// verificationStepAtom — default state
// ─────────────────────────────────────────────────────────────────────────────

describe("verificationStepAtom defaults", () => {
  it("has initial value { step: 'idle' }", () => {
    const registry = makeRegistry()
    const val = registry.get(verificationStepAtom)
    expect(val).toEqual({ step: "idle" })
  })

  it("accepts all valid VerificationStep values", () => {
    const registry = makeRegistry()
    const steps: VerificationStep[] = [
      { step: "generating-keypair" },
      { step: "signing" },
      { step: "creating-hint" },
      { step: "packing" },
      { step: "verifying", substep: "norm-check" },
      { step: "complete", valid: true, durationMs: 500 },
      { step: "error", message: "WASM failed" },
    ]
    for (const step of steps) {
      registry.set(verificationStepAtom, step)
      expect(registry.get(verificationStepAtom)).toEqual(step)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// messageAtom — default state
// ─────────────────────────────────────────────────────────────────────────────

describe("messageAtom defaults", () => {
  it("has initial value empty string ''", () => {
    const registry = makeRegistry()
    expect(registry.get(messageAtom)).toBe("")
  })

  it("accepts any string value", () => {
    const registry = makeRegistry()
    registry.set(messageAtom, "Hello, Falcon!")
    expect(registry.get(messageAtom)).toBe("Hello, Falcon!")
  })
})
