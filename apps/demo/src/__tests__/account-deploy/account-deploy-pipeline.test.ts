import { describe, expect, it } from "bun:test"
import { Cause, Effect, Exit, Layer, Option } from "effect"
import { RpcProvider } from "starknet"
import { FalconService } from "../../services/FalconService"
import { StarknetService } from "../../services/StarknetService"
import { ContractAddress, TxHash } from "../../services/types"
import type { FalconKeypair, PackedPublicKey } from "../../services/types"
import {
  deployAccountEffect,
  prepareAccountDeployEffect,
  toUint16PublicKeyNtt,
  validateHexPrivateKey,
} from "../../components/interactive/accountDeployPipeline"

const getFailureTag = <A, E extends { readonly _tag: string }>(
  exit: Exit.Exit<A, E>,
): string | null => {
  if (Exit.isSuccess(exit)) {
    return null
  }
  const failure = Cause.failureOption(exit.cause)
  return Option.match(failure, {
    onNone: () => null,
    onSome: (error) => error._tag,
  })
}

describe("validateHexPrivateKey", () => {
  it("accepts a valid 0x-prefixed private key", async () => {
    const exit = await Effect.runPromiseExit(
      validateHexPrivateKey(
        "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(
        "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      )
    }
  })

  it("fails when key is missing 0x prefix", async () => {
    const exit = await Effect.runPromiseExit(
      validateHexPrivateKey(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(getFailureTag(exit)).toBe("InvalidPrivateKeyError")
  })

  it("fails when key contains non-hex characters", async () => {
    const exit = await Effect.runPromiseExit(
      validateHexPrivateKey(
        "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg",
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(getFailureTag(exit)).toBe("InvalidPrivateKeyError")
  })
})

describe("toUint16PublicKeyNtt", () => {
  it("converts Int32Array coefficients into Uint16Array", async () => {
    const coeffs = new Int32Array(512).fill(0)
    coeffs[1] = 12288
    coeffs[2] = 42

    const exit = await Effect.runPromiseExit(toUint16PublicKeyNtt(coeffs))

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBeInstanceOf(Uint16Array)
      expect(exit.value[0]).toBe(0)
      expect(exit.value[1]).toBe(12288)
      expect(exit.value[2]).toBe(42)
    }
  })

  it("fails when coefficient is below range", async () => {
    const coeffs = new Int32Array(512).fill(1)
    coeffs[128] = -1

    const exit = await Effect.runPromiseExit(toUint16PublicKeyNtt(coeffs))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(getFailureTag(exit)).toBe("InvalidPublicKeyNttError")
  })

  it("fails when coefficient is >= 12289", async () => {
    const coeffs = new Int32Array(512).fill(1)
    coeffs[300] = 12289

    const exit = await Effect.runPromiseExit(toUint16PublicKeyNtt(coeffs))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(getFailureTag(exit)).toBe("InvalidPublicKeyNttError")
  })

  it("fails when coefficient array length is not 512", async () => {
    const coeffs = new Int32Array(511).fill(1)
    const exit = await Effect.runPromiseExit(toUint16PublicKeyNtt(coeffs))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(getFailureTag(exit)).toBe("InvalidPublicKeyNttError")
  })
})

const VALID_PRIVATE_KEY =
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

const MOCK_ADDRESS = ContractAddress.make(
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
)
const MOCK_TX_HASH = TxHash.make(
  "0x7f3e2a1b9c4d5e6f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d",
)

const makeKeypair = (fill: number): FalconKeypair => ({
  secretKey: new Uint8Array(1281).fill(fill),
  verifyingKey: new Uint8Array(896).fill(fill + 1),
  publicKeyNtt: new Int32Array(512).fill(fill + 2),
})

const MOCK_PACKED_PUBLIC_KEY: PackedPublicKey = {
  slots: Array.from({ length: 29 }, (_, i) => `0x${i.toString(16).padStart(64, "0")}`),
}

interface FalconLayerOptions {
  readonly generatedKeypair: FalconKeypair
  readonly packedPublicKey: PackedPublicKey
  readonly calls: { generate: number; pack: number }
}

const makeFalconLayer = (options: FalconLayerOptions) =>
  Layer.succeed(
    FalconService,
    FalconService.make({
    generateKeypair: (_seed?: Uint8Array) => {
      options.calls.generate += 1
      return Effect.succeed(options.generatedKeypair)
    },
    sign: (_secretKey: Uint8Array, _message: Uint8Array) =>
      Effect.succeed({
        signature: new Uint8Array(666),
        salt: new Uint8Array(40),
      }),
    verify: (_verifyingKey: Uint8Array, _message: Uint8Array, _signature: Uint8Array) =>
      Effect.succeed(true),
    createHint: (_s1: Int32Array, _pkNtt: Int32Array) => Effect.succeed(new Uint16Array(512)),
    packPublicKey: (_pkNtt: Uint16Array) => {
      options.calls.pack += 1
      return Effect.succeed({
        slots: Array.from(options.packedPublicKey.slots),
      })
    },
    deserializePublicKeyNtt: (_vkBytes: Uint8Array) => Effect.succeed(new Int32Array(512)),
    signForStarknet: (_sk: Uint8Array, _txHash: string, _pkNtt: Int32Array) =>
      Effect.succeed(Array.from({ length: 61 }, () => "0x0")),
    }),
  )

interface StarknetLayerOptions {
  readonly balance: bigint
  readonly calls: { compute: number; balance: number; deploy: number }
}

const makeStarknetLayer = (options: StarknetLayerOptions) =>
  Layer.succeed(
    StarknetService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {
      computeDeployAddress: (_packedPk: PackedPublicKey) => {
        options.calls.compute += 1
        return Effect.succeed({ address: MOCK_ADDRESS, salt: "0xdeadbeef" })
      },
      getBalance: (_address: string) => {
        options.calls.balance += 1
        return Effect.succeed(options.balance)
      },
      deployAccount: (_packedPk: PackedPublicKey, _privateKey: string, _salt: string) => {
        options.calls.deploy += 1
        return Effect.succeed({ txHash: MOCK_TX_HASH, address: MOCK_ADDRESS })
      },
      waitForTx: (_txHash: string) => Effect.succeed(undefined),
      provider: new RpcProvider({ nodeUrl: "http://localhost:9999" }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  )

const runPipelineEffect = <A, E>(
  effect: Effect.Effect<A, E, FalconService | StarknetService>,
  falconLayer: Layer.Layer<FalconService>,
  starknetLayer: Layer.Layer<StarknetService>,
) =>
  Effect.runPromiseExit(
    effect.pipe(Effect.provide(falconLayer), Effect.provide(starknetLayer)),
  )

describe("prepareAccountDeployEffect", () => {
  it("reuses keypair from atom state and skips key generation", async () => {
    const reusedKeypair = makeKeypair(5)
    const falconCalls = { generate: 0, pack: 0 }
    const starknetCalls = { compute: 0, balance: 0, deploy: 0 }
    const falconLayer = makeFalconLayer({
      generatedKeypair: makeKeypair(9),
      packedPublicKey: MOCK_PACKED_PUBLIC_KEY,
      calls: falconCalls,
    })
    const starknetLayer = makeStarknetLayer({ balance: 100n, calls: starknetCalls })

    const exit = await runPipelineEffect(
      prepareAccountDeployEffect({
        privateKey: VALID_PRIVATE_KEY,
        existingKeypair: Option.some(reusedKeypair),
      }),
      falconLayer,
      starknetLayer,
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.keypair).toBe(reusedKeypair)
      expect(exit.value.address).toBe(MOCK_ADDRESS)
      expect(exit.value.packedPublicKey.slots).toEqual(
        Array.from(MOCK_PACKED_PUBLIC_KEY.slots),
      )
    }
    expect(falconCalls.generate).toBe(0)
    expect(falconCalls.pack).toBe(1)
    expect(starknetCalls.compute).toBe(1)
  })

  it("generates a keypair when atom state is empty", async () => {
    const generatedKeypair = makeKeypair(11)
    const falconCalls = { generate: 0, pack: 0 }
    const starknetCalls = { compute: 0, balance: 0, deploy: 0 }
    const falconLayer = makeFalconLayer({
      generatedKeypair,
      packedPublicKey: MOCK_PACKED_PUBLIC_KEY,
      calls: falconCalls,
    })
    const starknetLayer = makeStarknetLayer({ balance: 100n, calls: starknetCalls })

    const exit = await runPipelineEffect(
      prepareAccountDeployEffect({
        privateKey: VALID_PRIVATE_KEY,
        existingKeypair: Option.none(),
      }),
      falconLayer,
      starknetLayer,
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.keypair).toEqual(generatedKeypair)
      expect(exit.value.privateKey).toBe(VALID_PRIVATE_KEY)
    }
    expect(falconCalls.generate).toBe(1)
    expect(falconCalls.pack).toBe(1)
    expect(starknetCalls.compute).toBe(1)
  })
})

describe("deployAccountEffect", () => {
  it("fails with InsufficientFundsError when balance is below required minimum", async () => {
    const falconCalls = { generate: 0, pack: 0 }
    const starknetCalls = { compute: 0, balance: 0, deploy: 0 }
    const falconLayer = makeFalconLayer({
      generatedKeypair: makeKeypair(1),
      packedPublicKey: MOCK_PACKED_PUBLIC_KEY,
      calls: falconCalls,
    })
    const starknetLayer = makeStarknetLayer({ balance: 0n, calls: starknetCalls })

    const exit = await runPipelineEffect(
      deployAccountEffect({
        address: MOCK_ADDRESS,
        packedPublicKey: MOCK_PACKED_PUBLIC_KEY,
        privateKey: VALID_PRIVATE_KEY,
        salt: "0xdeadbeef",
        requiredBalance: 1n,
      }),
      falconLayer,
      starknetLayer,
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(getFailureTag(exit)).toBe("InsufficientFundsError")
    expect(starknetCalls.balance).toBe(1)
    expect(starknetCalls.deploy).toBe(0)
  })

  it("deploys when account balance is funded", async () => {
    const falconCalls = { generate: 0, pack: 0 }
    const starknetCalls = { compute: 0, balance: 0, deploy: 0 }
    const falconLayer = makeFalconLayer({
      generatedKeypair: makeKeypair(1),
      packedPublicKey: MOCK_PACKED_PUBLIC_KEY,
      calls: falconCalls,
    })
    const starknetLayer = makeStarknetLayer({ balance: 2n, calls: starknetCalls })

    const exit = await runPipelineEffect(
      deployAccountEffect({
        address: MOCK_ADDRESS,
        packedPublicKey: MOCK_PACKED_PUBLIC_KEY,
        privateKey: VALID_PRIVATE_KEY,
        salt: "0xdeadbeef",
        requiredBalance: 1n,
      }),
      falconLayer,
      starknetLayer,
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.txHash).toBe(MOCK_TX_HASH)
      expect(exit.value.address).toBe(MOCK_ADDRESS)
    }
    expect(starknetCalls.balance).toBe(1)
    expect(starknetCalls.deploy).toBe(1)
  })
})
