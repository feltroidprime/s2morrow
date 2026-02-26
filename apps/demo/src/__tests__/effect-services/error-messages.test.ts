import { describe, it, expect } from "bun:test"
import { Effect, Exit } from "effect"
import {
  mapErrorToUserMessage,
  extractUserMessage,
} from "../../services/error-messages"
import {
  WasmLoadError,
  KeygenError,
  SigningError,
  VerificationError,
  PackingError,
  StarknetRpcError,
  AccountDeployError,
  InsufficientFundsError,
  TransactionSignError,
  TransactionSubmitError,
  DevnetFetchError,
} from "../../services/errors"

describe("mapErrorToUserMessage", () => {
  it("maps WasmLoadError", () => {
    const msg = mapErrorToUserMessage(new WasmLoadError({ message: "x" }))
    expect(msg).toContain("cryptography module")
  })

  it("maps KeygenError", () => {
    const msg = mapErrorToUserMessage(new KeygenError({ message: "x" }))
    expect(msg).toContain("Keypair generation")
  })

  it("maps SigningError", () => {
    const msg = mapErrorToUserMessage(new SigningError({ message: "x" }))
    expect(msg).toContain("Signing failed")
  })

  it("maps VerificationError with step", () => {
    const msg = mapErrorToUserMessage(
      new VerificationError({ message: "x", step: "norm-check" }),
    )
    expect(msg).toContain("norm-check")
  })

  it("maps PackingError", () => {
    const msg = mapErrorToUserMessage(new PackingError({ message: "x" }))
    expect(msg).toContain("pack the public key")
  })

  it("maps StarknetRpcError", () => {
    const msg = mapErrorToUserMessage(
      new StarknetRpcError({ message: "x", code: 500 }),
    )
    expect(msg).toContain("Network error")
  })

  it("maps AccountDeployError with INSUFFICIENT_ACCOUNT_BALANCE", () => {
    const msg = mapErrorToUserMessage(
      new AccountDeployError({ message: "INSUFFICIENT_ACCOUNT_BALANCE" }),
    )
    expect(msg).toContain("Not enough STRK")
  })

  it("maps AccountDeployError with CONTRACT_ALREADY_DEPLOYED", () => {
    const msg = mapErrorToUserMessage(
      new AccountDeployError({ message: "CONTRACT_ALREADY_DEPLOYED" }),
    )
    expect(msg).toContain("already deployed")
  })

  it("maps AccountDeployError with generic message", () => {
    const msg = mapErrorToUserMessage(
      new AccountDeployError({ message: "something else" }),
    )
    expect(msg).toContain("Deployment failed")
    expect(msg).toContain("something else")
  })

  it("maps InsufficientFundsError with truncated address", () => {
    const msg = mapErrorToUserMessage(
      new InsufficientFundsError({
        message: "x",
        address: "0x1234567890abcdef1234567890abcdef",
        required: "1000000",
      }),
    )
    expect(msg).toContain("Insufficient STRK")
    expect(msg).toContain("1000000")
  })

  it("maps TransactionSignError", () => {
    const msg = mapErrorToUserMessage(
      new TransactionSignError({ message: "x" }),
    )
    expect(msg).toContain("signing was cancelled")
  })

  it("maps TransactionSubmitError with nonce conflict", () => {
    const msg = mapErrorToUserMessage(
      new TransactionSubmitError({ message: "nonce mismatch" }),
    )
    expect(msg).toContain("nonce conflict")
  })

  it("maps TransactionSubmitError with INSUFFICIENT balance", () => {
    const msg = mapErrorToUserMessage(
      new TransactionSubmitError({ message: "INSUFFICIENT balance" }),
    )
    expect(msg).toContain("Insufficient balance")
  })

  it("maps TransactionSubmitError with generic message", () => {
    const msg = mapErrorToUserMessage(
      new TransactionSubmitError({ message: "unknown failure" }),
    )
    expect(msg).toContain("Transaction failed")
    expect(msg).toContain("unknown failure")
  })

  it("maps DevnetFetchError", () => {
    const msg = mapErrorToUserMessage(
      new DevnetFetchError({ message: "x" }),
    )
    expect(msg).toContain("local devnet")
  })
})

describe("extractUserMessage", () => {
  it("returns fallback for successful exit", async () => {
    const exit = await Effect.runPromiseExit(Effect.succeed("ok"))
    const msg = extractUserMessage(exit, "fallback")
    expect(msg).toBe("fallback")
  })

  it("extracts user message from failed exit", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(new WasmLoadError({ message: "oops" })),
    )
    const msg = extractUserMessage(exit, "fallback")
    expect(msg).toContain("cryptography module")
  })

  it("returns fallback for defect (no typed failure)", async () => {
    const exit: Exit.Exit<never, { _tag: string; message: string }> =
      Exit.die("unexpected")
    const msg = extractUserMessage(exit, "fallback")
    expect(msg).toBe("fallback")
  })
})
