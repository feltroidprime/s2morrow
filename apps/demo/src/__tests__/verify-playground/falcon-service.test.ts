/**
 * Tests for FalconService -- verify-playground category.
 *
 * Coverage requirements:
 * - Every Effect service method must have at least one success and one failure test
 * - WasmRuntime is mocked via Layer.succeed so no real WASM is needed
 */

import { describe, it, expect } from "bun:test"
import { Cause, Effect, Exit, Layer, Option } from "effect"
import { WasmRuntime } from "../../services/WasmRuntime"
import { FalconService } from "../../services/FalconService"
import type { WasmModule } from "../../services/WasmRuntime"

// ---------------------------------------------------------------------------
// Mock WASM module factories
// ---------------------------------------------------------------------------

const makeSuccessWasm = (): WasmModule => ({
  keygen: (_seed) => ({
    sk: new Uint8Array(1281).fill(1),
    vk: new Uint8Array(896).fill(2),
  }),
  sign: (_sk, _msg, _salt) => ({
    signature: new Uint8Array(666).fill(3),
    salt: new Uint8Array(40).fill(4),
  }),
  verify: (_vk, _msg, _sig) => true,
  create_verification_hint: (_s1, _pkNtt) =>
    new Uint16Array(512).fill(0),
  pack_public_key_wasm: (_pkNtt) =>
    Array.from({ length: 29 }, (_, i) => `0x${i.toString(16).padStart(64, "0")}`),
  public_key_length: () => 896,
  salt_length: () => 40,
  sign_for_starknet: (_sk, _txHash, _pkNtt) =>
    Array.from({ length: 61 }, (_, i) => `0x${i.toString(16)}`),
})

const makeFailingWasm = (): WasmModule => ({
  keygen: () => {
    throw new Error("keygen failed in WASM")
  },
  sign: () => {
    throw new Error("signing failed in WASM")
  },
  verify: () => {
    throw new Error("verification failed in WASM")
  },
  create_verification_hint: () => {
    throw new Error("hint generation failed in WASM")
  },
  pack_public_key_wasm: () => {
    throw new Error("packing failed in WASM")
  },
  public_key_length: () => 896,
  salt_length: () => 40,
  sign_for_starknet: () => {
    throw new Error("starknet signing failed in WASM")
  },
})

// Layer helpers
const makeSuccessLayer = () =>
  Layer.succeed(WasmRuntime, makeSuccessWasm())

const makeFailingLayer = () =>
  Layer.succeed(WasmRuntime, makeFailingWasm())

/** Run an effect provided with a specific WasmRuntime mock */
async function runWith<A, E>(
  effect: Effect.Effect<A, E, FalconService>,
  wasmLayer: Layer.Layer<WasmRuntime>,
): Promise<Exit.Exit<A, E>> {
  // FalconService.Default provides FalconService using its registered dependencies.
  // We override the WasmRuntime dependency via Layer.provide.
  const serviceLayer = FalconService.Default.pipe(
    Layer.provide(wasmLayer),
  )
  return Effect.runPromiseExit(effect.pipe(Effect.provide(serviceLayer)))
}

// ---------------------------------------------------------------------------
// generateKeypair
// ---------------------------------------------------------------------------

// VK mock (896 bytes, all 0x02): produces deterministic known coefficients.
// 896 data bytes = 0x02, 14-bit LSB-first unpacking produces repeating pattern:
//   coeff[0]=514, coeff[1]=2056, coeff[2]=8224, coeff[3]=128 (period 4)
const KNOWN_VK_MOCK = new Uint8Array(896).fill(2)

// VK mock that produces coefficient >= Q (12289), causing KeygenError.
// With all bytes = 0xFF: first 14 bits = 0b11111111111111 = 16383 >= 12289.
const INVALID_COEFF_VK = new Uint8Array(896).fill(0xff)

// VK mock that is too short to contain 512 x 14-bit coefficients.
const TOO_SHORT_VK = new Uint8Array(10).fill(2)

describe("FalconService.generateKeypair", () => {
  it("succeeds and returns a FalconKeypair", async () => {
    const exit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.secretKey).toBeInstanceOf(Uint8Array)
      expect(exit.value.verifyingKey).toBeInstanceOf(Uint8Array)
      expect(exit.value.publicKeyNtt).toBeInstanceOf(Int32Array)
    }
  })

  it("publicKeyNtt has length 512", async () => {
    const exit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.publicKeyNtt.length).toBe(512)
    }
  })

  it("publicKeyNtt contains non-zero deserialized coefficients (not all zeros)", async () => {
    const exit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      const ntt = exit.value.publicKeyNtt
      const hasNonZero = Array.from(ntt).some((v) => v !== 0)
      expect(hasNonZero).toBe(true)
    }
  })

  it("publicKeyNtt contains known coefficients for fill(2) VK mock", async () => {
    // VK = Uint8Array(896).fill(2): all 896 bytes are data (no header).
    // 14-bit LSB-first unpacking of repeating 0x02 bytes gives pattern:
    // coeff[0]=514, coeff[1]=2056, coeff[2]=8224, coeff[3]=128 (repeating every 4)
    const mockWasm: WasmModule = {
      ...makeSuccessWasm(),
      keygen: (_seed) => ({ sk: new Uint8Array(1281).fill(1), vk: KNOWN_VK_MOCK }),
    }
    const exit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      Layer.succeed(WasmRuntime, mockWasm),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      const ntt = exit.value.publicKeyNtt
      expect(ntt.length).toBe(512)
      expect(ntt[0]).toBe(514)
      expect(ntt[1]).toBe(2056)
      expect(ntt[2]).toBe(8224)
      expect(ntt[3]).toBe(128)
      // All coefficients must be in [0, Q) where Q = 12289
      for (let i = 0; i < 512; i++) {
        expect(ntt[i]).toBeGreaterThanOrEqual(0)
        expect(ntt[i]).toBeLessThan(12289)
      }
    }
  })

  it("fails with KeygenError when VK has out-of-range coefficients (>= Q)", async () => {
    // fill(0xFF) produces 14-bit value 16383 >= Q=12289 -> KeygenError
    const mockWasm: WasmModule = {
      ...makeSuccessWasm(),
      keygen: (_seed) => ({ sk: new Uint8Array(1281).fill(1), vk: INVALID_COEFF_VK }),
    }
    const exit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      Layer.succeed(WasmRuntime, mockWasm),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("KeygenError")
      }
    }
  })

  it("fails with KeygenError when VK bytes are too short", async () => {
    const mockWasm: WasmModule = {
      ...makeSuccessWasm(),
      keygen: (_seed) => ({ sk: new Uint8Array(1281).fill(1), vk: TOO_SHORT_VK }),
    }
    const exit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      Layer.succeed(WasmRuntime, mockWasm),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("KeygenError")
      }
    }
  })

  it("succeeds without explicit seed (uses crypto.getRandomValues)", async () => {
    const exit = await runWith(
      FalconService.generateKeypair(),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it("fails with KeygenError when WASM keygen throws", async () => {
    const exit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      makeFailingLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("KeygenError")
      }
    }
  })
})

// ---------------------------------------------------------------------------
// sign
// ---------------------------------------------------------------------------

describe("FalconService.sign", () => {
  const sk = new Uint8Array(1281).fill(1)
  const msg = new TextEncoder().encode("Hello, Falcon!")

  it("succeeds and returns a FalconSignatureResult", async () => {
    const exit = await runWith(
      FalconService.sign(sk, msg),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.signature).toBeInstanceOf(Uint8Array)
      expect(exit.value.salt).toBeInstanceOf(Uint8Array)
    }
  })

  it("fails with SigningError when WASM throws", async () => {
    const exit = await runWith(
      FalconService.sign(sk, msg),
      makeFailingLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("SigningError")
      }
    }
  })
})

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

describe("FalconService.verify", () => {
  const vk = new Uint8Array(896).fill(2)
  const msg = new TextEncoder().encode("Hello, Falcon!")
  const sig = new Uint8Array(666).fill(3)

  it("succeeds and returns true for valid signature", async () => {
    const exit = await runWith(
      FalconService.verify(vk, msg, sig),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(true)
    }
  })

  it("succeeds and returns false when mock wasm returns false", async () => {
    const falseWasm: WasmModule = {
      ...makeSuccessWasm(),
      verify: () => false,
    }
    const exit = await runWith(
      FalconService.verify(vk, msg, sig),
      Layer.succeed(WasmRuntime, falseWasm),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(false)
    }
  })

  it("fails with VerificationError when WASM throws", async () => {
    const exit = await runWith(
      FalconService.verify(vk, msg, sig),
      makeFailingLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("VerificationError")
      }
    }
  })
})

// ---------------------------------------------------------------------------
// createHint
// ---------------------------------------------------------------------------

describe("FalconService.createHint", () => {
  const s1 = new Int32Array(512).fill(1)
  const pkNtt = new Int32Array(512).fill(2)

  it("succeeds and returns a Uint16Array hint", async () => {
    const exit = await runWith(
      FalconService.createHint(s1, pkNtt),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBeInstanceOf(Uint16Array)
      expect(exit.value.length).toBe(512)
    }
  })

  it("fails with HintGenerationError when WASM throws", async () => {
    const exit = await runWith(
      FalconService.createHint(s1, pkNtt),
      makeFailingLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("HintGenerationError")
      }
    }
  })
})

// ---------------------------------------------------------------------------
// packPublicKey
// ---------------------------------------------------------------------------

describe("FalconService.packPublicKey", () => {
  const pkNtt = new Uint16Array(512).fill(100)

  it("succeeds and returns 29 felt252 hex slots", async () => {
    const exit = await runWith(
      FalconService.packPublicKey(pkNtt),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.slots.length).toBe(29)
      for (const slot of exit.value.slots) {
        expect(slot).toMatch(/^0x/)
      }
    }
  })

  it("each slot is a valid 0x-prefixed hex string", async () => {
    const exit = await runWith(
      FalconService.packPublicKey(pkNtt),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      for (const slot of exit.value.slots) {
        expect(slot).toMatch(/^0x[0-9a-fA-F]+$/)
      }
    }
  })

  it("fails with PackingError when WASM throws", async () => {
    const exit = await runWith(
      FalconService.packPublicKey(pkNtt),
      makeFailingLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("PackingError")
      }
    }
  })
})

// ---------------------------------------------------------------------------
// deserializePublicKeyNtt
// ---------------------------------------------------------------------------

describe("FalconService.deserializePublicKeyNtt", () => {
  it("succeeds with a valid all-zero 896-byte VK and returns 512 Int32Array coefficients", async () => {
    // 896 bytes: all-zero coefficient data (no header)
    // all-zero bit stream → all-zero 14-bit windows → all coefficients = 0 < Q=12289
    const validVk = new Uint8Array(896)
    const exit = await runWith(
      FalconService.deserializePublicKeyNtt(validVk),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBeInstanceOf(Int32Array)
      expect(exit.value.length).toBe(512)
      expect(exit.value.every((c) => c === 0)).toBe(true)
    }
  })

  it("fails with KeygenError when VK is too short (< 896 bytes)", async () => {
    const shortVk = new Uint8Array(10)
    const exit = await runWith(
      FalconService.deserializePublicKeyNtt(shortVk),
      makeSuccessLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("KeygenError")
      }
    }
  })

  it("fails with KeygenError when VK has out-of-range coefficients (>= Q)", async () => {
    const exit = await runWith(
      FalconService.deserializePublicKeyNtt(INVALID_COEFF_VK),
      makeSuccessLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("KeygenError")
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Error message propagation
// ---------------------------------------------------------------------------

describe("FalconService error message propagation", () => {
  it("KeygenError preserves the WASM error message", async () => {
    const mockWasm: WasmModule = {
      ...makeSuccessWasm(),
      keygen: () => {
        throw new Error("NTRU key generation failed: bad polynomial")
      },
    }
    const exit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      Layer.succeed(WasmRuntime, mockWasm),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("KeygenError")
        expect(err.value.message).toContain(
          "NTRU key generation failed: bad polynomial",
        )
      }
    }
  })

  it("SigningError preserves the WASM error message", async () => {
    const mockWasm: WasmModule = {
      ...makeSuccessWasm(),
      sign: () => {
        throw new Error("Invalid secret key: deserialization failed")
      },
    }
    const exit = await runWith(
      FalconService.sign(
        new Uint8Array(1281),
        new TextEncoder().encode("msg"),
      ),
      Layer.succeed(WasmRuntime, mockWasm),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("SigningError")
        expect(err.value.message).toContain(
          "Invalid secret key: deserialization failed",
        )
      }
    }
  })

  it("VerificationError preserves the WASM error message and step", async () => {
    const mockWasm: WasmModule = {
      ...makeSuccessWasm(),
      verify: () => {
        throw new Error("Decompression failed: invalid encoding")
      },
    }
    const exit = await runWith(
      FalconService.verify(
        new Uint8Array(896),
        new TextEncoder().encode("msg"),
        new Uint8Array(666),
      ),
      Layer.succeed(WasmRuntime, mockWasm),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("VerificationError")
        expect(err.value.message).toContain(
          "Decompression failed: invalid encoding",
        )
        expect(err.value.step).toBe("verify")
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Integration: full pipeline (keygen -> sign -> verify)
// ---------------------------------------------------------------------------

describe("FalconService full pipeline integration", () => {
  it("keygen -> sign -> verify -> true through service layer", async () => {
    const mockWasm: WasmModule = {
      ...makeSuccessWasm(),
      keygen: () => ({
        sk: new Uint8Array(1281).fill(7),
        vk: new Uint8Array(896),
      }),
      sign: () => ({
        signature: new Uint8Array(666).fill(9),
        salt: new Uint8Array(40).fill(10),
      }),
      verify: () => true,
    }
    const layer = Layer.succeed(WasmRuntime, mockWasm)

    const keypairExit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      layer,
    )
    expect(Exit.isSuccess(keypairExit)).toBe(true)
    if (!Exit.isSuccess(keypairExit)) {
      return
    }

    const message = new TextEncoder().encode("Post-quantum on Starknet!")
    const signExit = await runWith(
      FalconService.sign(keypairExit.value.secretKey, message),
      layer,
    )
    expect(Exit.isSuccess(signExit)).toBe(true)
    if (!Exit.isSuccess(signExit)) {
      return
    }

    const verifyExit = await runWith(
      FalconService.verify(
        keypairExit.value.verifyingKey,
        message,
        signExit.value.signature,
      ),
      layer,
    )
    expect(Exit.isSuccess(verifyExit)).toBe(true)
    if (Exit.isSuccess(verifyExit)) {
      expect(verifyExit.value).toBe(true)
    }
  })

  it("keygen -> sign -> verify -> false", async () => {
    let callCount = 0
    const mockWasm: WasmModule = {
      ...makeSuccessWasm(),
      keygen: () => ({
        sk: new Uint8Array(1281).fill(7),
        vk: new Uint8Array(896),
      }),
      sign: () => ({
        signature: new Uint8Array(666).fill(9),
        salt: new Uint8Array(40).fill(10),
      }),
      verify: () => {
        callCount += 1
        return false
      },
    }
    const layer = Layer.succeed(WasmRuntime, mockWasm)

    const keypairExit = await runWith(
      FalconService.generateKeypair(new Uint8Array(32)),
      layer,
    )
    expect(Exit.isSuccess(keypairExit)).toBe(true)
    if (!Exit.isSuccess(keypairExit)) {
      return
    }

    const message = new TextEncoder().encode("msg")
    const signExit = await runWith(
      FalconService.sign(keypairExit.value.secretKey, message),
      layer,
    )
    expect(Exit.isSuccess(signExit)).toBe(true)
    if (!Exit.isSuccess(signExit)) {
      return
    }

    const verifyExit = await runWith(
      FalconService.verify(
        keypairExit.value.verifyingKey,
        message,
        signExit.value.signature,
      ),
      layer,
    )
    expect(Exit.isSuccess(verifyExit)).toBe(true)
    if (Exit.isSuccess(verifyExit)) {
      expect(verifyExit.value).toBe(false)
    }
    expect(callCount).toBe(1)
  })
})
