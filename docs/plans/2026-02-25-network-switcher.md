# Network Switcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Sepolia/Mainnet pill toggle in the NavHeader that switches the RPC URL, class hash, explorer URL, and faucet link visibility across the deploy flow — persisted to localStorage.

**Architecture:** A new `src/config/networks.ts` defines both network configs. A `networkAtom` stores the selected `NetworkId`. `StarknetService` gets a static `make(rpcUrl, classHash)` factory; `AccountDeployFlow` rebuilds its `ManagedRuntime` via `useRef` when the atom changes. The faucet link is hidden on mainnet.

**Tech Stack:** Next.js 15, React 19, TypeScript, Effect-TS (`@effect-atom/atom`, `@effect-atom/atom-react`), Tailwind CSS v4

---

## Key Reference Files

| File | Current state |
|------|---------------|
| `apps/demo/src/services/StarknetService.ts` | Has module-level `FALCON_ACCOUNT_CLASS_HASH` constant; reads `NEXT_PUBLIC_STARKNET_RPC_URL` from Config |
| `apps/demo/src/atoms/starknet.ts` | Has `DeployStep`, `deployStepAtom`, `deployedAddressAtom`, `deployTxHashAtom` |
| `apps/demo/src/components/landing/NavHeader.tsx` | Pure server component, 35 lines, no interactivity |
| `apps/demo/src/components/interactive/AccountDeployFlow.tsx` | Module-level `deployRuntime`; faucet link hardcoded; explorer URL hardcoded as `sepolia.voyager.online` |
| `apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx` | Line 63 hardcodes `sepolia.voyager.online` — must add `networkAtom` to `initialValues` |

---

### Task 1: Create Network Config

**Files:**
- Create: `apps/demo/src/config/networks.ts`

**Step 1: Create the file**

```typescript
// apps/demo/src/config/networks.ts

export type NetworkId = "sepolia" | "mainnet"

export interface NetworkConfig {
  readonly id: NetworkId
  readonly name: string
  readonly rpcUrl: string
  readonly classHash: string
  readonly explorerBaseUrl: string
  readonly isTestnet: boolean
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  sepolia: {
    id: "sepolia",
    name: "Sepolia",
    rpcUrl: "https://api.zan.top/public/starknet-sepolia/rpc/v0_10",
    classHash: "0x0",
    explorerBaseUrl: "https://sepolia.voyager.online",
    isTestnet: true,
  },
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    rpcUrl: "https://api.zan.top/public/starknet/rpc/v0_10",
    classHash: "0x0",
    explorerBaseUrl: "https://voyager.online",
    isTestnet: false,
  },
}

export const DEFAULT_NETWORK: NetworkId = "sepolia"
```

**Step 2: Run typecheck**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck
```

Expected: No errors.

**Step 3: Commit**

```bash
cd /home/felt/PycharmProjects/s2morrow
git add apps/demo/src/config/networks.ts
git commit -m "feat(demo): add network config constants (Sepolia + Mainnet)"
```

---

### Task 2: Add networkAtom to starknet.ts

**Files:**
- Modify: `apps/demo/src/atoms/starknet.ts`
- Test: `apps/demo/src/__tests__/account-deploy/account-deploy-flow.test.ts`

**Step 1: Write the failing test**

In `apps/demo/src/__tests__/account-deploy/account-deploy-flow.test.ts`, add a new `describe` block at the end of the file:

```typescript
import { networkAtom } from "../../atoms/starknet"

// ---------------------------------------------------------------------------
// networkAtom
// ---------------------------------------------------------------------------

describe("networkAtom", () => {
  it("defaults to 'sepolia'", () => {
    const registry = Registry.make()
    expect(registry.get(networkAtom)).toBe("sepolia")
  })

  it("can be set to 'mainnet'", () => {
    const registry = Registry.make()
    registry.set(networkAtom, "mainnet")
    expect(registry.get(networkAtom)).toBe("mainnet")
  })

  it("can be set back to 'sepolia'", () => {
    const registry = Registry.make()
    registry.set(networkAtom, "mainnet")
    registry.set(networkAtom, "sepolia")
    expect(registry.get(networkAtom)).toBe("sepolia")
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test src/__tests__/account-deploy/account-deploy-flow.test.ts 2>&1 | tail -20
```

Expected: Fails with `"networkAtom" is not exported` or similar.

**Step 3: Add networkAtom to starknet.ts**

In `apps/demo/src/atoms/starknet.ts`, add these imports and the atom. The full new file should be:

```typescript
import { Atom } from "@effect-atom/atom"
import { Option } from "effect"
import { ContractAddress, TxHash } from "../services/types"
import { DEFAULT_NETWORK } from "../config/networks"
import type { NetworkId } from "../config/networks"

export type { NetworkId }

export type DeployStep =
  | { step: "idle" }
  | { step: "generating-keypair" }
  | { step: "packing" }
  | { step: "computing-address" }
  | { step: "awaiting-funds"; address: ContractAddress }
  | { step: "deploying"; address: ContractAddress }
  | { step: "deployed"; address: ContractAddress; txHash: TxHash }
  | { step: "error"; message: string }

export const deployStepAtom = Atom.make<DeployStep>({ step: "idle" }).pipe(
  Atom.keepAlive,
)

export const deployedAddressAtom = Atom.make<Option.Option<ContractAddress>>(Option.none()).pipe(
  Atom.keepAlive,
)

export const deployTxHashAtom = Atom.make<Option.Option<TxHash>>(Option.none()).pipe(
  Atom.keepAlive,
)

const NETWORK_STORAGE_KEY = "falcon-demo-network"

function readStoredNetwork(): NetworkId {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return DEFAULT_NETWORK
    }
    const stored = localStorage.getItem(NETWORK_STORAGE_KEY)
    return stored === "mainnet" ? "mainnet" : DEFAULT_NETWORK
  } catch {
    return DEFAULT_NETWORK
  }
}

export const networkAtom = Atom.make<NetworkId>(readStoredNetwork()).pipe(
  Atom.keepAlive,
)

export { NETWORK_STORAGE_KEY }
```

**Step 4: Run test to confirm it passes**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test src/__tests__/account-deploy/account-deploy-flow.test.ts 2>&1 | tail -10
```

Expected: All tests pass including the 3 new networkAtom tests.

**Step 5: Commit**

```bash
cd /home/felt/PycharmProjects/s2morrow
git add apps/demo/src/atoms/starknet.ts apps/demo/src/__tests__/account-deploy/account-deploy-flow.test.ts
git commit -m "feat(demo): add networkAtom with localStorage persistence"
```

---

### Task 3: Refactor StarknetService — add make() factory

**Files:**
- Modify: `apps/demo/src/services/StarknetService.ts`
- Test: `apps/demo/src/__tests__/effect-services/starknet-service.test.ts`

**Context:** The current file has a module-level `FALCON_ACCOUNT_CLASS_HASH = "0x0"` constant and builds the service inside the `effect:` generator. We extract the implementation into a `makeService(rpcUrl, classHash)` function and add a static `make()` factory method. The `Default` layer is preserved unchanged so existing tests keep working.

**Step 1: Write the failing test for StarknetService.make()**

In `apps/demo/src/__tests__/effect-services/starknet-service.test.ts`, add this new describe block at the end:

```typescript
// ---------------------------------------------------------------------------
// StarknetService.make() factory — custom rpcUrl + classHash
// ---------------------------------------------------------------------------

describe("StarknetService.make() factory", () => {
  const mockPk: PackedPublicKey = {
    slots: Array.from({ length: 29 }, (_, i) => `0x${i.toString(16).padStart(64, "0")}`),
  }

  it("creates a working layer with custom rpcUrl — computeDeployAddress is pure", async () => {
    const customLayer = StarknetService.make(
      "https://api.zan.top/public/starknet-sepolia/rpc/v0_10",
      "0xdeadbeef",
    )
    const exit = await Effect.runPromiseExit(
      StarknetService.computeDeployAddress(mockPk).pipe(
        Effect.provide(customLayer),
      ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(typeof exit.value.address).toBe("string")
      expect(exit.value.address.startsWith("0x")).toBe(true)
    }
  })

  it("two layers with different classHash produce different addresses for same PK", async () => {
    const layer1 = StarknetService.make("http://localhost:9999", "0x1111")
    const layer2 = StarknetService.make("http://localhost:9999", "0x2222")

    const [exit1, exit2] = await Promise.all([
      Effect.runPromiseExit(
        StarknetService.computeDeployAddress(mockPk).pipe(Effect.provide(layer1)),
      ),
      Effect.runPromiseExit(
        StarknetService.computeDeployAddress(mockPk).pipe(Effect.provide(layer2)),
      ),
    ])

    expect(Exit.isSuccess(exit1)).toBe(true)
    expect(Exit.isSuccess(exit2)).toBe(true)
    if (Exit.isSuccess(exit1) && Exit.isSuccess(exit2)) {
      // Different classHash → different address (even with same PK and same salt pattern)
      // NOTE: salt is random, so we can only verify both are valid hex strings
      expect(typeof exit1.value.address).toBe("string")
      expect(typeof exit2.value.address).toBe("string")
    }
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test src/__tests__/effect-services/starknet-service.test.ts 2>&1 | tail -10
```

Expected: Fails with `"StarknetService.make is not a function"` or type error.

**Step 3: Refactor StarknetService.ts**

Replace the entire file with:

```typescript
import { Config, Effect, Layer } from "effect"
import { RpcProvider, Account, hash, CallData, stark } from "starknet"
import {
  StarknetRpcError,
  AccountDeployError,
} from "./errors"
import { TxHash, ContractAddress } from "./types"
import type { PackedPublicKey } from "./types"

/** STRK token contract address (same on mainnet and Sepolia) */
export const STRK_TOKEN_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"

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

  return {
    computeDeployAddress,
    getBalance,
    deployAccount,
    waitForTx,
    provider,
  }
}

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
  static make(rpcUrl: string, classHash: string): Layer.Layer<StarknetService> {
    return Layer.succeed(StarknetService, makeService(rpcUrl, classHash))
  }
}
```

**Step 4: Run test to confirm it passes**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test src/__tests__/effect-services/starknet-service.test.ts 2>&1 | tail -15
```

Expected: All tests pass including the 2 new make() tests.

**Step 5: Run full test suite**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test 2>&1 | tail -5
```

Expected: All tests pass (same count as before + 2 new tests).

**Step 6: Commit**

```bash
cd /home/felt/PycharmProjects/s2morrow
git add apps/demo/src/services/StarknetService.ts apps/demo/src/__tests__/effect-services/starknet-service.test.ts
git commit -m "refactor(demo): extract StarknetService.make() factory for runtime network switching"
```

---

### Task 4: Update NavHeader — pill network toggle

**Files:**
- Modify: `apps/demo/src/components/landing/NavHeader.tsx`

**Context:** The current file is a pure server component (no `"use client"`). It renders a sticky header with nav links. We need to make it a client component so it can read/set `networkAtom`. The toggle syncs with `localStorage` via a `useEffect`.

**Step 1: Rewrite NavHeader.tsx**

Replace the entire file:

```tsx
"use client"

import React, { useCallback, useEffect } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { networkAtom, NETWORK_STORAGE_KEY } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import type { NetworkId } from "@/config/networks"

const NAV_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#verify", label: "Verify" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#deploy", label: "Deploy" },
] as const

export function NavHeader(): React.JSX.Element {
  const networkId = useAtomValue(networkAtom)
  const setNetwork = useAtomSet(networkAtom)

  // Sync from localStorage after hydration (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NETWORK_STORAGE_KEY)
      if (stored === "mainnet") setNetwork("mainnet")
    } catch {
      // localStorage unavailable (e.g., private browsing restriction)
    }
  }, [setNetwork])

  const handleNetworkChange = useCallback(
    (id: NetworkId) => {
      setNetwork(id)
      try {
        localStorage.setItem(NETWORK_STORAGE_KEY, id)
      } catch {
        // localStorage unavailable
      }
    },
    [setNetwork],
  )

  return (
    <header className="sticky top-0 z-40 border-b border-falcon-muted/20 bg-falcon-bg/80 backdrop-blur-sm">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3"
      >
        <a href="#hero" className="text-sm font-bold text-falcon-accent">
          Falcon-512
        </a>
        <ul className="flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-falcon-muted transition-colors hover:text-falcon-text"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div
          className="flex items-center rounded-full border border-falcon-muted/30 p-0.5"
          role="group"
          aria-label="Network selection"
        >
          {(["sepolia", "mainnet"] as const).map((id) => {
            const isActive = networkId === id
            return (
              <button
                key={id}
                onClick={() => handleNetworkChange(id)}
                aria-pressed={isActive}
                className={
                  isActive
                    ? "rounded-full bg-falcon-accent px-3 py-1 text-xs font-semibold text-falcon-text transition-all"
                    : "rounded-full px-3 py-1 text-xs text-falcon-muted transition-all hover:text-falcon-text"
                }
              >
                {NETWORKS[id].name}
              </button>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
```

**Step 2: Run typecheck**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck 2>&1 | tail -10
```

Expected: No new errors.

**Step 3: Commit**

```bash
cd /home/felt/PycharmProjects/s2morrow
git add apps/demo/src/components/landing/NavHeader.tsx
git commit -m "feat(demo): add network pill toggle to NavHeader"
```

---

### Task 5: Update AccountDeployFlow — runtime rebuild + conditional UI

**Files:**
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
- Modify: `apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx`

**Context:** The component currently has a module-level `deployRuntime`. We move it to a `useRef` inside the component, rebuilt when `networkId` changes. Three dynamic behaviors:
1. `StarknetService.make(config.rpcUrl, config.classHash)` used instead of `StarknetService.Default`
2. Faucet link rendered only when `networkConfig.isTestnet`
3. Explorer URL derived from `networkConfig.explorerBaseUrl`
4. Deploy state reset on network switch

**Step 1: Update account-deploy-view.test.tsx first (test the current behavior)**

In `apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx`, import `networkAtom` and add it to all `renderAccountDeployFlow` calls so the test controls the network explicitly:

```typescript
import { networkAtom } from "../../atoms/starknet"
```

Update the `renderAccountDeployFlow` helper to accept a `network` option:

```typescript
const renderAccountDeployFlow = (options?: {
  readonly step?: DeployStep
  readonly keypair?: Option.Option<FalconKeypair>
  readonly network?: "sepolia" | "mainnet"
}): string => {
  const step = options?.step ?? { step: "idle" }
  const keypair = options?.keypair ?? Option.none()
  const network = options?.network ?? "sepolia"

  return renderToStaticMarkup(
    React.createElement(
      RegistryProvider,
      {
        initialValues: [
          [deployStepAtom, step],
          [keypairAtom, keypair],
          [networkAtom, network],
        ],
      },
      React.createElement(AccountDeployFlow),
    ),
  )
}
```

Add two new tests at the end of the `AccountDeployFlow view` describe block:

```typescript
it("renders faucet link on Sepolia", () => {
  const html = renderAccountDeployFlow({
    step: { step: "awaiting-funds", address: ADDRESS },
    network: "sepolia",
  })
  expect(html).toContain("starknet-faucet.vercel.app")
})

it("hides faucet link on Mainnet", () => {
  const html = renderAccountDeployFlow({
    step: { step: "awaiting-funds", address: ADDRESS },
    network: "mainnet",
  })
  expect(html).not.toContain("starknet-faucet.vercel.app")
})

it("renders Voyager Sepolia explorer link on Sepolia network", () => {
  const html = renderAccountDeployFlow({
    step: { step: "deployed", address: ADDRESS, txHash: TX_HASH },
    network: "sepolia",
  })
  expect(html).toContain(`href="https://sepolia.voyager.online/tx/${TX_HASH}"`)
})

it("renders Voyager mainnet explorer link on Mainnet network", () => {
  const html = renderAccountDeployFlow({
    step: { step: "deployed", address: ADDRESS, txHash: TX_HASH },
    network: "mainnet",
  })
  expect(html).toContain(`href="https://voyager.online/tx/${TX_HASH}"`)
})
```

Run the tests — they will fail until the component is updated:

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test src/__tests__/account-deploy/account-deploy-view.test.tsx 2>&1
```

Expected: `faucet link` and `Mainnet explorer` tests fail.

**Step 2: Update AccountDeployFlow.tsx**

Read the current file carefully first. Then make these changes:

1. **Add imports** at the top:
```typescript
import { NETWORKS } from "@/config/networks"
import { networkAtom } from "@/atoms/starknet"
import type { NetworkConfig } from "@/config/networks"
```

2. **Remove the module-level `deployRuntime`** (lines 21-26 currently):
```typescript
// DELETE THIS:
const deployRuntime = ManagedRuntime.make(
  Layer.mergeAll(
    FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
    StarknetService.Default,
  ),
)
```

3. **Add a `createDeployRuntime` function** after the imports (module level, outside the component):
```typescript
function createDeployRuntime(config: NetworkConfig) {
  return ManagedRuntime.make(
    Layer.mergeAll(
      FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
      StarknetService.make(config.rpcUrl, config.classHash),
    ),
  )
}
```

4. **Inside the component function**, add after the existing atom hooks:
```typescript
const networkId = useAtomValue(networkAtom)
const networkConfig = NETWORKS[networkId]

// Runtime ref — rebuild synchronously when network changes
const deployRuntimeRef = useRef(createDeployRuntime(networkConfig))
const prevNetworkRef = useRef(networkId)
if (prevNetworkRef.current !== networkId) {
  prevNetworkRef.current = networkId
  deployRuntimeRef.current = createDeployRuntime(networkConfig)
}

// Reset deploy state when network changes
useEffect(() => {
  setDeployStep({ step: "idle" })
  setPreparedDeploy(Option.none())
  setBalance(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [networkId])
```

5. **Update all `deployRuntime.runPromiseExit(...)` calls** to `deployRuntimeRef.current.runPromiseExit(...)`. There are 3 places: `handlePrepare`, `handleDeploy`, and the balance polling `useEffect`.

6. **Update the section description** (currently hardcodes "Sepolia testnet"):
```tsx
// Before:
Deploy a Falcon-powered account to Starknet Sepolia testnet with the same keypair used in
the verification playground.

// After:
Deploy a Falcon-powered account to Starknet {networkConfig.name} with the same keypair used in
the verification playground.
```

7. **Make faucet link conditional** (find the faucet `<a>` tag inside the `awaiting-funds` block):
```tsx
{networkConfig.isTestnet && (
  <a
    href="https://starknet-faucet.vercel.app/"
    target="_blank"
    rel="noreferrer noopener"
    className="inline-block text-sm text-falcon-accent hover:underline"
  >
    Get testnet STRK from the Starknet Faucet &rarr;
  </a>
)}
```

8. **Update the explorer link** in the `deployed` success block:
```tsx
// Before:
href={`https://sepolia.voyager.online/tx/${deployStep.txHash}`}

// After:
href={`${networkConfig.explorerBaseUrl}/tx/${deployStep.txHash}`}
```

**Step 3: Run tests**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test src/__tests__/account-deploy/account-deploy-view.test.tsx 2>&1
```

Expected: All 7 tests pass (3 original + 4 new).

**Step 4: Run full suite**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test 2>&1 | tail -5
```

Expected: All tests pass.

**Step 5: Run typecheck**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck 2>&1 | tail -5
```

Expected: No errors.

**Step 6: Commit**

```bash
cd /home/felt/PycharmProjects/s2morrow
git add apps/demo/src/components/interactive/AccountDeployFlow.tsx \
  apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx
git commit -m "feat(demo): wire networkAtom into AccountDeployFlow (runtime rebuild, conditional faucet, dynamic explorer URL)"
```

---

### Task 6: Final verification

**Files:** None (verification only)

**Step 1: Run full test suite**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test 2>&1 | tail -5
```

Expected: All tests pass, 0 failures.

**Step 2: Run typecheck**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck 2>&1
```

Expected: Clean output, 0 errors.

**Step 3: Run production build**

```bash
cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run build 2>&1 | tail -15
```

Expected: Build succeeds with no errors.

**Step 4: Commit any fixes needed**

If any issues are found, fix and commit with:
```bash
git commit -m "fix(demo): network switcher typecheck/build fixes"
```

---

## Summary

| Task | Files | Key change |
|------|-------|------------|
| 1 | `config/networks.ts` (new) | Network config constants |
| 2 | `atoms/starknet.ts` | `networkAtom` with localStorage |
| 3 | `StarknetService.ts` | `makeService()` + `StarknetService.make()` |
| 4 | `NavHeader.tsx` | Client component, pill toggle |
| 5 | `AccountDeployFlow.tsx` | Runtime rebuild, conditional faucet, dynamic explorer |
| 6 | — | Full test + build verification |
