import { Effect, Schema } from "effect"
import type { FalconKeypair, FalconKeyFile, PackedPublicKey } from "./types"

const Q = 12289

export class KeyFileParseError extends Schema.TaggedError<KeyFileParseError>()(
  "KeyFileParseError",
  { message: Schema.String },
) {}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function exportKeyFile(
  keypair: FalconKeypair,
  packedPublicKey: PackedPublicKey,
  address?: string | null,
): string {
  const file: FalconKeyFile = {
    version: 1,
    algorithm: "falcon-512",
    secretKey: "0x" + bytesToHex(keypair.secretKey),
    verifyingKey: "0x" + bytesToHex(keypair.verifyingKey),
    publicKeyNtt: Array.from(keypair.publicKeyNtt),
    packedPublicKey: Array.from(packedPublicKey.slots),
    ...(address ? { address } : {}),
  }
  return JSON.stringify(file, null, 2)
}

export const parseKeyFile = Effect.fn("KeyFile.parse")(
  function* (json: string) {
    const raw = yield* Effect.try({
      try: () => JSON.parse(json) as Record<string, unknown>,
      catch: () => new KeyFileParseError({ message: "Invalid JSON" }),
    })

    if (raw.version !== 1) {
      return yield* Effect.fail(
        new KeyFileParseError({ message: `Unsupported version: ${raw.version}` }),
      )
    }
    if (raw.algorithm !== "falcon-512") {
      return yield* Effect.fail(
        new KeyFileParseError({ message: `Unsupported algorithm: ${raw.algorithm}` }),
      )
    }
    if (typeof raw.secretKey !== "string" || typeof raw.verifyingKey !== "string") {
      return yield* Effect.fail(
        new KeyFileParseError({ message: "Missing secretKey or verifyingKey" }),
      )
    }
    if (!Array.isArray(raw.publicKeyNtt) || !Array.isArray(raw.packedPublicKey)) {
      return yield* Effect.fail(
        new KeyFileParseError({ message: "Missing publicKeyNtt or packedPublicKey" }),
      )
    }

    for (const coeff of raw.publicKeyNtt as number[]) {
      if (typeof coeff !== "number" || coeff < 0 || coeff >= Q) {
        return yield* Effect.fail(
          new KeyFileParseError({
            message: `publicKeyNtt coefficient out of range: ${coeff}`,
          }),
        )
      }
    }

    const keypair: FalconKeypair = {
      secretKey: hexToBytes(raw.secretKey as string),
      verifyingKey: hexToBytes(raw.verifyingKey as string),
      publicKeyNtt: new Int32Array(raw.publicKeyNtt as number[]),
    }

    const packedPublicKey: PackedPublicKey = {
      slots: raw.packedPublicKey as string[],
    }

    return { keypair, packedPublicKey }
  },
)
