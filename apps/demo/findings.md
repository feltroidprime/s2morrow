## effect-services

### Status: RUNNING

### What works:
- All 9 Schema.TaggedError types are constructable and matchable by `_tag`:
  - `WasmLoadError`, `KeygenError`, `SigningError`, `VerificationError`, `HintGenerationError`, `PackingError` (tested in `verify-playground/errors.test.ts`)
  - `StarknetRpcError`, `AccountDeployError`, `InsufficientFundsError` (tested in `effect-services/starknet-errors.test.ts`)
- All `Schema.TaggedError` instances roundtrip through `Effect.runPromiseExit` with correct `Exit.isFailure` + `Cause.failureOption` behavior
- All errors can be caught with `Effect.catchTag` using the `_tag` string
- `FalconService` — all 5 methods (generateKeypair, sign, verify, createHint, packPublicKey) have success + failure tests via mock `WasmRuntime` layer (`Effect.runPromiseExit` + `Exit.isSuccess/isFailure`)
- `WasmRuntime` — `Context.Tag` pattern works correctly; `Layer.succeed(WasmRuntime, mockWasm)` provides a mock without touching the file system
- `StarknetService` — all 4 methods (computeDeployAddress, getBalance, deployAccount, waitForTx) have success + failure tests via mock `Layer.succeed`
- `StarknetService.computeDeployAddress` tested with **real implementation** (pure computation — no network): returns a hex address string using starknet.js `hash.calculateContractAddressFromHash`
- `StarknetService.Default` fails gracefully when `NEXT_PUBLIC_STARKNET_RPC_URL` config is missing
- TypeScript typecheck (`bun run typecheck`) passes with zero errors
- **Total effect-services tests: 70 passing, 0 failing**

### What was tried:
1. Discovered `FalconService.ts` had `dependencies: [WasmRuntimeLive]` baked in, which prevented mock injection; removed it so `FalconService.Default` requires `WasmRuntime` from callers (production: `Layer.provide(WasmRuntimeLive)`, tests: `Layer.succeed(WasmRuntime, mockWasm)`)
2. Created `StarknetService.ts` with starknet v9.2.1 API (`Account` constructor now takes `AccountOptions` object, not `(provider, address, key)`)
3. Added `starknet@9.2.1` to `package.json` and installed
4. Updated `tsconfig.json` target from `ES2017` → `ES2020` for BigInt literal support
5. Fixed pre-existing type issue in `verify-playground/atoms.test.ts` (cast to `any` instead of `Parameters<typeof registry.set>[1]`)
6. Cleared `tsconfig.tsbuildinfo` to fix stale incremental build cache errors
7. Removed unused `InsufficientFundsError` import from `StarknetService.ts` (service doesn't currently raise it; the type exists in `errors.ts`)

### What's blocked:
- `WasmRuntimeLive` (the live WASM loader) cannot be tested in bun test environment because:
  1. `/wasm/falcon_rs.js` doesn't exist (WASM bindings not yet built — Task 2 pending)
  2. Dynamic ESM import from absolute `/wasm/...` path is browser-only and unsupported in Bun
- `FalconService` method tests use mock `WasmModule` only — real WASM integration tests require the `wasm` focus to be completed first
- `StarknetService` network methods (getBalance, deployAccount, waitForTx) cannot be integration-tested without a live RPC endpoint

### Needs human intervention:
- None for unit tests. Integration against real RPC requires running Starknet devnet or providing a test RPC URL.

### Suggested tickets:
- **`effect-services/wasm-integration`**: Once `wasm` focus completes WASM build, add integration test that runs `FalconService.generateKeypair` with the real WASM module in a browser-like environment (e.g., using a JSDOM or Playwright test)
- **`effect-services/starknet-devnet`**: Add integration tests for `StarknetService.getBalance` / `deployAccount` against starknet-devnet with a test ConfigProvider
- **`effect-services/wasm-runtime-live`**: Test `WasmRuntimeLive` Layer directly once `/wasm/falcon_rs.js` is built — verify it loads, caches, and returns a `WasmModule` with correct method signatures
- **`effect-services/falcon-account-class-hash`**: `FALCON_ACCOUNT_CLASS_HASH = "0x0"` is a placeholder; update when FalconAccount contract is declared on mainnet/testnet
