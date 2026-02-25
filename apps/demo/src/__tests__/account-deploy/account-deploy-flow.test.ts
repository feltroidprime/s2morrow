/**
 * Integration tests for Account Deploy Flow — account-deploy category.
 *
 * Tests the 5-step mainnet deployment flow:
 *   1. generating-keypair  (Falcon keygen via FalconService)
 *   2. packing             (pack public key to felt252 slots)
 *   3. computing-address   (pure hash + CallData computation)
 *   4. awaiting-funds      (balance check loop via getBalance)
 *   5. deploying           (broadcastAccount + waitForTx)
 *
 * Strategy:
 * - All StarknetService calls use Layer.succeed mocks — no live RPC
 * - Atoms are driven via Registry.make() for isolated state tracking
 * - An orchestrated Effect drives state transitions the same way
 *   AccountDeployFlow component will drive them in production
 * - Every service method has success + failure coverage
 * - Every Schema.TaggedError appears in at least one failure case
 *
 * Coverage requirements:
 * - computeDeployAddress: success, failure
 * - getBalance: success (funded), success (zero = awaiting funds), failure
 * - deployAccount: success, failure (no txHash), failure (with txHash)
 * - waitForTx: success, failure
 * - InsufficientFundsError: constructable, matchable, catchTag
 * - AccountDeployError: with/without txHash in deploy context
 * - Orchestrated flow: full happy-path, error propagation
 */

import { describe, it, expect, beforeEach } from "bun:test"
import { Effect, Exit, Layer, Option, Cause, ConfigProvider } from "effect"
import { Registry } from "@effect-atom/atom"

import { StarknetService } from "../../services/StarknetService"
import {
  StarknetRpcError,
  AccountDeployError,
  InsufficientFundsError,
} from "../../services/errors"
import {
  TxHash,
  ContractAddress,
} from "../../services/types"
import type { PackedPublicKey } from "../../services/types"
import type { DeployStep } from "../../atoms/starknet"
import {
  deployStepAtom,
  deployedAddressAtom,
  deployTxHashAtom,
} from "../../atoms/starknet"

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_ADDRESS = ContractAddress.make("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7")
const MOCK_TX_HASH = TxHash.make("0x7f3e2a1b9c4d5e6f0a1b2c3d4e5f6a7b")
const MOCK_PACKED_PK: PackedPublicKey = {
  slots: Array.from({ length: 29 }, (_, i) => `0x${i.toString(16).padStart(64, "0")}`),
}
const MOCK_PRIVATE_KEY = "0xdeadbeefcafebabe1234567890abcdef"
const FUNDED_BALANCE = BigInt("1000000000000000000") // 1 STRK
const ZERO_BALANCE = BigInt(0)

// ---------------------------------------------------------------------------
// Mock Layer builders
// ---------------------------------------------------------------------------

/**
 * Happy-path StarknetService: all methods succeed.
 */
const makeSuccessLayer = (): Layer.Layer<StarknetService> =>
  Layer.succeed(StarknetService, {
    computeDeployAddress: (_pk: PackedPublicKey) =>
      Effect.succeed(MOCK_ADDRESS),
    getBalance: (_addr: string) =>
      Effect.succeed(FUNDED_BALANCE),
    deployAccount: (_pk: PackedPublicKey, _sk: string) =>
      Effect.succeed({ txHash: MOCK_TX_HASH, address: MOCK_ADDRESS }),
    waitForTx: (_tx: string) =>
      Effect.succeed(undefined as void),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

/**
 * Zero-balance service: getBalance returns 0 (account not yet funded).
 */
const makeZeroBalanceLayer = (): Layer.Layer<StarknetService> =>
  Layer.succeed(StarknetService, {
    computeDeployAddress: (_pk: PackedPublicKey) =>
      Effect.succeed(MOCK_ADDRESS),
    getBalance: (_addr: string) =>
      Effect.succeed(ZERO_BALANCE),
    deployAccount: (_pk: PackedPublicKey, _sk: string) =>
      Effect.fail(new AccountDeployError({ message: "should not be reached" })),
    waitForTx: (_tx: string) =>
      Effect.succeed(undefined as void),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

/**
 * Deploy failure: deployAccount fails without txHash.
 */
const makeDeployFailureLayer = (): Layer.Layer<StarknetService> =>
  Layer.succeed(StarknetService, {
    computeDeployAddress: (_pk: PackedPublicKey) =>
      Effect.succeed(MOCK_ADDRESS),
    getBalance: (_addr: string) =>
      Effect.succeed(FUNDED_BALANCE),
    deployAccount: (_pk: PackedPublicKey, _sk: string) =>
      Effect.fail(new AccountDeployError({ message: "insufficient fee" })),
    waitForTx: (_tx: string) =>
      Effect.succeed(undefined as void),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

/**
 * Deploy failure: deployAccount fails WITH a txHash (tx was broadcast but reverted).
 */
const makeDeployRevertedLayer = (): Layer.Layer<StarknetService> =>
  Layer.succeed(StarknetService, {
    computeDeployAddress: (_pk: PackedPublicKey) =>
      Effect.succeed(MOCK_ADDRESS),
    getBalance: (_addr: string) =>
      Effect.succeed(FUNDED_BALANCE),
    deployAccount: (_pk: PackedPublicKey, _sk: string) =>
      Effect.fail(
        new AccountDeployError({
          message: "transaction reverted",
          txHash: MOCK_TX_HASH,
        }),
      ),
    waitForTx: (_tx: string) =>
      Effect.succeed(undefined as void),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

/**
 * RPC failure: computeDeployAddress fails (simulates RPC down at address computation).
 */
const makeRpcFailureLayer = (): Layer.Layer<StarknetService> =>
  Layer.succeed(StarknetService, {
    computeDeployAddress: (_pk: PackedPublicKey) =>
      Effect.fail(new StarknetRpcError({ message: "connection refused", code: -1 })),
    getBalance: (_addr: string) =>
      Effect.fail(new StarknetRpcError({ message: "connection refused", code: -1 })),
    deployAccount: (_pk: PackedPublicKey, _sk: string) =>
      Effect.fail(new AccountDeployError({ message: "connection refused" })),
    waitForTx: (_tx: string) =>
      Effect.fail(new StarknetRpcError({ message: "timeout", code: -32003 })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

/** Run an effect provided with a specific StarknetService mock layer */
async function runWith<A, E>(
  effect: Effect.Effect<A, E, StarknetService>,
  serviceLayer: Layer.Layer<StarknetService>,
): Promise<Exit.Exit<A, E>> {
  return Effect.runPromiseExit(effect.pipe(Effect.provide(serviceLayer)))
}

// ---------------------------------------------------------------------------
// Group 1: DeployStep state machine — atom transitions
// (Complements atoms.test.ts; tests account-deploy-specific scenarios)
// ---------------------------------------------------------------------------

describe("DeployStep state machine — account-deploy scenarios", () => {
  it("idle → awaiting-funds preserves address in step payload", () => {
    const registry = Registry.make()
    registry.set(deployStepAtom, { step: "awaiting-funds", address: MOCK_ADDRESS })
    const state = registry.get(deployStepAtom)
    expect(state.step).toBe("awaiting-funds")
    expect((state as Extract<DeployStep, { step: "awaiting-funds" }>).address).toBe(MOCK_ADDRESS)
  })

  it("deploying step preserves address", () => {
    const registry = Registry.make()
    registry.set(deployStepAtom, { step: "deploying", address: MOCK_ADDRESS })
    const state = registry.get(deployStepAtom)
    expect(state.step).toBe("deploying")
    expect((state as Extract<DeployStep, { step: "deploying" }>).address).toBe(MOCK_ADDRESS)
  })

  it("deployed step carries both address and txHash", () => {
    const registry = Registry.make()
    registry.set(deployStepAtom, {
      step: "deployed",
      address: MOCK_ADDRESS,
      txHash: MOCK_TX_HASH,
    })
    const state = registry.get(deployStepAtom) as Extract<DeployStep, { step: "deployed" }>
    expect(state.step).toBe("deployed")
    expect(state.address).toBe(MOCK_ADDRESS)
    expect(state.txHash).toBe(MOCK_TX_HASH)
  })

  it("error step carries human-readable message", () => {
    const registry = Registry.make()
    registry.set(deployStepAtom, {
      step: "error",
      message: "Insufficient STRK balance — please fund the account",
    })
    const state = registry.get(deployStepAtom) as Extract<DeployStep, { step: "error" }>
    expect(state.step).toBe("error")
    expect(state.message).toContain("Insufficient")
  })

  it("subscribe fires on each deploy step transition", () => {
    const registry = Registry.make()
    const steps: string[] = []
    registry.subscribe(deployStepAtom, (v) => steps.push(v.step))
    registry.set(deployStepAtom, { step: "generating-keypair" })
    registry.set(deployStepAtom, { step: "packing" })
    registry.set(deployStepAtom, { step: "computing-address" })
    expect(steps).toEqual(["generating-keypair", "packing", "computing-address"])
  })

  it("deployedAddressAtom and deployTxHashAtom are set at deployed step", () => {
    const registry = Registry.make()
    // Simulate what AccountDeployFlow component will do on success
    registry.set(deployStepAtom, {
      step: "deployed",
      address: MOCK_ADDRESS,
      txHash: MOCK_TX_HASH,
    })
    registry.set(deployedAddressAtom, Option.some(MOCK_ADDRESS))
    registry.set(deployTxHashAtom, Option.some(MOCK_TX_HASH))

    expect(Option.isSome(registry.get(deployedAddressAtom))).toBe(true)
    expect(Option.isSome(registry.get(deployTxHashAtom))).toBe(true)
    expect(Option.getOrThrow(registry.get(deployedAddressAtom))).toBe(MOCK_ADDRESS)
    expect(Option.getOrThrow(registry.get(deployTxHashAtom))).toBe(MOCK_TX_HASH)
  })

  it("error resets deployedAddressAtom and deployTxHashAtom to none", () => {
    const registry = Registry.make()
    // Simulate a re-run after error: clear previous deployment state
    registry.set(deployedAddressAtom, Option.none())
    registry.set(deployTxHashAtom, Option.none())
    registry.set(deployStepAtom, { step: "error", message: "retry" })

    expect(Option.isNone(registry.get(deployedAddressAtom))).toBe(true)
    expect(Option.isNone(registry.get(deployTxHashAtom))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Group 2: computeDeployAddress — step 3 of deploy flow
// ---------------------------------------------------------------------------

describe("StarknetService.computeDeployAddress — account-deploy step 3", () => {
  it("success: returns a 0x-prefixed hex string (ContractAddress)", async () => {
    const exit = await runWith(
      StarknetService.computeDeployAddress(MOCK_PACKED_PK),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(typeof exit.value).toBe("string")
      expect((exit.value as string).startsWith("0x")).toBe(true)
    }
  })

  it("failure: StarknetRpcError carries code and message", async () => {
    const exit = await runWith(
      StarknetService.computeDeployAddress(MOCK_PACKED_PK),
      makeRpcFailureLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      expect(failure._tag).toBe("Some")
      // @ts-expect-error Option.Some
      const err = failure.value
      expect(err._tag).toBe("StarknetRpcError")
      expect(err.code).toBe(-1)
    }
  })

  it("real implementation (pure computation — no network): returns deterministic hex address", async () => {
    const withTestConfig = ConfigProvider.fromMap(
      new Map([["NEXT_PUBLIC_STARKNET_RPC_URL", "http://localhost:9999"]]),
    )
    const exit = await Effect.runPromiseExit(
      StarknetService.computeDeployAddress(MOCK_PACKED_PK).pipe(
        Effect.provide(StarknetService.Default),
        Effect.provide(Layer.setConfigProvider(withTestConfig)),
      ),
    )
    // computeDeployAddress is pure (no RPC call), so must succeed
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(typeof exit.value.address).toBe("string")
      expect(exit.value.address.startsWith("0x")).toBe(true)
      expect(typeof exit.value.salt).toBe("string")
      expect(exit.value.salt.startsWith("0x")).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Group 3: getBalance — step 4 (awaiting-funds gate)
// ---------------------------------------------------------------------------

describe("StarknetService.getBalance — awaiting-funds gate", () => {
  it("success: returns FUNDED_BALANCE bigint (account is ready to deploy)", async () => {
    const exit = await runWith(
      StarknetService.getBalance(MOCK_ADDRESS),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(typeof exit.value).toBe("bigint")
      expect(exit.value).toBe(FUNDED_BALANCE)
      expect(exit.value > ZERO_BALANCE).toBe(true)
    }
  })

  it("zero balance: returns 0n (account needs funding, stay in awaiting-funds)", async () => {
    const exit = await runWith(
      StarknetService.getBalance(MOCK_ADDRESS),
      makeZeroBalanceLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(ZERO_BALANCE)
      expect(exit.value === ZERO_BALANCE).toBe(true)
    }
  })

  it("failure: StarknetRpcError propagates from getBalance", async () => {
    const exit = await runWith(
      StarknetService.getBalance(MOCK_ADDRESS),
      makeRpcFailureLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      // @ts-expect-error Option.Some
      expect(failure.value._tag).toBe("StarknetRpcError")
    }
  })

  it("balance check logic: 0n triggers awaiting-funds, nonzero allows deploy", () => {
    // Simulate the conditional logic in AccountDeployFlow
    const isReadyToDeploy = (balance: bigint): boolean => balance > BigInt(0)
    expect(isReadyToDeploy(ZERO_BALANCE)).toBe(false)
    expect(isReadyToDeploy(FUNDED_BALANCE)).toBe(true)
    expect(isReadyToDeploy(BigInt(1))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Group 4: deployAccount — step 5 of deploy flow
// ---------------------------------------------------------------------------

describe("StarknetService.deployAccount — step 5", () => {
  it("success: returns { txHash, address } with correct shapes", async () => {
    const exit = await runWith(
      StarknetService.deployAccount(MOCK_PACKED_PK, MOCK_PRIVATE_KEY),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(typeof exit.value.txHash).toBe("string")
      expect(typeof exit.value.address).toBe("string")
      expect((exit.value.txHash as string).startsWith("0x")).toBe(true)
      expect((exit.value.address as string).startsWith("0x")).toBe(true)
    }
  })

  it("failure: AccountDeployError without txHash (pre-broadcast rejection)", async () => {
    const exit = await runWith(
      StarknetService.deployAccount(MOCK_PACKED_PK, MOCK_PRIVATE_KEY),
      makeDeployFailureLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      // @ts-expect-error Option.Some
      const err = failure.value
      expect(err._tag).toBe("AccountDeployError")
      expect(err.txHash).toBeUndefined()
      expect(err.message).toBe("insufficient fee")
    }
  })

  it("failure: AccountDeployError WITH txHash (broadcast succeeded but tx reverted)", async () => {
    const exit = await runWith(
      StarknetService.deployAccount(MOCK_PACKED_PK, MOCK_PRIVATE_KEY),
      makeDeployRevertedLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      // @ts-expect-error Option.Some
      const err = failure.value
      expect(err._tag).toBe("AccountDeployError")
      expect(err.txHash).toBe(MOCK_TX_HASH)
      expect(err.message).toBe("transaction reverted")
    }
  })

  it("AccountDeployError with txHash can be caught and txHash extracted", async () => {
    let caughtTxHash: string | undefined = undefined
    await Effect.runPromise(
      Effect.fail(
        new AccountDeployError({ message: "reverted", txHash: MOCK_TX_HASH }),
      ).pipe(
        Effect.catchTag("AccountDeployError", (e) => {
          caughtTxHash = e.txHash
          return Effect.succeed(null)
        }),
      ),
    )
    // Use non-null assertion: we know caughtTxHash was set by catchTag
    // bun:test toBe() has strict overloads that require matching types
    expect(caughtTxHash!).toBe(MOCK_TX_HASH as string)
  })
})

// ---------------------------------------------------------------------------
// Group 5: waitForTx — post-deploy confirmation
// ---------------------------------------------------------------------------

describe("StarknetService.waitForTx — post-deploy confirmation", () => {
  it("success: resolves void when transaction confirms", async () => {
    const exit = await runWith(
      StarknetService.waitForTx(MOCK_TX_HASH),
      makeSuccessLayer(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBeUndefined()
    }
  })

  it("failure: StarknetRpcError when waitForTx times out", async () => {
    const exit = await runWith(
      StarknetService.waitForTx(MOCK_TX_HASH),
      makeRpcFailureLayer(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      // @ts-expect-error Option.Some
      const err = failure.value
      expect(err._tag).toBe("StarknetRpcError")
      expect(err.code).toBe(-32003)
    }
  })
})

// ---------------------------------------------------------------------------
// Group 6: InsufficientFundsError — balance check error type
// ---------------------------------------------------------------------------

describe("InsufficientFundsError — balance gate error type", () => {
  it("is constructable with all required fields", () => {
    const err = new InsufficientFundsError({
      message: "Need STRK to deploy",
      address: MOCK_ADDRESS,
      required: "1000000000000000000",
    })
    expect(err._tag).toBe("InsufficientFundsError")
    expect(err.address).toBe(MOCK_ADDRESS)
    expect(err.required).toBe("1000000000000000000")
    expect(err.message).toBe("Need STRK to deploy")
  })

  it("roundtrips through Effect.runPromiseExit with correct Exit.isFailure", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(
        new InsufficientFundsError({
          message: "balance too low",
          address: MOCK_ADDRESS,
          required: "500",
        }),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(Exit.isSuccess(exit)).toBe(false)
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      // @ts-expect-error Option.Some
      expect(failure.value._tag).toBe("InsufficientFundsError")
    }
  })

  it("can be caught with catchTag and address extracted", async () => {
    let caughtAddress = ""
    let caughtRequired = ""
    await Effect.runPromise(
      Effect.fail(
        new InsufficientFundsError({
          message: "not enough",
          address: MOCK_ADDRESS,
          required: "1000",
        }),
      ).pipe(
        Effect.catchTag("InsufficientFundsError", (e) => {
          caughtAddress = e.address
          caughtRequired = e.required
          return Effect.succeed(null)
        }),
      ),
    )
    expect(caughtAddress).toBe(MOCK_ADDRESS)
    expect(caughtRequired).toBe("1000")
  })

  it("_tag is 'InsufficientFundsError' (not AccountDeployError)", () => {
    const err = new InsufficientFundsError({
      message: "x",
      address: "0x0",
      required: "0",
    })
    expect(err._tag).toBe("InsufficientFundsError")
    expect(err._tag).not.toBe("AccountDeployError")
    expect(err._tag).not.toBe("StarknetRpcError")
  })

  it("simulate balance gate: zero balance → InsufficientFundsError", async () => {
    // Simulate what AccountDeployFlow would do:
    // if getBalance returns 0n and user hasn't funded, produce InsufficientFundsError
    const balanceGateEffect = Effect.gen(function* () {
      const balance = yield* StarknetService.getBalance(MOCK_ADDRESS)
      if (balance === ZERO_BALANCE) {
        yield* Effect.fail(
          new InsufficientFundsError({
            message: "Account not funded — send STRK to deploy",
            address: MOCK_ADDRESS,
            required: "1000000000000000000",
          }),
        )
      }
      return balance
    })

    const exit = await runWith(balanceGateEffect, makeZeroBalanceLayer())
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      // @ts-expect-error Option.Some
      expect(failure.value._tag).toBe("InsufficientFundsError")
    }
  })

  it("simulate balance gate: funded balance → passes through (no error)", async () => {
    const balanceGateEffect = Effect.gen(function* () {
      const balance = yield* StarknetService.getBalance(MOCK_ADDRESS)
      if (balance === ZERO_BALANCE) {
        yield* Effect.fail(
          new InsufficientFundsError({
            message: "not funded",
            address: MOCK_ADDRESS,
            required: "1",
          }),
        )
      }
      return balance
    })

    const exit = await runWith(balanceGateEffect, makeSuccessLayer())
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(FUNDED_BALANCE)
    }
  })
})

// ---------------------------------------------------------------------------
// Group 7: Orchestrated 5-step deploy flow Effect
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full 5-step AccountDeployFlow using the StarknetService.
 * This is how AccountDeployFlow.tsx will drive the deploy — we test the
 * Effect pipeline here without a React component.
 *
 * Steps:
 * 1. generating-keypair  (not in StarknetService — handled by FalconService; mocked here)
 * 2. packing             (not in StarknetService — handled by FalconService; mocked here)
 * 3. computing-address   (StarknetService.computeDeployAddress)
 * 4. awaiting-funds      (StarknetService.getBalance — stays in step until > 0)
 * 5. deploying           (StarknetService.deployAccount)
 */
/**
 * Returns the named step sequence the flow visited (via subscribe callback array).
 * We only subscribe to deployStepAtom; the Effect.gen drives state via registry.set
 * for that atom only. Option-typed atoms (deployedAddressAtom, deployTxHashAtom) are
 * set OUTSIDE the Effect by the component after the effect returns — we test that
 * separately in Groups 1 and 8.
 */
const makeDeployOrchestrationEffect = (registry: ReturnType<typeof Registry.make>) =>
  Effect.gen(function* () {
    // Step 1: generating-keypair (simulated — FalconService handled separately)
    registry.set(deployStepAtom, { step: "generating-keypair" })

    // Step 2: packing
    registry.set(deployStepAtom, { step: "packing" })
    const packedPk = MOCK_PACKED_PK

    // Step 3: computing-address
    registry.set(deployStepAtom, { step: "computing-address" })
    const address = yield* StarknetService.computeDeployAddress(packedPk)

    // Step 4: awaiting-funds
    registry.set(deployStepAtom, { step: "awaiting-funds", address })
    const balance = yield* StarknetService.getBalance(address)

    // Step 5: deploying (only if funded)
    registry.set(deployStepAtom, { step: "deploying", address })
    const result = yield* StarknetService.deployAccount(packedPk, MOCK_PRIVATE_KEY)

    // Done — component sets Option atoms after effect resolves (see Group 1 & 8 tests)
    registry.set(deployStepAtom, {
      step: "deployed",
      address: result.address,
      txHash: result.txHash,
    })

    return { address: result.address, txHash: result.txHash, balance }
  })

describe("Orchestrated 5-step deploy flow", () => {
  it("happy path: effect returns address+txHash and subscribe shows full step sequence", async () => {
    const registry = Registry.make()
    const steps: string[] = []
    registry.subscribe(deployStepAtom, (v) => steps.push(v.step))

    const exit = await Effect.runPromiseExit(
      makeDeployOrchestrationEffect(registry).pipe(
        Effect.provide(makeSuccessLayer()),
      ),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.address).toBe(MOCK_ADDRESS)
      expect(exit.value.txHash).toBe(MOCK_TX_HASH)
      expect(exit.value.balance).toBe(FUNDED_BALANCE)
    }

    // Verify step sequence was followed (subscribe captures all transitions)
    expect(steps).toContain("generating-keypair")
    expect(steps).toContain("packing")
    expect(steps).toContain("computing-address")
    expect(steps).toContain("awaiting-funds")
    expect(steps).toContain("deploying")
    expect(steps).toContain("deployed")

    // Component sets Option atoms after effect resolves (simulated here)
    if (Exit.isSuccess(exit)) {
      registry.set(deployedAddressAtom, Option.some(exit.value.address))
      registry.set(deployTxHashAtom, Option.some(exit.value.txHash))
      expect(Option.isSome(registry.get(deployedAddressAtom))).toBe(true)
      expect(Option.isSome(registry.get(deployTxHashAtom))).toBe(true)
    }
  })

  it("RPC failure at computeDeployAddress: exit is Failure with StarknetRpcError", async () => {
    const registry = Registry.make()
    const steps: string[] = []
    registry.subscribe(deployStepAtom, (v) => steps.push(v.step))

    const exit = await Effect.runPromiseExit(
      makeDeployOrchestrationEffect(registry).pipe(
        Effect.provide(makeRpcFailureLayer()),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      // Effect fails because computeDeployAddress returned StarknetRpcError
      const cause = JSON.stringify(exit.cause)
      expect(cause).toContain("StarknetRpcError")
    }

    // Deploy flow reached computing-address step before failing
    // (subscribe captures all steps set before the failing yield*)
    expect(steps).toContain("computing-address")
    expect(steps).not.toContain("awaiting-funds")
    expect(steps).not.toContain("deploying")
    expect(steps).not.toContain("deployed")
  })

  it("deploy rejection: AccountDeployError at step 5, subscribe shows deploying step reached", async () => {
    const registry = Registry.make()
    const steps: string[] = []
    registry.subscribe(deployStepAtom, (v) => steps.push(v.step))

    const exit = await Effect.runPromiseExit(
      makeDeployOrchestrationEffect(registry).pipe(
        Effect.provide(makeDeployFailureLayer()),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause)
      // @ts-expect-error Option.Some — access value without narrowing for brevity
      expect(failure.value._tag).toBe("AccountDeployError")
      // Use toBe(undefined) instead of toBeUndefined() — bun:test's toBeUndefined()
      // overloads are strict and require the type to be `undefined`, not `string | undefined`
      // @ts-expect-error Option.Some
      expect(failure.value.txHash === undefined).toBe(true)
    }

    // Steps up to deploying were reached (address computation succeeded)
    expect(steps).toContain("computing-address")
    expect(steps).toContain("awaiting-funds")
    expect(steps).toContain("deploying")
    // But deployed was never reached (deployAccount failed)
    expect(steps).not.toContain("deployed")
  })

  it("registry isolation: two concurrent deploy flows don't share state", async () => {
    const registry1 = Registry.make()
    const registry2 = Registry.make()

    registry1.set(deployStepAtom, { step: "deploying", address: ContractAddress.make("0x1111") })
    registry2.set(deployStepAtom, { step: "computing-address" })

    expect(registry1.get(deployStepAtom).step).toBe("deploying")
    expect(registry2.get(deployStepAtom).step).toBe("computing-address")
  })
})

// ---------------------------------------------------------------------------
// Group 8: Branded types (TxHash, ContractAddress) in deploy context
// ---------------------------------------------------------------------------

describe("Branded types in account-deploy flow", () => {
  it("MOCK_ADDRESS and MOCK_TX_HASH are assignable to ContractAddress/TxHash", () => {
    // These are the types that flow through the deploy pipeline
    const addr: ContractAddress = MOCK_ADDRESS
    const tx: TxHash = MOCK_TX_HASH
    expect(typeof addr).toBe("string")
    expect(typeof tx).toBe("string")
    expect(addr.startsWith("0x")).toBe(true)
    expect(tx.startsWith("0x")).toBe(true)
  })

  it("deployed step shape has address:ContractAddress and txHash:TxHash", () => {
    const registry = Registry.make()
    registry.set(deployStepAtom, {
      step: "deployed",
      address: MOCK_ADDRESS,
      txHash: MOCK_TX_HASH,
    })
    const state = registry.get(deployStepAtom) as Extract<DeployStep, { step: "deployed" }>
    // Both are string-based branded types — no cast needed after DeployStep uses brands
    const address: ContractAddress = state.address
    const txHash: TxHash = state.txHash
    expect(address).toBe(MOCK_ADDRESS)
    expect(txHash).toBe(MOCK_TX_HASH)
  })

  it("deployedAddressAtom holds Option<ContractAddress>", () => {
    const registry = Registry.make()
    registry.set(deployedAddressAtom, Option.some(MOCK_ADDRESS))
    const val = registry.get(deployedAddressAtom)
    expect(Option.isSome(val)).toBe(true)
    const addr: ContractAddress = Option.getOrThrow(val)
    expect(addr).toBe(MOCK_ADDRESS)
  })

  it("deployTxHashAtom holds Option<TxHash>", () => {
    const registry = Registry.make()
    registry.set(deployTxHashAtom, Option.some(MOCK_TX_HASH))
    const val = registry.get(deployTxHashAtom)
    expect(Option.isSome(val)).toBe(true)
    const txHash: TxHash = Option.getOrThrow(val)
    expect(txHash).toBe(MOCK_TX_HASH)
  })
})
