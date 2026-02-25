import { Effect, Option, Schema } from "effect"
import type { SignerInterface } from "starknet"
import { FalconService } from "@/services/FalconService"
import { StarknetService } from "@/services/StarknetService"
import { InsufficientFundsError } from "@/services/errors"
import type {
  ContractAddress,
  FalconKeypair,
  PackedPublicKey,
} from "@/services/types"

const FALCON_PUBLIC_KEY_LENGTH = 512
const FALCON_MODULUS = 12289

export class InvalidPrivateKeyError extends Schema.TaggedError<InvalidPrivateKeyError>()(
  "InvalidPrivateKeyError",
  { message: Schema.String },
) {}

export class InvalidPublicKeyNttError extends Schema.TaggedError<InvalidPublicKeyNttError>()(
  "InvalidPublicKeyNttError",
  { message: Schema.String },
) {}

export interface PreparedAccountDeploy {
  readonly privateKey: string
  readonly keypair: FalconKeypair
  readonly packedPublicKey: PackedPublicKey
  readonly address: ContractAddress
  readonly salt: string
}

export interface DeployAccountInput {
  readonly address: ContractAddress
  readonly packedPublicKey: PackedPublicKey
  readonly signer: SignerInterface
  readonly salt: string
  readonly requiredBalance: bigint
}

export const validateHexPrivateKey = Effect.fn(
  "AccountDeployPipeline.validateHexPrivateKey",
)((privateKey: string) =>
  Effect.try({
    try: () => {
      const trimmed = privateKey.trim()
      const normalized = trimmed.toLowerCase()

      if (!normalized.startsWith("0x")) {
        throw new Error("Private key must be 0x-prefixed")
      }

      const hexBody = normalized.slice(2)
      if (hexBody.length === 0 || hexBody.length > 64) {
        throw new Error("Private key must be between 1 and 32 bytes hex")
      }

      if (!/^[0-9a-f]+$/u.test(hexBody)) {
        throw new Error("Private key contains non-hex characters")
      }

      // Pad to 32 bytes for consistency (Starknet private keys may be shorter)
      return `0x${hexBody.padStart(64, "0")}`
    },
    catch: (error) =>
      new InvalidPrivateKeyError({
        message: String(error),
      }),
  }),
)

export const toUint16PublicKeyNtt = Effect.fn(
  "AccountDeployPipeline.toUint16PublicKeyNtt",
)((publicKeyNtt: Int32Array) =>
  Effect.try({
    try: () => {
      if (publicKeyNtt.length !== FALCON_PUBLIC_KEY_LENGTH) {
        throw new Error(
          `publicKeyNtt must have ${FALCON_PUBLIC_KEY_LENGTH} coefficients`,
        )
      }

      const packed = new Uint16Array(FALCON_PUBLIC_KEY_LENGTH)
      for (let i = 0; i < publicKeyNtt.length; i += 1) {
        const coeff = publicKeyNtt[i]
        if (coeff < 0 || coeff >= FALCON_MODULUS) {
          throw new Error(`publicKeyNtt coefficient out of range at index ${i}`)
        }
        packed[i] = coeff
      }

      return packed
    },
    catch: (error) =>
      new InvalidPublicKeyNttError({
        message: String(error),
      }),
  }),
)

interface PrepareAccountDeployInput {
  readonly privateKey: string
  readonly existingKeypair: Option.Option<FalconKeypair>
}

export const prepareAccountDeployEffect = Effect.fn(
  "AccountDeployPipeline.prepareAccountDeployEffect",
)(function* ({ privateKey, existingKeypair }: PrepareAccountDeployInput) {
  const normalizedPrivateKey = yield* validateHexPrivateKey(privateKey)

  const keypair = yield* Option.match(existingKeypair, {
    onNone: () => FalconService.generateKeypair(),
    onSome: (currentKeypair) => Effect.succeed(currentKeypair),
  })

  const publicKeyNtt = yield* toUint16PublicKeyNtt(keypair.publicKeyNtt)
  const packedPublicKey = yield* FalconService.packPublicKey(publicKeyNtt)
  const { address, salt } = yield* StarknetService.computeDeployAddress(packedPublicKey)

  return {
    privateKey: normalizedPrivateKey,
    keypair,
    packedPublicKey,
    address,
    salt,
  } satisfies PreparedAccountDeploy
})

export const deployAccountEffect = Effect.fn(
  "AccountDeployPipeline.deployAccountEffect",
)(function* ({
  address,
  packedPublicKey,
  signer,
  salt,
  requiredBalance,
}: DeployAccountInput) {
  const balance = yield* StarknetService.getBalance(address)

  if (balance < requiredBalance) {
    return yield* Effect.fail(
      new InsufficientFundsError({
        message: "Insufficient STRK balance. Fund the account and try again.",
        address,
        required: requiredBalance.toString(),
      }),
    )
  }

  const deployment = yield* StarknetService.deployAccount(
    packedPublicKey,
    signer,
    salt,
  )

  return deployment
})
