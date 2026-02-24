import { Config, Effect } from "effect"
import { RpcProvider, Account, hash, CallData, stark } from "starknet"
import {
  StarknetRpcError,
  AccountDeployError,
} from "./errors"
import { TxHash, ContractAddress } from "./types"
import type { PackedPublicKey } from "./types"

// FalconAccount class hash — must be declared on mainnet first
const FALCON_ACCOUNT_CLASS_HASH = "0x0" // TODO: replace after declaring

/** STRK token contract address on Starknet mainnet */
export const STRK_TOKEN_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"

export class StarknetService extends Effect.Service<StarknetService>()(
  "StarknetService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const rpcUrl = yield* Config.string("NEXT_PUBLIC_STARKNET_RPC_URL")
      const provider = new RpcProvider({ nodeUrl: rpcUrl })

      const computeDeployAddress = Effect.fn("Starknet.computeDeployAddress")(
        function* (packedPk: PackedPublicKey) {
          const constructorCalldata = CallData.compile({
            pk_packed: packedPk.slots,
          })
          const salt = stark.randomAddress()
          const address = hash.calculateContractAddressFromHash(
            salt,
            FALCON_ACCOUNT_CLASS_HASH,
            constructorCalldata,
            0,
          )
          return ContractAddress.make(address)
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
        function* (packedPk: PackedPublicKey, privateKey: string) {
          const constructorCalldata = CallData.compile({
            pk_packed: packedPk.slots,
          })
          const salt = stark.randomAddress()
          const address = hash.calculateContractAddressFromHash(
            salt,
            FALCON_ACCOUNT_CLASS_HASH,
            constructorCalldata,
            0,
          )

          // starknet v9 Account constructor takes a single AccountOptions object
          const account = new Account({ provider, address, signer: privateKey })

          const result = yield* Effect.tryPromise({
            try: () =>
              account.deployAccount({
                classHash: FALCON_ACCOUNT_CLASS_HASH,
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

      return {
        computeDeployAddress,
        getBalance,
        deployAccount,
        waitForTx,
        provider,
      }
    }),
  },
) {}
