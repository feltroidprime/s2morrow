/**
 * Tests for WasmRuntime — effect-services category (ES-003).
 *
 * Strategy:
 * 1. Unit tests for isValidWasmModule (runtime type guard) — validate that it
 *    correctly rejects null, missing methods, wrong types, and accepts a full
 *    conformant WasmModule object.
 * 2. Integration tests: inject a mock WasmModule via Layer.succeed and verify
 *    every method is callable without loading the real WASM binary.
 * 3. Integration test for WasmRuntimeLive failure: in the Bun/Node test
 *    environment /wasm/falcon_rs.js cannot be resolved, so the live Layer must
 *    fail cleanly with a WasmLoadError.
 *
 * Coverage requirements per ES-003:
 *  - isValidWasmModule returns false for null, missing methods, wrong types
 *  - isValidWasmModule returns true for a fully-conforming mock module
 *  - WasmRuntimeLive fails with WasmLoadError when WASM cannot be loaded
 *  - A mock layer can be successfully injected and consumed by an Effect
 *
 * Test runner: bun test
 */

import { describe, it, expect } from "bun:test"
import { Effect, Exit, Layer } from "effect"
import {
  WasmRuntime,
  WasmRuntimeLive,
  isValidWasmModule,
} from "../WasmRuntime"
import type { WasmModule } from "../WasmRuntime"
import { WasmLoadError } from "../errors"

// ---------------------------------------------------------------------------
// Mock WasmModule factory
// ---------------------------------------------------------------------------

/** Creates a fully-conformant WasmModule with all required methods. */
const makeMockWasmModule = (): WasmModule => ({
  keygen: (_seed: Uint8Array) => ({ sk: new Uint8Array(0), vk: new Uint8Array(0) }),
  sign: (_sk: Uint8Array, _msg: Uint8Array, _salt: Uint8Array) => ({
    signature: new Uint8Array(0),
    salt: new Uint8Array(0),
  }),
  verify: (_vk: Uint8Array, _msg: Uint8Array, _sig: Uint8Array) => true,
  create_verification_hint: (_s1: Int32Array, _pkNtt: Int32Array) =>
    new Uint16Array(0),
  pack_public_key_wasm: (_pkNtt: Uint16Array) => [],
  public_key_length: () => 896,
  salt_length: () => 40,
  sign_for_starknet: (_sk: Uint8Array, _txHash: string, _pkNtt: Int32Array) => [],
})

// ---------------------------------------------------------------------------
// Unit tests: isValidWasmModule
// ---------------------------------------------------------------------------

describe("isValidWasmModule", () => {
  it("returns false for null", () => {
    expect(isValidWasmModule(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isValidWasmModule(undefined)).toBe(false)
  })

  it("returns false for a number", () => {
    expect(isValidWasmModule(42)).toBe(false)
  })

  it("returns false for a string", () => {
    expect(isValidWasmModule("wasm")).toBe(false)
  })

  it("returns false for an empty object", () => {
    expect(isValidWasmModule({})).toBe(false)
  })

  it("returns false when keygen is missing", () => {
    const { keygen: _keygen, ...rest } = makeMockWasmModule()
    expect(isValidWasmModule(rest)).toBe(false)
  })

  it("returns false when sign is missing", () => {
    const { sign: _sign, ...rest } = makeMockWasmModule()
    expect(isValidWasmModule(rest)).toBe(false)
  })

  it("returns false when verify is missing", () => {
    const { verify: _verify, ...rest } = makeMockWasmModule()
    expect(isValidWasmModule(rest)).toBe(false)
  })

  it("returns false when create_verification_hint is missing", () => {
    const { create_verification_hint: _, ...rest } = makeMockWasmModule()
    expect(isValidWasmModule(rest)).toBe(false)
  })

  it("returns false when pack_public_key_wasm is missing", () => {
    const { pack_public_key_wasm: _, ...rest } = makeMockWasmModule()
    expect(isValidWasmModule(rest)).toBe(false)
  })

  it("returns false when public_key_length is missing", () => {
    const { public_key_length: _, ...rest } = makeMockWasmModule()
    expect(isValidWasmModule(rest)).toBe(false)
  })

  it("returns false when salt_length is missing", () => {
    const { salt_length: _, ...rest } = makeMockWasmModule()
    expect(isValidWasmModule(rest)).toBe(false)
  })

  it("returns false when keygen is a string instead of a function", () => {
    const mod = { ...makeMockWasmModule(), keygen: "not-a-function" }
    expect(isValidWasmModule(mod)).toBe(false)
  })

  it("returns false when verify is a number instead of a function", () => {
    const mod = { ...makeMockWasmModule(), verify: 42 }
    expect(isValidWasmModule(mod)).toBe(false)
  })

  it("returns false when sign is null instead of a function", () => {
    const mod = { ...makeMockWasmModule(), sign: null }
    expect(isValidWasmModule(mod)).toBe(false)
  })

  it("returns true for a complete valid WasmModule", () => {
    expect(isValidWasmModule(makeMockWasmModule())).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Integration tests: Layer.succeed injection
// ---------------------------------------------------------------------------

/** Helper: run an effect with WasmRuntime provided by a Layer. */
async function runWithWasm<A, E>(
  effect: Effect.Effect<A, E, WasmRuntime>,
  layer: Layer.Layer<WasmRuntime>,
): Promise<Exit.Exit<A, E>> {
  return Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
}

describe("WasmRuntime Layer injection (mock)", () => {
  it("resolves mock WasmModule via Layer.succeed", async () => {
    const layer = Layer.succeed(WasmRuntime, makeMockWasmModule())
    const exit = await runWithWasm(
      Effect.gen(function* () {
        const wasm = yield* WasmRuntime
        return wasm.public_key_length()
      }),
      layer,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(896)
    }
  })

  it("resolves salt_length from the injected module", async () => {
    const layer = Layer.succeed(WasmRuntime, makeMockWasmModule())
    const exit = await runWithWasm(
      Effect.gen(function* () {
        const wasm = yield* WasmRuntime
        return wasm.salt_length()
      }),
      layer,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(40)
    }
  })

  it("calls keygen through the injected Layer", async () => {
    const layer = Layer.succeed(WasmRuntime, makeMockWasmModule())
    const exit = await runWithWasm(
      Effect.gen(function* () {
        const wasm = yield* WasmRuntime
        return wasm.keygen(new Uint8Array(32))
      }),
      layer,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toHaveProperty("sk")
      expect(exit.value).toHaveProperty("vk")
    }
  })

  it("calls sign through the injected Layer", async () => {
    const layer = Layer.succeed(WasmRuntime, makeMockWasmModule())
    const exit = await runWithWasm(
      Effect.gen(function* () {
        const wasm = yield* WasmRuntime
        return wasm.sign(new Uint8Array(0), new Uint8Array(0), new Uint8Array(0))
      }),
      layer,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toHaveProperty("signature")
      expect(exit.value).toHaveProperty("salt")
    }
  })

  it("calls verify through the injected Layer and returns a boolean", async () => {
    const layer = Layer.succeed(WasmRuntime, makeMockWasmModule())
    const exit = await runWithWasm(
      Effect.gen(function* () {
        const wasm = yield* WasmRuntime
        return wasm.verify(
          new Uint8Array(0),
          new Uint8Array(0),
          new Uint8Array(0),
        )
      }),
      layer,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(typeof exit.value).toBe("boolean")
    }
  })

  it("calls pack_public_key_wasm through the injected Layer", async () => {
    const layer = Layer.succeed(WasmRuntime, makeMockWasmModule())
    const exit = await runWithWasm(
      Effect.gen(function* () {
        const wasm = yield* WasmRuntime
        return wasm.pack_public_key_wasm(new Uint16Array(512))
      }),
      layer,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(Array.isArray(exit.value)).toBe(true)
    }
  })

  it("calls create_verification_hint through the injected Layer", async () => {
    const layer = Layer.succeed(WasmRuntime, makeMockWasmModule())
    const exit = await runWithWasm(
      Effect.gen(function* () {
        const wasm = yield* WasmRuntime
        return wasm.create_verification_hint(new Int32Array(512), new Int32Array(512))
      }),
      layer,
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBeInstanceOf(Uint16Array)
    }
  })
})

// ---------------------------------------------------------------------------
// Integration test: WasmRuntimeLive fails gracefully in test environment
// ---------------------------------------------------------------------------

describe("WasmRuntimeLive", () => {
  it("fails with WasmLoadError when WASM file is absent in test environment", async () => {
    // In the Bun/Node test environment, /wasm/falcon_rs.js cannot be resolved
    // via dynamic import. The tryPromise catch handler wraps the error as
    // WasmLoadError so the failure is always typed, never a raw exception.
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        return yield* WasmRuntime
      }).pipe(Effect.provide(WasmRuntimeLive)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const causeStr = JSON.stringify(exit.cause)
      expect(causeStr).toContain("WasmLoadError")
    }
  })

  it("WasmLoadError from live Layer can be caught with catchTag", async () => {
    let caught = false
    let caughtMessage = ""

    await Effect.runPromise(
      Effect.gen(function* () {
        return yield* WasmRuntime
      }).pipe(
        Effect.provide(WasmRuntimeLive),
        Effect.catchTag("WasmLoadError", (e) => {
          caught = true
          caughtMessage = e.message
          return Effect.succeed(null)
        }),
      ),
    )

    expect(caught).toBe(true)
    expect(caughtMessage.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Structural / architecture tests
// ---------------------------------------------------------------------------

describe("WasmRuntime architecture", () => {
  it("WasmLoadError has _tag 'WasmLoadError'", () => {
    const err = new WasmLoadError({ message: "test" })
    expect(err._tag).toBe("WasmLoadError")
    expect(err.message).toBe("test")
  })

  it("WasmRuntime Tag has key 'WasmRuntime'", () => {
    expect(WasmRuntime.key).toBe("WasmRuntime")
  })
})
