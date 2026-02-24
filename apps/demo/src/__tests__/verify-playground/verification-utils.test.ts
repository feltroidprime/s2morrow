/**
 * Unit tests for verification utility functions.
 *
 * RED phase: these tests fail until verification-utils.ts is implemented.
 *
 * Coverage:
 * - bytesToHex: browser-safe Uint8Array → hex (no Buffer dependency)
 * - truncateHex: passthrough for short strings, head...tail for long strings
 * - getVerificationDisabledState: disabled-state derivation from atom values
 */

import { describe, it, expect } from "bun:test"
import { Option } from "effect"
import type { FalconKeypair, VerificationStep } from "../../services/types"
import {
  bytesToHex,
  truncateHex,
  getVerificationDisabledState,
} from "../../components/interactive/verification-utils"

// ─── bytesToHex ──────────────────────────────────────────────────────────────

describe("bytesToHex", () => {
  it("converts empty Uint8Array to empty string", () => {
    expect(bytesToHex(new Uint8Array(0))).toBe("")
  })

  it("converts single byte 0xff to 'ff'", () => {
    expect(bytesToHex(new Uint8Array([0xff]))).toBe("ff")
  })

  it("converts single byte 0x00 to '00'", () => {
    expect(bytesToHex(new Uint8Array([0x00]))).toBe("00")
  })

  it("converts multiple bytes to lowercase hex string", () => {
    expect(bytesToHex(new Uint8Array([0x01, 0xab, 0xcd]))).toBe("01abcd")
  })

  it("is browser-safe — no Buffer dependency (dead beef test)", () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    expect(bytesToHex(bytes)).toBe("deadbeef")
  })

  it("pads single-hex-digit bytes with leading zero", () => {
    const bytes = new Uint8Array([0x0f, 0x10])
    expect(bytesToHex(bytes)).toBe("0f10")
  })
})

// ─── truncateHex ─────────────────────────────────────────────────────────────

describe("truncateHex", () => {
  it("returns unchanged string when shorter than head+tail+3", () => {
    // "0x1234" = 6 chars; head=4, tail=4 → threshold=11 → don't truncate
    expect(truncateHex("0x1234", 4, 4)).toBe("0x1234")
  })

  it("returns unchanged empty string", () => {
    expect(truncateHex("", 4, 4)).toBe("")
  })

  it("returns unchanged string at exact threshold boundary", () => {
    // "12345678" = 8 chars; head=4, tail=4 → threshold=11 → 8<=11 → don't truncate
    expect(truncateHex("12345678", 4, 4)).toBe("12345678")
  })

  it("truncates a long hex string to head...tail format", () => {
    const long = "0x" + "a".repeat(64) // 66 chars
    const result = truncateHex(long, 6, 4)
    expect(result).toContain("...")
    // First 6 chars of long = "0xaaaa" (2 + 4)
    expect(result.startsWith("0x" + "a".repeat(4))).toBe(true)
    // Last 4 chars = "aaaa"
    expect(result.endsWith("a".repeat(4))).toBe(true)
  })

  it("truncated result has format <head>...<tail>", () => {
    const value = "1234567890abcdef" // 16 chars
    const result = truncateHex(value, 4, 4) // threshold=11, 16>11 → truncate
    expect(result).toBe("1234...cdef")
  })

  it("uses exactly three dots as separator", () => {
    const long = "x".repeat(20)
    const result = truncateHex(long, 4, 4)
    const dotIndex = result.indexOf("...")
    expect(dotIndex).toBeGreaterThan(-1)
    // Only one occurrence of "..."
    expect(result.indexOf("...", dotIndex + 3)).toBe(-1)
  })
})

// ─── getVerificationDisabledState ────────────────────────────────────────────

const mockKeypair: FalconKeypair = {
  secretKey: new Uint8Array(1281),
  verifyingKey: new Uint8Array(897),
  publicKeyNtt: new Int32Array(512),
}

describe("getVerificationDisabledState", () => {
  it("canSign=false when keypair is Option.none()", () => {
    const result = getVerificationDisabledState({
      keypair: Option.none(),
      message: "hello",
      step: { step: "idle" },
    })
    expect(result.canSign).toBe(false)
  })

  it("canSign=false when message is empty string", () => {
    const result = getVerificationDisabledState({
      keypair: Option.some(mockKeypair),
      message: "",
      step: { step: "idle" },
    })
    expect(result.canSign).toBe(false)
  })

  it("canSign=false when message is whitespace only", () => {
    const result = getVerificationDisabledState({
      keypair: Option.some(mockKeypair),
      message: "   ",
      step: { step: "idle" },
    })
    expect(result.canSign).toBe(false)
  })

  it("canSign=true when keypair exists, message non-empty, and step is idle", () => {
    const result = getVerificationDisabledState({
      keypair: Option.some(mockKeypair),
      message: "test message",
      step: { step: "idle" },
    })
    expect(result.canSign).toBe(true)
  })

  it("isBusy=true and both buttons disabled while signing", () => {
    const result = getVerificationDisabledState({
      keypair: Option.some(mockKeypair),
      message: "test",
      step: { step: "signing" },
    })
    expect(result.isBusy).toBe(true)
    expect(result.canGenerate).toBe(false)
    expect(result.canSign).toBe(false)
  })

  it("isBusy=true and both buttons disabled while generating-keypair", () => {
    const result = getVerificationDisabledState({
      keypair: Option.none(),
      message: "",
      step: { step: "generating-keypair" },
    })
    expect(result.isBusy).toBe(true)
    expect(result.canGenerate).toBe(false)
    expect(result.canSign).toBe(false)
  })

  it("isBusy=true while creating-hint", () => {
    const result = getVerificationDisabledState({
      keypair: Option.some(mockKeypair),
      message: "test",
      step: { step: "creating-hint" },
    })
    expect(result.isBusy).toBe(true)
  })

  it("isBusy=true while packing", () => {
    const result = getVerificationDisabledState({
      keypair: Option.some(mockKeypair),
      message: "test",
      step: { step: "packing" },
    })
    expect(result.isBusy).toBe(true)
  })

  it("isBusy=true while verifying", () => {
    const result = getVerificationDisabledState({
      keypair: Option.some(mockKeypair),
      message: "test",
      step: { step: "verifying", substep: "ntt" },
    })
    expect(result.isBusy).toBe(true)
  })

  it("canGenerate=true when idle", () => {
    const result = getVerificationDisabledState({
      keypair: Option.none(),
      message: "",
      step: { step: "idle" },
    })
    expect(result.canGenerate).toBe(true)
    expect(result.isBusy).toBe(false)
  })

  it("isBusy=false and canGenerate=true after complete (terminal state)", () => {
    const result = getVerificationDisabledState({
      keypair: Option.some(mockKeypair),
      message: "test",
      step: { step: "complete", valid: true, durationMs: 42 },
    })
    expect(result.isBusy).toBe(false)
    expect(result.canGenerate).toBe(true)
  })

  it("isBusy=false after error (terminal state)", () => {
    const result = getVerificationDisabledState({
      keypair: Option.some(mockKeypair),
      message: "test",
      step: { step: "error", message: "boom" },
    })
    expect(result.isBusy).toBe(false)
    expect(result.canGenerate).toBe(true)
  })
})
