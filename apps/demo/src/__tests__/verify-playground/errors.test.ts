/**
 * Tests for verify-playground Schema.TaggedError classes.
 *
 * Coverage requirements:
 * - Every Schema.TaggedError must be constructable and matchable
 * - _tag must equal the class name string
 */

import { describe, it, expect } from "bun:test"
import { Effect, Exit, Cause, Option } from "effect"
import {
  WasmLoadError,
  KeygenError,
  SigningError,
  VerificationError,
  HintGenerationError,
  PackingError,
} from "../../services/errors"

describe("WasmLoadError", () => {
  it("is constructable with a message", () => {
    const err = new WasmLoadError({ message: "failed to load wasm" })
    expect(err.message).toBe("failed to load wasm")
    expect(err._tag).toBe("WasmLoadError")
  })

  it("can be used as Effect failure and matched by _tag", async () => {
    const effect = Effect.fail(
      new WasmLoadError({ message: "module missing" }),
    )
    const exit = await Effect.runPromiseExit(effect)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("WasmLoadError")
        expect(err.value.message).toBe("module missing")
      }
    }
  })

  it("can be caught with catchTag", async () => {
    let caught = false
    const effect = Effect.fail(
      new WasmLoadError({ message: "oops" }),
    ).pipe(
      Effect.catchTag("WasmLoadError", () => {
        caught = true
        return Effect.succeed("recovered")
      }),
    )
    const result = await Effect.runPromise(effect)
    expect(result).toBe("recovered")
    expect(caught).toBe(true)
  })
})

describe("KeygenError", () => {
  it("is constructable with a message", () => {
    const err = new KeygenError({ message: "keygen failed" })
    expect(err.message).toBe("keygen failed")
    expect(err._tag).toBe("KeygenError")
  })

  it("roundtrips through Effect failure", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(new KeygenError({ message: "seed error" })),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const err = Cause.failureOption(exit.cause)
      expect(Option.isSome(err)).toBe(true)
      if (Option.isSome(err)) {
        expect(err.value._tag).toBe("KeygenError")
      }
    }
  })
})

describe("SigningError", () => {
  it("is constructable with a message", () => {
    const err = new SigningError({ message: "signing failed" })
    expect(err.message).toBe("signing failed")
    expect(err._tag).toBe("SigningError")
  })

  it("roundtrips through Effect failure", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(new SigningError({ message: "sig err" })),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })
})

describe("VerificationError", () => {
  it("is constructable with message and step", () => {
    const err = new VerificationError({
      message: "norm check failed",
      step: "norm-check",
    })
    expect(err.message).toBe("norm check failed")
    expect(err.step).toBe("norm-check")
    expect(err._tag).toBe("VerificationError")
  })

  it("can be caught by _tag", async () => {
    let caughtStep = ""
    await Effect.runPromise(
      Effect.fail(
        new VerificationError({ message: "bad sig", step: "verify" }),
      ).pipe(
        Effect.catchTag("VerificationError", (e) => {
          caughtStep = e.step
          return Effect.succeed(null)
        }),
      ),
    )
    expect(caughtStep).toBe("verify")
  })
})

describe("HintGenerationError", () => {
  it("is constructable with a message", () => {
    const err = new HintGenerationError({ message: "hint failed" })
    expect(err.message).toBe("hint failed")
    expect(err._tag).toBe("HintGenerationError")
  })

  it("fails the effect on failure", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(new HintGenerationError({ message: "ntt error" })),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(Exit.isSuccess(exit)).toBe(false)
  })
})

describe("PackingError", () => {
  it("is constructable with a message", () => {
    const err = new PackingError({ message: "pack failed" })
    expect(err.message).toBe("pack failed")
    expect(err._tag).toBe("PackingError")
  })

  it("fails the effect on failure", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.fail(new PackingError({ message: "slots error" })),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
