/**
 * Tests for Starknet-specific Schema.TaggedError classes.
 *
 * Coverage requirements:
 * - Every Schema.TaggedError must be constructable and matchable
 * - _tag must equal the class name string
 * - Errors must roundtrip through Effect failure/exit
 */

import { describe, it, expect } from "bun:test"
import { Effect, Exit, Cause } from "effect"
import {
  StarknetRpcError,
  AccountDeployError,
  InsufficientFundsError,
} from "../../services/errors"

describe("StarknetRpcError", () => {
  it("is constructable with message and code", () => {
    const err = new StarknetRpcError({
      message: "RPC call failed",
      code: -32000,
    })
    expect(err.message).toBe("RPC call failed")
    expect(err.code).toBe(-32000)
    expect(err._tag).toBe("StarknetRpcError")
  })

  it("roundtrips through Effect.runPromiseExit", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(new StarknetRpcError({ message: "connection refused", code: -1 })),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(Exit.isSuccess(exit)).toBe(false)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(err._tag).toBe("Some")
      // @ts-expect-error — Option.Some wraps the error
      expect(err.value._tag).toBe("StarknetRpcError")
      // @ts-expect-error
      expect(err.value.code).toBe(-1)
    }
  })

  it("can be caught with catchTag", async () => {
    let caughtCode = 0
    await Effect.runPromise(
      Effect.fail(new StarknetRpcError({ message: "bad request", code: 400 })).pipe(
        Effect.catchTag("StarknetRpcError", (e) => {
          caughtCode = e.code
          return Effect.succeed(null)
        }),
      ),
    )
    expect(caughtCode).toBe(400)
  })

  it("_tag is 'StarknetRpcError' (not 'Error' or undefined)", () => {
    const err = new StarknetRpcError({ message: "x", code: 0 })
    expect(err._tag).toBe("StarknetRpcError")
    expect(err._tag).not.toBe("Error")
  })

  it("preserves code=0 (zero is valid, not falsy-filtered)", () => {
    const err = new StarknetRpcError({ message: "ok", code: 0 })
    expect(err.code).toBe(0)
  })
})

describe("AccountDeployError", () => {
  it("is constructable with message only (txHash optional)", () => {
    const err = new AccountDeployError({ message: "deploy failed" })
    expect(err.message).toBe("deploy failed")
    expect(err._tag).toBe("AccountDeployError")
    expect(err.txHash).toBeUndefined()
  })

  it("is constructable with message and txHash", () => {
    const err = new AccountDeployError({
      message: "tx reverted",
      txHash: "0xcafebeef",
    })
    expect(err.message).toBe("tx reverted")
    expect(err.txHash).toBe("0xcafebeef")
    expect(err._tag).toBe("AccountDeployError")
  })

  it("roundtrips through Effect.runPromiseExit", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(
        new AccountDeployError({ message: "nonce too low", txHash: "0xabc" }),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      // @ts-expect-error
      expect(err.value._tag).toBe("AccountDeployError")
      // @ts-expect-error
      expect(err.value.txHash).toBe("0xabc")
    }
  })

  it("can be caught with catchTag and txHash is accessible", async () => {
    let caughtHash: string | undefined = undefined
    await Effect.runPromise(
      Effect.fail(
        new AccountDeployError({ message: "failed", txHash: "0xdeadbeef" }),
      ).pipe(
        Effect.catchTag("AccountDeployError", (e) => {
          caughtHash = e.txHash
          return Effect.succeed(null)
        }),
      ),
    )
    expect(caughtHash!).toBe("0xdeadbeef")
  })

  it("succeeds in an effect chain when no error is thrown", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.succeed({ txHash: "0x123", address: "0xabc" }),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})

describe("InsufficientFundsError", () => {
  it("is constructable with message, address, and required", () => {
    const err = new InsufficientFundsError({
      message: "need more ETH",
      address: "0x1234",
      required: "1000000000000000000",
    })
    expect(err.message).toBe("need more ETH")
    expect(err.address).toBe("0x1234")
    expect(err.required).toBe("1000000000000000000")
    expect(err._tag).toBe("InsufficientFundsError")
  })

  it("roundtrips through Effect.runPromiseExit", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(
        new InsufficientFundsError({
          message: "balance too low",
          address: "0xbeef",
          required: "500",
        }),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      // @ts-expect-error
      expect(err.value._tag).toBe("InsufficientFundsError")
      // @ts-expect-error
      expect(err.value.address).toBe("0xbeef")
    }
  })

  it("can be caught with catchTag and address is accessible", async () => {
    let caughtAddress = ""
    await Effect.runPromise(
      Effect.fail(
        new InsufficientFundsError({
          message: "not enough",
          address: "0xfeed",
          required: "999",
        }),
      ).pipe(
        Effect.catchTag("InsufficientFundsError", (e) => {
          caughtAddress = e.address
          return Effect.succeed(null)
        }),
      ),
    )
    expect(caughtAddress).toBe("0xfeed")
  })

  it("is distinct from StarknetRpcError (different _tag)", () => {
    const rpcErr = new StarknetRpcError({ message: "x", code: 0 })
    const fundsErr = new InsufficientFundsError({
      message: "y",
      address: "0x0",
      required: "0",
    })
    expect(rpcErr._tag).not.toBe(fundsErr._tag)
    expect(fundsErr._tag).toBe("InsufficientFundsError")
  })
})
