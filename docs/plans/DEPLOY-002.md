# DEPLOY-002: StarknetService — Replace Type Assertions with Schema.decode

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all unsafe `as ContractAddress` / `as TxHash` type assertions from StarknetService and test files, replacing them with proper `Schema.brand` `.make()` constructors. Extract the inline STRK token address to a named constant. No `Generator<any, ..., any>` annotations.

**Architecture:** The service already uses `Effect.Service` with `accessors: true`, `Schema.TaggedError` errors, and `Effect.fn` tracing. This ticket is a focused refactoring — we keep the existing service shape and fix how branded values are constructed. The branded schemas `TxHash` and `ContractAddress` already exist in `types.ts` with `Schema.brand()` — we use their `.make()` constructor (which is available on all branded schemas) instead of `as` casts.

**Tech Stack:** Effect-TS, starknet.js v9, bun:test

---

## Inventory of Changes

| Location | Line(s) | Current Code | Replacement |
|----------|---------|-------------|-------------|
| `StarknetService.ts` | 32 | `return address as ContractAddress` | `return ContractAddress.make(address)` |
| `StarknetService.ts` | 93 | `txHash: result.transaction_hash as TxHash` | `txHash: TxHash.make(result.transaction_hash)` |
| `StarknetService.ts` | 94 | `address: result.contract_address as ContractAddress` | `address: ContractAddress.make(result.contract_address)` |
| `StarknetService.ts` | 43 | Inline `"0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"` | Extract to `STRK_TOKEN_ADDRESS` constant |
| `starknet-service.test.ts` | 30 | `"0x049d..." as ContractAddress` | `ContractAddress.make("0x049d...")` |
| `starknet-service.test.ts` | 31 | `"0x7f3e..." as TxHash` | `TxHash.make("0x7f3e...")` |
| `account-deploy-flow.test.ts` | 55 | `"0x049d..." as ContractAddress` | `ContractAddress.make("0x049d...")` |
| `account-deploy-flow.test.ts` | 56 | `"0x7f3e..." as TxHash` | `TxHash.make("0x7f3e...")` |
| `tests/atoms/starknet.test.ts` | 114 | `"0xdeadbeef" as any` | `ContractAddress.make("0xdeadbeef")` |
| `tests/atoms/starknet.test.ts` | 132 | `"0xcafebabedeadbeef" as any` | `TxHash.make("0xcafebabedeadbeef")` |

## Why `.make()` Over `Schema.decodeSync()`

Both work for branded string types. `.make()` is preferable here because:
1. It's synchronous and doesn't throw — branded string schemas have no validation logic to fail
2. It's more concise: `ContractAddress.make(x)` vs `Schema.decodeSync(ContractAddress)(x)`
3. It's the idiomatic Effect-TS pattern for constructing branded values from trusted sources (starknet.js return values are already validated hex strings)

`Schema.decodeSync()` would be preferred if we had custom validation (e.g., regex check for `0x` prefix), but the branded schemas in `types.ts` are pure `Schema.String.pipe(Schema.brand(...))` — no validation pipeline.

---

## Task 1: Add STRK_TOKEN_ADDRESS Constant — Tests First

**Files:**
- Modify: `apps/demo/src/__tests__/effect-services/starknet-service.test.ts`
- Modify: `apps/demo/src/services/StarknetService.ts`

### Step 1: Write test that the STRK constant is exported and correct

Add a test to `starknet-service.test.ts` that imports and validates the constant:

```typescript
// At the top of starknet-service.test.ts, add to imports:
import { STRK_TOKEN_ADDRESS } from "../../services/StarknetService"

// New describe block at the bottom:
describe("STRK_TOKEN_ADDRESS constant", () => {
  it("is the correct mainnet STRK token address", () => {
    expect(STRK_TOKEN_ADDRESS).toBe(
      "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    )
  })

  it("is a 0x-prefixed hex string", () => {
    expect(STRK_TOKEN_ADDRESS.startsWith("0x")).toBe(true)
  })
})
```

### Step 2: Run test — verify it fails

```bash
cd apps/demo && bun test src/__tests__/effect-services/starknet-service.test.ts --no-color
```

Expected: FAIL — `STRK_TOKEN_ADDRESS` is not exported from `StarknetService.ts`.

### Step 3: Extract the constant and export it

In `apps/demo/src/services/StarknetService.ts`, add the exported constant and replace the inline usage:

```typescript
// At top of file, after imports:
/** STRK token contract address on Starknet mainnet */
export const STRK_TOKEN_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
```

Then in the `getBalance` method, replace the inline string:

```typescript
// Before (line 43):
contractAddress:
  // STRK token on mainnet
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",

// After:
contractAddress: STRK_TOKEN_ADDRESS,
```

### Step 4: Run test — verify it passes

```bash
cd apps/demo && bun test src/__tests__/effect-services/starknet-service.test.ts --no-color
```

Expected: All tests PASS (24 existing + 2 new = 26).

### Step 5: Commit

```bash
jj new && jj describe -m "refactor(account-deploy): extract STRK_TOKEN_ADDRESS constant from StarknetService"
```

---

## Task 2: Replace `as ContractAddress` / `as TxHash` in StarknetService — Tests First

**Files:**
- Modify: `apps/demo/src/__tests__/effect-services/starknet-service.test.ts`
- Modify: `apps/demo/src/services/StarknetService.ts`

### Step 1: Write test that branded values roundtrip through Schema.decodeSync

Add a test to `starknet-service.test.ts` that verifies the returned values carry the brand symbol. This strengthens the existing tests:

```typescript
import { Schema } from "effect"
import { TxHash, ContractAddress } from "../../services/types"

// Add to the "StarknetService.computeDeployAddress (real implementation)" describe:
it("returned value roundtrips through Schema.decodeSync(ContractAddress)", async () => {
  const withTestConfig = ConfigProvider.fromMap(
    new Map([["NEXT_PUBLIC_STARKNET_RPC_URL", "http://localhost:9999"]]),
  )
  const exit = await Effect.runPromiseExit(
    StarknetService.computeDeployAddress({
      slots: Array.from({ length: 29 }, (_, i) => `0x${i.toString(16).padStart(64, "0")}`),
    }).pipe(
      Effect.provide(StarknetService.Default),
      Effect.provide(Layer.setConfigProvider(withTestConfig)),
    ),
  )
  expect(Exit.isSuccess(exit)).toBe(true)
  if (Exit.isSuccess(exit)) {
    // Verify it roundtrips through Schema.decodeSync without throwing
    // (only possible if the brand was applied correctly via .make())
    const decoded = Schema.decodeSync(ContractAddress)(exit.value)
    expect(decoded).toBe(exit.value)
  }
})
```

### Step 2: Run test — verify behavior

```bash
cd apps/demo && bun test src/__tests__/effect-services/starknet-service.test.ts --no-color
```

Note: This test may pass even with `as` casts since brand checking is structural. The test still validates the contract — what matters is the implementation fix.

### Step 3: Replace all type assertions in StarknetService.ts

In `apps/demo/src/services/StarknetService.ts`:

**Import the branded constructors:**

```typescript
// Change:
import type { TxHash, ContractAddress, PackedPublicKey } from "./types"

// To:
import { TxHash, ContractAddress } from "./types"
import type { PackedPublicKey } from "./types"
```

**Replace line 32 in `computeDeployAddress`:**

```typescript
// Before:
return address as ContractAddress

// After:
return ContractAddress.make(address)
```

**Replace lines 93-94 in `deployAccount`:**

```typescript
// Before:
return {
  txHash: result.transaction_hash as TxHash,
  address: result.contract_address as ContractAddress,
}

// After:
return {
  txHash: TxHash.make(result.transaction_hash),
  address: ContractAddress.make(result.contract_address),
}
```

### Step 4: Run ALL effect-services tests

```bash
cd apps/demo && bun test src/__tests__/effect-services/ --no-color
```

Expected: All tests PASS.

### Step 5: Commit

```bash
jj new && jj describe -m "refactor(account-deploy): replace as-casts with .make() brand constructors in StarknetService"
```

---

## Task 3: Replace `as ContractAddress` / `as TxHash` in Test Fixtures

**Files:**
- Modify: `apps/demo/src/__tests__/effect-services/starknet-service.test.ts`
- Modify: `apps/demo/src/__tests__/account-deploy/account-deploy-flow.test.ts`
- Modify: `apps/demo/tests/atoms/starknet.test.ts`

### Step 1: Fix `starknet-service.test.ts` fixtures

```typescript
// Change the import to value imports (not type-only):
import { TxHash, ContractAddress } from "../../services/types"
// (Remove any `import type { TxHash, ContractAddress }` line)

// Change line 30:
// Before:
const mockAddress = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" as ContractAddress

// After:
const mockAddress = ContractAddress.make("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7")

// Change line 31:
// Before:
const mockTxHash = "0x7f3e2a1b9c4d5e6f" as TxHash

// After:
const mockTxHash = TxHash.make("0x7f3e2a1b9c4d5e6f")
```

### Step 2: Fix `account-deploy-flow.test.ts` fixtures

```typescript
// Change type-only imports to value imports:
import { TxHash, ContractAddress } from "../../services/types"
// Keep: import type { PackedPublicKey } from "../../services/types"

// Change line 55:
// Before:
const MOCK_ADDRESS = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" as ContractAddress

// After:
const MOCK_ADDRESS = ContractAddress.make("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7")

// Change line 56:
// Before:
const MOCK_TX_HASH = "0x7f3e2a1b9c4d5e6f0a1b2c3d4e5f6a7b" as TxHash

// After:
const MOCK_TX_HASH = TxHash.make("0x7f3e2a1b9c4d5e6f0a1b2c3d4e5f6a7b")
```

### Step 3: Fix `tests/atoms/starknet.test.ts` fixtures

```typescript
// Add value import at top:
import { TxHash, ContractAddress } from "../../src/services/types"

// Change line 114 (remove the "as any" comment):
// Before:
// Use 'as any' because ContractAddress is a branded type requiring Schema.decode
const addr = "0xdeadbeef" as any

// After:
const addr = ContractAddress.make("0xdeadbeef")

// Change line 132:
// Before:
const txHash = "0xcafebabedeadbeef" as any

// After:
const txHash = TxHash.make("0xcafebabedeadbeef")
```

### Step 4: Run ALL tests to verify nothing broke

```bash
cd apps/demo && bun test src/__tests__/effect-services/ src/__tests__/account-deploy/ tests/atoms/starknet.test.ts --no-color
```

Expected: All tests PASS (26 + 44 + 9 = 79 total).

### Step 5: Run the full test suite

```bash
cd apps/demo && bun test --no-color
```

Expected: All tests PASS.

### Step 6: Commit

```bash
jj new && jj describe -m "refactor(account-deploy): replace as-casts with .make() brand constructors in all test files"
```

---

## Task 4: Final Verification — TypeScript Strict Check + Grep Audit

**Files:** None modified — verification only.

### Step 1: TypeScript type check

```bash
cd apps/demo && bunx tsc --noEmit
```

Expected: No type errors.

### Step 2: Grep for remaining `as ContractAddress` or `as TxHash`

```bash
grep -rn "as ContractAddress\|as TxHash" apps/demo/src/ apps/demo/tests/
```

Expected: Zero results. If any remain, go back and fix them.

### Step 3: Grep for remaining `as any` in test fixtures

```bash
grep -rn "as any" apps/demo/src/__tests__/effect-services/ apps/demo/src/__tests__/account-deploy/ apps/demo/tests/atoms/starknet.test.ts
```

Expected: Only the `provider: {} as any` and mock layer `as any` casts remain (these are intentional for mock services — the provider is not typed). No branded-type `as any` casts should remain.

### Step 4: Grep for Generator annotations

```bash
grep -rn "Generator<any" apps/demo/src/services/
```

Expected: Zero results. (Research confirmed none exist currently.)

### Step 5: Grep for inline STRK address

```bash
grep -rn "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" apps/demo/src/services/
```

Expected: Only in the `STRK_TOKEN_ADDRESS` constant definition, not inline in method body.

### Step 6: Run full test suite one final time

```bash
cd apps/demo && bun test --no-color
```

Expected: All tests PASS.

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `.make()` not available on branded schema | Very Low | High — plan is wrong | Verified in REPL: `Schema.String.pipe(Schema.brand("X")).make("val")` works. Fallback: use `Schema.decodeSync(TxHash)(val)` |
| Brand symbol breaks `Exit.isSuccess` value checks | Very Low | Medium — tests fail on comparison | `.make()` returns the same string value; brand is structural. `toBe()` string comparison still works |
| `as any` on mock `provider` causes confusion | Low | Low — just noise | Add `// eslint-disable-next-line` comments explaining these are intentional mock casts |
| Forgetting a file with `as` casts | Low | Medium — ticket incomplete | Task 4 grep audit catches any stragglers |

## Verification Against Acceptance Criteria

| Criterion | How Verified |
|-----------|-------------|
| No `as ContractAddress` or `as TxHash` assertions | Task 4 Step 2: grep returns zero |
| No `Generator<any, ..., any>` annotations | Task 4 Step 4: grep returns zero |
| STRK token address extracted to named constant | Task 1: `STRK_TOKEN_ADDRESS` exported and tested |
| All existing tests still pass | Tasks 1-4: `bun test` at each step |
| Schema.TaggedError errors unchanged | No modifications to `errors.ts` |
| Effect.Service with accessors pattern preserved | No structural changes to service shape |
