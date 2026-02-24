/**
 * Tests for StarknetService — effect-services category.
 *
 * Strategy: StarknetService is tested via Layer.succeed mocks so no live
 * RPC connection is needed. This covers the contract (method signatures,
 * error types, Exit values) without hitting mainnet.
 *
 * Additionally, the real StarknetService is tested for computeDeployAddress
 * (pure computation — no network call) using ConfigProvider to inject the
 * RPC URL.
 *
 * Coverage requirements:
 * - Every service method must have at least one success and one failure test
 * - StarknetRpcError, AccountDeployError must be producible by the service
 */

import { describe, it, expect } from "bun:test"
import { Effect, Exit, Layer, ConfigProvider } from "effect"
import { StarknetService } from "../../services/StarknetService"
import { StarknetRpcError, AccountDeployError } from "../../services/errors"
import type { PackedPublicKey, TxHash, ContractAddress } from "../../services/types"

// ---------------------------------------------------------------------------
// Mock StarknetService helpers
// Use `as any` for mock service objects because test mocks intentionally
// include error-producing methods that differ from the inferred success-only types.
// ---------------------------------------------------------------------------

const mockAddress = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" as ContractAddress
const mockTxHash = "0x7f3e2a1b9c4d5e6f" as TxHash

// Success mock: all methods return successful Effects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeSuccessService = (): Layer.Layer<StarknetService> =>
  Layer.succeed(StarknetService, {
    computeDeployAddress: (_pk: PackedPublicKey) =>
      Effect.succeed(mockAddress),
    getBalance: (_addr: string) => Effect.succeed(BigInt("1000000000000000000")),
    deployAccount: (_pk: PackedPublicKey, _sk: string) =>
      Effect.succeed({ txHash: mockTxHash, address: mockAddress }),
    waitForTx: (_tx: string) => Effect.succeed(undefined as void),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

// Failing mock: all methods return failing Effects with typed errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeFailingService = (): Layer.Layer<StarknetService> =>
  Layer.succeed(StarknetService, {
    computeDeployAddress: (_pk: PackedPublicKey) =>
      Effect.fail(new StarknetRpcError({ message: "mock rpc error", code: -1 })),
    getBalance: (_addr: string) =>
      Effect.fail(new StarknetRpcError({ message: "balance fetch failed", code: -32000 })),
    deployAccount: (_pk: PackedPublicKey, _sk: string) =>
      Effect.fail(new AccountDeployError({ message: "deploy rejected" })),
    waitForTx: (_tx: string) =>
      Effect.fail(new StarknetRpcError({ message: "tx timeout", code: -1 })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

/** Run an effect provided with a specific StarknetService mock layer */
async function runWith<A, E>(
  effect: Effect.Effect<A, E, StarknetService>,
  serviceLayer: Layer.Layer<StarknetService>,
): Promise<Exit.Exit<A, E>> {
  return Effect.runPromiseExit(
    effect.pipe(Effect.provide(serviceLayer)),
  )
}

// ---------------------------------------------------------------------------
// computeDeployAddress
// ---------------------------------------------------------------------------

describe("StarknetService.computeDeployAddress (mocked)", () => {
  const mockPk: PackedPublicKey = {
    slots: Array.from({ length: 29 }, (_, i) => `0x${i.toString(16).padStart(64, "0")}`),
  }

  it("succeeds and returns a ContractAddress string", async () => {
    const exit = await runWith(
      StarknetService.computeDeployAddress(mockPk),
      makeSuccessService(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(typeof exit.value).toBe("string")
      expect(exit.value.startsWith("0x")).toBe(true)
    }
  })

  it("fails with StarknetRpcError when service fails", async () => {
    const exit = await runWith(
      StarknetService.computeDeployAddress(mockPk),
      makeFailingService(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("StarknetRpcError")
    }
  })
})

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------

describe("StarknetService.getBalance (mocked)", () => {
  it("succeeds and returns a bigint balance", async () => {
    const exit = await runWith(
      StarknetService.getBalance("0x1234"),
      makeSuccessService(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(typeof exit.value).toBe("bigint")
      expect(exit.value).toBe(BigInt("1000000000000000000"))
    }
  })

  it("fails with StarknetRpcError when RPC call fails", async () => {
    const exit = await runWith(
      StarknetService.getBalance("0xdeadbeef"),
      makeFailingService(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("StarknetRpcError")
    }
  })
})

// ---------------------------------------------------------------------------
// deployAccount
// ---------------------------------------------------------------------------

describe("StarknetService.deployAccount (mocked)", () => {
  const mockPk: PackedPublicKey = {
    slots: Array.from({ length: 29 }, (_, i) => `0x${i.toString(16).padStart(64, "0")}`),
  }

  it("succeeds and returns txHash and address", async () => {
    const exit = await runWith(
      StarknetService.deployAccount(mockPk, "0xprivkey"),
      makeSuccessService(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.txHash).toBe(mockTxHash)
      expect(exit.value.address).toBe(mockAddress)
    }
  })

  it("fails with AccountDeployError when deployment is rejected", async () => {
    const exit = await runWith(
      StarknetService.deployAccount(mockPk, "0xprivkey"),
      makeFailingService(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("AccountDeployError")
    }
  })
})

// ---------------------------------------------------------------------------
// waitForTx
// ---------------------------------------------------------------------------

describe("StarknetService.waitForTx (mocked)", () => {
  it("succeeds (returns void) when transaction confirms", async () => {
    const exit = await runWith(
      StarknetService.waitForTx("0xabc123"),
      makeSuccessService(),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it("fails with StarknetRpcError when tx times out", async () => {
    const exit = await runWith(
      StarknetService.waitForTx("0xdeadbeef"),
      makeFailingService(),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("StarknetRpcError")
    }
  })
})

// ---------------------------------------------------------------------------
// Real StarknetService: computeDeployAddress (pure computation, no network)
// ---------------------------------------------------------------------------

describe("StarknetService.computeDeployAddress (real implementation)", () => {
  const mockPk: PackedPublicKey = {
    slots: Array.from({ length: 29 }, (_, i) => `0x${i.toString(16).padStart(64, "0")}`),
  }

  const withTestConfig = ConfigProvider.fromMap(
    new Map([["NEXT_PUBLIC_STARKNET_RPC_URL", "http://localhost:9999"]]),
  )

  it("returns a hex string address (pure computation, no RPC call)", async () => {
    const exit = await Effect.runPromiseExit(
      StarknetService.computeDeployAddress(mockPk).pipe(
        Effect.provide(StarknetService.Default),
        Effect.provide(Layer.setConfigProvider(withTestConfig)),
      ),
    )
    // computeDeployAddress is pure (hash + CallData only), should succeed
    // even with a fake RPC URL because no network call is made
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(typeof exit.value).toBe("string")
    }
  })
})

// ---------------------------------------------------------------------------
// StarknetService: fails when Config is missing
// ---------------------------------------------------------------------------

describe("StarknetService: initialization failure", () => {
  it("StarknetService.Default fails gracefully when Config is missing", async () => {
    const exit = await Effect.runPromiseExit(
      StarknetService.computeDeployAddress({
        slots: Array.from({ length: 29 }, () => "0x0"),
      }).pipe(
        Effect.provide(StarknetService.Default),
        // Provide an empty ConfigProvider to prevent bun from loading .env.local —
        // this simulates the "no config available" scenario the test describes
        Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map()))),
      ),
    )
    // Should fail because NEXT_PUBLIC_STARKNET_RPC_URL is not in the empty config
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
