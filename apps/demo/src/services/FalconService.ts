import { Effect } from "effect"
import { WasmRuntime } from "./WasmRuntime"
import {
  KeygenError,
  SigningError,
  HintGenerationError,
  PackingError,
  VerificationError,
} from "./errors"
import type {
  FalconKeypair,
  FalconSignatureResult,
  PackedPublicKey,
} from "./types"

// ---------------------------------------------------------------------------
// VK byte deserialization
// ---------------------------------------------------------------------------

/**
 * Deserialize a Falcon-512 verifying key (897 bytes) into 512 NTT-domain
 * coefficients stored as an Int32Array.
 *
 * Format (falcon-rs encoding.rs):
 *   - Byte 0:      1-byte header (falcon algorithm/degree tag) — SKIPPED
 *   - Bytes 1-896: 512 coefficients x 14 bits each, packed LSB-first
 *
 * Algorithm: maintains a bit-buffer, loading bytes from the input one at a
 * time and extracting 14-bit windows.
 *
 * Throws on invalid input (too few bytes, or any coefficient >= Q=12289).
 */
function parsePublicKeyNttBytes(vkBytes: Uint8Array): Int32Array {
  const Q = 12289
  const N = 512
  const BITS_PER_COEFF = 14
  const DATA_BYTES = (N * BITS_PER_COEFF) / 8 // 896

  // Byte 0 is the Falcon header tag (e.g. 0x09 for Falcon-512).
  // The 896 bytes of coefficient data start at index 1.
  if (vkBytes.length < 1 + DATA_BYTES) {
    throw new Error(
      `VK too short: expected at least ${1 + DATA_BYTES} bytes, got ${vkBytes.length}`,
    )
  }

  const coeffs = new Int32Array(N)
  const mask = (1 << BITS_PER_COEFF) - 1 // 0x3FFF

  let bitBuffer = 0
  let bitsInBuffer = 0
  let byteIndex = 1 // skip header byte

  for (let i = 0; i < N; i++) {
    while (bitsInBuffer < BITS_PER_COEFF) {
      bitBuffer |= vkBytes[byteIndex++] << bitsInBuffer
      bitsInBuffer += 8
    }
    const coeff = bitBuffer & mask
    bitBuffer >>= BITS_PER_COEFF
    bitsInBuffer -= BITS_PER_COEFF

    if (coeff >= Q) {
      throw new Error(
        `Invalid VK coefficient ${coeff} at index ${i} (must be < ${Q})`,
      )
    }
    coeffs[i] = coeff
  }

  return coeffs
}

// ---------------------------------------------------------------------------
// FalconService
// ---------------------------------------------------------------------------

export class FalconService extends Effect.Service<FalconService>()(
  "FalconService",
  {
    accessors: true,
    // No pre-bundled dependencies: callers must provide WasmRuntime via Layer.
    // This enables unit tests to inject a mock WasmRuntime without the live
    // loader trying to fetch /wasm/falcon_rs.js at import time.
    effect: Effect.gen(function* () {
      const wasm = yield* WasmRuntime

      const generateKeypair = Effect.fn("Falcon.generateKeypair")(
        function* (seed?: Uint8Array) {
          const s =
            seed ?? crypto.getRandomValues(new Uint8Array(32))
          const result = yield* Effect.try({
            try: () => wasm.keygen(s),
            catch: (error) =>
              new KeygenError({ message: String(error) }),
          })
          const publicKeyNtt = yield* Effect.try({
            try: () => parsePublicKeyNttBytes(result.vk),
            catch: (error) =>
              new KeygenError({ message: String(error) }),
          })
          return {
            secretKey: result.sk,
            verifyingKey: result.vk,
            publicKeyNtt,
          } satisfies FalconKeypair
        },
      )

      const sign = Effect.fn("Falcon.sign")(
        function* (
          secretKey: Uint8Array,
          message: Uint8Array,
        ) {
          const result = yield* Effect.try({
            try: () =>
              wasm.sign(secretKey, message, new Uint8Array(0)),
            catch: (error) =>
              new SigningError({ message: String(error) }),
          })
          return result satisfies FalconSignatureResult
        },
      )

      const verify = Effect.fn("Falcon.verify")(
        function* (
          verifyingKey: Uint8Array,
          message: Uint8Array,
          signature: Uint8Array,
        ) {
          return yield* Effect.try({
            try: () => wasm.verify(verifyingKey, message, signature),
            catch: (error) =>
              new VerificationError({
                message: String(error),
                step: "verify",
              }),
          })
        },
      )

      const createHint = Effect.fn("Falcon.createHint")(
        function* (
          s1: Int32Array,
          pkNtt: Int32Array,
        ) {
          return yield* Effect.try({
            try: () => wasm.create_verification_hint(s1, pkNtt),
            catch: (error) =>
              new HintGenerationError({ message: String(error) }),
          })
        },
      )

      const packPublicKey = Effect.fn("Falcon.packPublicKey")(
        function* (
          pkNtt: Uint16Array,
        ) {
          const slots = yield* Effect.try({
            try: () => wasm.pack_public_key_wasm(pkNtt),
            catch: (error) =>
              new PackingError({ message: String(error) }),
          })
          return { slots } satisfies PackedPublicKey
        },
      )

      const deserializePublicKeyNtt = Effect.fn(
        "Falcon.deserializePublicKeyNtt",
      )(function* (vkBytes: Uint8Array) {
        return yield* Effect.try({
          try: () => parsePublicKeyNttBytes(vkBytes),
          catch: (error) =>
            new KeygenError({ message: String(error) }),
        })
      })

      return {
        generateKeypair,
        sign,
        verify,
        createHint,
        packPublicKey,
        deserializePublicKeyNtt,
      }
    }),
  },
) {}
