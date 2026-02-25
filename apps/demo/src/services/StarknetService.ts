import { Config, Effect, Layer } from "effect"
import { RpcProvider, Account, hash, CallData, stark } from "starknet"
import {
  StarknetRpcError,
  AccountDeployError,
  DevnetFetchError,
} from "./errors"
import { TxHash, ContractAddress } from "./types"
import type { PackedPublicKey, DevnetAccount } from "./types"

/** STRK token contract address (same on mainnet and Sepolia) */
export const STRK_TOKEN_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"

export function parsePrefundedAccounts(raw: unknown[]): DevnetAccount[] {
  return raw
    .filter((item): item is Record<string, string> =>
      typeof item === "object" && item !== null &&
      "address" in item && "private_key" in item
    )
    .map((item) => ({
      address: item.address,
      private_key: item.private_key,
      initial_balance: item.initial_balance ?? "0",
    }))
}

function makeService(rpcUrl: string, classHash: string) {
  const provider = new RpcProvider({ nodeUrl: rpcUrl })

  const computeDeployAddress = Effect.fn("Starknet.computeDeployAddress")(
    function* (packedPk: PackedPublicKey) {
      const constructorCalldata = CallData.compile({
        pk_packed: packedPk.slots,
      })
      const salt = stark.randomAddress()
      const address = hash.calculateContractAddressFromHash(
        salt,
        classHash,
        constructorCalldata,
        0,
      )
      return {
        address: ContractAddress.make(address),
        salt,
      }
    },
  )

  const getBalance = Effect.fn("Starknet.getBalance")(
    function* (address: string) {
      return yield* Effect.tryPromise({
        try: async () => {
          const result = await provider.callContract({
            contractAddress: STRK_TOKEN_ADDRESS,
            entrypoint: "balanceOf",
            calldata: [address],
          })
          return BigInt(result[0])
        },
        catch: (error) =>
          new StarknetRpcError({ message: String(error), code: -1 }),
      })
    },
  )

  const deployAccount = Effect.fn("Starknet.deployAccount")(
    function* (
      packedPk: PackedPublicKey,
      privateKey: string,
      salt: string,
    ) {
      const constructorCalldata = CallData.compile({
        pk_packed: packedPk.slots,
      })
      const address = hash.calculateContractAddressFromHash(
        salt,
        classHash,
        constructorCalldata,
        0,
      )

      const account = new Account({ provider, address, signer: privateKey })

      const result = yield* Effect.tryPromise({
        try: () =>
          account.deployAccount({
            classHash,
            constructorCalldata,
            addressSalt: salt,
            contractAddress: address,
          }),
        catch: (error) =>
          new AccountDeployError({ message: String(error) }),
      })

      yield* Effect.tryPromise({
        try: () => provider.waitForTransaction(result.transaction_hash),
        catch: (error) =>
          new AccountDeployError({
            message: `Tx failed: ${error}`,
            txHash: result.transaction_hash,
          }),
      })

      return {
        txHash: TxHash.make(result.transaction_hash),
        address: ContractAddress.make(result.contract_address),
      }
    },
  )

  const waitForTx = Effect.fn("Starknet.waitForTx")(
    function* (txHash: string) {
      yield* Effect.tryPromise({
        try: () => provider.waitForTransaction(txHash),
        catch: (error) =>
          new StarknetRpcError({ message: String(error), code: -1 }),
      })
    },
  )

  const fetchPrefundedAccounts = Effect.fn("Starknet.fetchPrefundedAccounts")(
    function* () {
      return yield* Effect.tryPromise({
        try: async () => {
          const baseUrl = rpcUrl.replace(/\/rpc.*$/, "").replace(/\/$/, "")
          const response = await fetch(`${baseUrl}/predeployed_accounts`)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          const data = await response.json()
          return parsePrefundedAccounts(data as unknown[])
        },
        catch: (error) =>
          new DevnetFetchError({ message: `Failed to fetch prefunded accounts: ${error}` }),
      })
    },
  )

  return {
    computeDeployAddress,
    getBalance,
    deployAccount,
    waitForTx,
    fetchPrefundedAccounts,
    provider,
  }
}

// @ts-ignore — StarknetService.make() intentionally overrides the inherited Effect.Service.make() with a Layer factory
export class StarknetService extends Effect.Service<StarknetService>()(
  "StarknetService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const rpcUrl = yield* Config.string("NEXT_PUBLIC_STARKNET_RPC_URL")
      return makeService(rpcUrl, "0x0")
    }),
  },
) {
  /**
   * Custom layer factory for runtime network switching.
   * Use this instead of Default when you need a specific rpcUrl and classHash
   * (e.g., switching between Sepolia and Mainnet at runtime).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static make(rpcUrl: string, classHash: string): Layer.Layer<StarknetService> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Layer.succeed(StarknetService, makeService(rpcUrl, classHash) as any)
  }
}
