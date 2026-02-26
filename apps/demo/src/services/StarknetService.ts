import { Config, Effect, Layer } from "effect"
import { RpcProvider, Account, hash, transaction, EDAMode } from "starknet"
import type { SignerInterface, Signature } from "starknet"
import {
  StarknetRpcError,
  AccountDeployError,
  DevnetFetchError,
  TransactionSubmitError,
} from "./errors"
import { TxHash, ContractAddress } from "./types"
import type { PackedPublicKey, DevnetAccount } from "./types"

export interface FalconResourceBounds {
  l2_gas: { max_amount: bigint; max_price_per_unit: bigint }
  l1_gas: { max_amount: bigint; max_price_per_unit: bigint }
  l1_data_gas: { max_amount: bigint; max_price_per_unit: bigint }
}

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

  // Falcon-512 verification needs ~50M L2 gas steps — too heavy for
  // auto-estimation. Hardcode amounts, fetch live prices from the network.
  const falconResourceBounds = Effect.tryPromise({
    try: async () => {
      const block = await provider.getBlock("latest")
      const mul = 2n
      const l1 = BigInt(block.l1_gas_price.price_in_fri) * mul
      const l2 = BigInt(block.l2_gas_price.price_in_fri) * mul
      const l1d = BigInt(block.l1_data_gas_price.price_in_fri) * mul
      return {
        l2_gas: { max_amount: 0x2FAF080n, max_price_per_unit: l2 },
        l1_gas: { max_amount: 0x0n, max_price_per_unit: l1 },
        l1_data_gas: { max_amount: 0x3000n, max_price_per_unit: l1d },
      }
    },
    catch: (error) =>
      new StarknetRpcError({ message: `Gas price fetch failed: ${error}`, code: -1 }),
  })

  const computeDeployAddress = Effect.fn("Starknet.computeDeployAddress")(
    function* (packedPk: PackedPublicKey) {
      // PackedPolynomial512 is a flat struct (s0..s28), not an Array.
      // CallData.compile would add a length prefix; pass raw slots instead.
      const constructorCalldata = [...packedPk.slots]
      // Deterministic salt — same keypair always produces the same address,
      // so a pre-funded address stays valid across page reloads.
      const salt = "0x1"
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

  const isDeployed = Effect.fn("Starknet.isDeployed")(
    function* (address: string) {
      return yield* Effect.tryPromise({
        try: async () => {
          const ch = await provider.getClassHashAt(address)
          return !!ch
        },
        catch: () => new StarknetRpcError({ message: "getClassHashAt failed", code: -1 }),
      }).pipe(Effect.orElseSucceed(() => false))
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
      signer: SignerInterface,
      salt: string,
    ) {
      // PackedPolynomial512 is a flat struct (s0..s28), not an Array.
      // CallData.compile would add a length prefix; pass raw slots instead.
      const constructorCalldata = [...packedPk.slots]
      const address = hash.calculateContractAddressFromHash(
        salt,
        classHash,
        constructorCalldata,
        0,
      )

      const account = new Account({ provider, address, signer })

      const resourceBounds = yield* falconResourceBounds

      const result = yield* Effect.tryPromise({
        try: () =>
          account.deployAccount(
            {
              classHash,
              constructorCalldata,
              addressSalt: salt,
              contractAddress: address,
            },
            { resourceBounds },
          ),
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
          const response = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "devnet_getPredeployedAccounts",
              params: [],
            }),
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          const json = await response.json()
          if (json.error) {
            throw new Error(json.error.message ?? JSON.stringify(json.error))
          }
          return parsePrefundedAccounts(json.result as unknown[])
        },
        catch: (error) =>
          new DevnetFetchError({ message: `Failed to fetch prefunded accounts: ${error}` }),
      })
    },
  )

  const getNonce = Effect.fn("Starknet.getNonce")(
    function* (address: string) {
      return yield* Effect.tryPromise({
        try: () => provider.getNonceForAddress(address),
        catch: (error) =>
          new StarknetRpcError({ message: `Nonce fetch failed: ${error}`, code: -1 }),
      })
    },
  )

  const getChainId = Effect.fn("Starknet.getChainId")(
    function* () {
      return yield* Effect.tryPromise({
        try: () => provider.getChainId(),
        catch: (error) =>
          new StarknetRpcError({ message: `Chain ID fetch failed: ${error}`, code: -1 }),
      })
    },
  )

  const getResourceBounds = Effect.fn("Starknet.getResourceBounds")(
    function* () {
      return yield* falconResourceBounds
    },
  )

  const submitSignedInvoke = Effect.fn("Starknet.submitSignedInvoke")(
    function* (
      senderAddress: string,
      compiledCalldata: string[],
      signature: Signature,
      nonce: string,
      resourceBounds: FalconResourceBounds,
    ) {
      return yield* Effect.tryPromise({
        try: async () => {
          const result = await provider.invokeFunction(
            { contractAddress: senderAddress, calldata: compiledCalldata, signature },
            {
              nonce,
              version: "0x100000000000000000000000000000003",
              resourceBounds,
            },
          )
          return { txHash: TxHash.make(result.transaction_hash) }
        },
        catch: (error) =>
          new TransactionSubmitError({ message: String(error) }),
      })
    },
  )

  const executeTransaction = Effect.fn("Starknet.executeTransaction")(
    function* (
      accountAddress: string,
      signer: SignerInterface,
      recipient: string,
      amount: bigint,
      prefetched?: { nonce: string; resourceBounds: FalconResourceBounds },
    ) {
      const account = new Account({ provider, address: accountAddress, signer })

      const resourceBounds = prefetched?.resourceBounds ?? (yield* falconResourceBounds)
      const nonce = prefetched?.nonce ?? (yield* getNonce(accountAddress))

      return yield* Effect.tryPromise({
        try: async () => {
          const result = await account.execute(
            [
              {
                contractAddress: STRK_TOKEN_ADDRESS,
                entrypoint: "transfer",
                calldata: [recipient, amount.toString(), "0"],
              },
            ],
            { resourceBounds, nonce },
          )
          return { txHash: TxHash.make(result.transaction_hash) }
        },
        catch: (error) =>
          new TransactionSubmitError({ message: String(error) }),
      })
    },
  )

  const sendTransaction = Effect.fn("Starknet.sendTransaction")(
    function* (
      accountAddress: string,
      signer: SignerInterface,
      recipient: string,
      amount: bigint,
    ) {
      const { txHash } = yield* executeTransaction(accountAddress, signer, recipient, amount)
      yield* waitForTx(txHash)
      return { txHash }
    },
  )

  return {
    computeDeployAddress,
    isDeployed,
    getBalance,
    getNonce,
    getChainId,
    getResourceBounds,
    submitSignedInvoke,
    deployAccount,
    waitForTx,
    fetchPrefundedAccounts,
    executeTransaction,
    sendTransaction,
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
