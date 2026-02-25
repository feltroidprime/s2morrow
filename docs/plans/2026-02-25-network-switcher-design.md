# Network Switcher Design

**Date:** 2026-02-25
**Goal:** Seamlessly switch between Starknet Sepolia testnet and Mainnet from the NavHeader. The RPC URL, class hash, and explorer URL change per network. The faucet link is only shown on testnet.

---

## Architecture

### New file: `apps/demo/src/config/networks.ts`

```typescript
export type NetworkId = "sepolia" | "mainnet"

export interface NetworkConfig {
  id: NetworkId
  name: string
  rpcUrl: string
  classHash: string       // 0x0 until declared per-network
  explorerBaseUrl: string
  isTestnet: boolean
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

### Atom: `networkAtom` in `atoms/starknet.ts`

```typescript
import { DEFAULT_NETWORK } from "@/config/networks"
import type { NetworkId } from "@/config/networks"

const NETWORK_STORAGE_KEY = "falcon-demo-network"

function readStoredNetwork(): NetworkId {
  if (typeof window === "undefined") return DEFAULT_NETWORK
  const stored = localStorage.getItem(NETWORK_STORAGE_KEY)
  return stored === "mainnet" ? "mainnet" : DEFAULT_NETWORK
}

export const networkAtom = Atom.make<NetworkId>(readStoredNetwork()).pipe(
  Atom.keepAlive,
)
```

The atom is initialized from `localStorage` on first read (client-side only). When the user changes network, a separate `useEffect` in `NavHeader` persists it.

### StarknetService refactor

Extract implementation into `makeService(rpcUrl, classHash)`. Add a static `make()` factory. Keep `Default` unchanged for test compatibility:

```typescript
function makeService(rpcUrl: string, classHash: string) {
  const provider = new RpcProvider({ nodeUrl: rpcUrl })
  // all methods close over provider and classHash
  return { computeDeployAddress, getBalance, deployAccount, waitForTx, provider }
}

export class StarknetService extends Effect.Service<StarknetService>()(
  "StarknetService", {
    accessors: true,
    effect: Effect.gen(function* () {
      const rpcUrl = yield* Config.string("NEXT_PUBLIC_STARKNET_RPC_URL")
      return makeService(rpcUrl, "0x0")
    }),
  }
) {
  static make(rpcUrl: string, classHash: string) {
    return Layer.succeed(StarknetService, makeService(rpcUrl, classHash))
  }
}
```

### NavHeader: pill-style network toggle

`NavHeader.tsx` becomes `"use client"`. The toggle is added to the right of the nav links:

```
[ Falcon-512 ]  Home  Verify  Pipeline  Deploy    [• Sepolia] [  Mainnet  ]
```

Active pill: `bg-falcon-accent text-falcon-text` (filled). Inactive: `border border-falcon-muted/30 text-falcon-muted`. On click: updates `networkAtom` + writes to `localStorage`.

### AccountDeployFlow: runtime + conditional UI

The module-level `deployRuntime` is replaced with a `useRef` runtime that rebuilds when `networkId` changes. All callbacks use `deployRuntimeRef.current`.

```typescript
const networkId = useAtomValue(networkAtom)
const networkConfig = NETWORKS[networkId]

// Synchronous rebuild during render when network changes
const deployRuntimeRef = useRef(createDeployRuntime(networkConfig))
const prevNetworkRef = useRef(networkId)
if (prevNetworkRef.current !== networkId) {
  prevNetworkRef.current = networkId
  deployRuntimeRef.current = createDeployRuntime(networkConfig)
}

// Reset deploy state on network switch
useEffect(() => {
  setDeployStep({ step: "idle" })
  setPreparedDeploy(Option.none())
  setBalance(null)
}, [networkId])
```

Conditional UI:
- Section description: `"…Starknet ${networkConfig.name}…"`
- Faucet link: only rendered when `networkConfig.isTestnet`
- Explorer link: `` `${networkConfig.explorerBaseUrl}/tx/${deployStep.txHash}` ``

---

## Conditional Behavior Table

| Element | Sepolia | Mainnet |
|---|---|---|
| Faucet link | ✅ Shown | ❌ Hidden |
| Balance display | ✅ Shown | ✅ Shown |
| Explorer link | `sepolia.voyager.online` | `voyager.online` |
| Section description | "…Sepolia testnet…" | "…Mainnet…" |
| Deploy state on switch | Reset to idle | Reset to idle |

---

## Files Changed

| File | Change |
|------|--------|
| `src/config/networks.ts` | **Create** — network configs |
| `src/atoms/starknet.ts` | Add `networkAtom` with localStorage init |
| `src/services/StarknetService.ts` | Extract `makeService()`, add `StarknetService.make()` |
| `src/components/landing/NavHeader.tsx` | Add `"use client"`, add pill toggle |
| `src/components/interactive/AccountDeployFlow.tsx` | Runtime via ref, conditional faucet, dynamic explorer |
