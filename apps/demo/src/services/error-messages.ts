import { Cause, Exit, Option } from "effect"
import type {
  AccountDeployError,
  DevnetFetchError,
  InsufficientFundsError,
  KeygenError,
  PackingError,
  SigningError,
  StarknetRpcError,
  TransactionSignError,
  TransactionSubmitError,
  VerificationError,
  WasmLoadError,
} from "./errors"

type AppError =
  | WasmLoadError
  | KeygenError
  | SigningError
  | VerificationError
  | PackingError
  | StarknetRpcError
  | AccountDeployError
  | InsufficientFundsError
  | TransactionSignError
  | TransactionSubmitError
  | DevnetFetchError

export function mapErrorToUserMessage(error: AppError): string {
  switch (error._tag) {
    case "WasmLoadError":
      return "Failed to load the cryptography module. Try refreshing the page."
    case "KeygenError":
      return "Keypair generation failed. Try again with a different seed."
    case "SigningError":
      return "Signing failed. Make sure your keypair is valid."
    case "VerificationError":
      return `Verification failed at step: ${error.step}. The signature may be invalid.`
    case "PackingError":
      return "Failed to pack the public key. The key data may be corrupted."
    case "StarknetRpcError":
      return "Network error communicating with Starknet. Check your connection and try again."
    case "AccountDeployError":
      if (error.message.includes("INSUFFICIENT_ACCOUNT_BALANCE")) {
        return "Not enough STRK to cover deployment gas. Add more funds and try again."
      }
      if (error.message.includes("CONTRACT_ALREADY_DEPLOYED") || error.message.includes("already deployed")) {
        return "This account is already deployed. You can start using it."
      }
      return `Deployment failed: ${error.message}`
    case "InsufficientFundsError":
      return `Insufficient STRK balance at ${error.address.slice(0, 10)}\u2026${error.address.slice(-4)}. Send at least ${error.required} wei to continue.`
    case "TransactionSignError":
      return "Transaction signing was cancelled or failed."
    case "TransactionSubmitError":
      if (error.message.includes("nonce")) {
        return "Transaction nonce conflict. Wait for your previous transaction to confirm, then try again."
      }
      if (error.message.includes("INSUFFICIENT")) {
        return "Insufficient balance to cover this transfer and gas fees."
      }
      return `Transaction failed: ${error.message}`
    case "DevnetFetchError":
      return "Could not connect to local devnet. Make sure starknet-devnet is running on port 5050."
    default:
      return "An unexpected error occurred. Check the browser console for details."
  }
}

export function extractUserMessage<A, E extends { readonly _tag: string; readonly message: string }>(
  exit: Exit.Exit<A, E>,
  fallback: string,
): string {
  if (Exit.isSuccess(exit)) return fallback
  const failure = Cause.failureOption(exit.cause)
  return Option.match(failure, {
    onNone: () => fallback,
    onSome: (error) => mapErrorToUserMessage(error as unknown as AppError),
  })
}
