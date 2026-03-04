# Demo App Production Release — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the demo app end-to-end: professional verification playground with key import/export, devnet network support, full account deploy flow through to sending a STRK transfer.

**Architecture:** Effect-only frontend (atoms, services, Schema.TaggedError). WASM bridge for Falcon crypto. starknet.js v9 with custom `FalconSigner` implementing `SignerInterface`. Signature format opaque to frontend — only Rust + Cairo own serialization.

**Tech Stack:** Next.js 15 + React 19, Effect 3.13, starknet.js 9.2.1, bun test, Tailwind 4, wasm-pack (falcon-rs)

**Test runner:** `cd apps/demo && bun test`

**Effect patterns to follow everywhere:**
- Services: `Effect.Service` with `Effect.fn` for tracing
- Errors: `Schema.TaggedError` with `{ message: Schema.String }` minimum
- State: Atoms via `@effect-atom/atom-react` (useAtomValue, useAtomSet)
- Runtime: `ManagedRuntime.make()` + `Layer.mergeAll()`
- Error handling: `Exit.isSuccess/isFailure` + `Cause.failureOption` + `Option.match` (never throw, never getOrThrow)
- No useState for domain state — only for ephemeral UI (form inputs)

---

## Task 1: Add devnet to network config

**Files:**
- Modify: `apps/demo/src/config/networks.ts`
- Modify: `apps/demo/src/atoms/starknet.ts:39` (readStoredNetwork needs to handle "devnet")
- Test: `apps/demo/src/__tests__/config/networks.test.ts` (new)

**Step 1: Write the failing test**

```typescript
// apps/demo/src/__tests__/config/networks.test.ts
import { describe, it, expect } from "bun:test"
import { NETWORKS, DEFAULT_NETWORK } from "../../config/networks"
import type { NetworkId, NetworkConfig } from "../../config/networks"

describe("NETWORKS config", () => {
  it("has devnet, sepolia, and mainnet entries", () => {
    expect(NETWORKS.devnet).toBeDefined()
    expect(NETWORKS.sepolia).toBeDefined()
    expect(NETWORKS.mainnet).toBeDefined()
  })

  it("devnet points to localhost:5050", () => {
    expect(NETWORKS.devnet.rpcUrl).toBe("http://localhost:5050")
  })

  it("devnet has isDevnet=true", () => {
    expect(NETWORKS.devnet.isDevnet).toBe(true)
  })

  it("sepolia and mainnet have isDevnet=false", () => {
    expect(NETWORKS.sepolia.isDevnet).toBe(false)
    expect(NETWORKS.mainnet.isDevnet).toBe(false)
  })

  it("devnet has empty explorerBaseUrl", () => {
    expect(NETWORKS.devnet.explorerBaseUrl).toBe("")
  })

  it("DEFAULT_NETWORK is devnet", () => {
    expect(DEFAULT_NETWORK).toBe("devnet")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/demo && bun test src/__tests__/config/networks.test.ts`
Expected: FAIL — `isDevnet` doesn't exist on `NetworkConfig`, no `devnet` key in `NETWORKS`

**Step 3: Implement the network config changes**

```typescript
// apps/demo/src/config/networks.ts
export type NetworkId = "devnet" | "sepolia" | "mainnet"

export interface NetworkConfig {
  readonly id: NetworkId
  readonly name: string
  readonly rpcUrl: string
  readonly classHash: string
  readonly explorerBaseUrl: string
  readonly isTestnet: boolean
  readonly isDevnet: boolean
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  devnet: {
    id: "devnet",
    name: "Devnet",
    rpcUrl: "http://localhost:5050",
    classHash: "0x0",
    explorerBaseUrl: "",
    isTestnet: true,
    isDevnet: true,
  },
  sepolia: {
    id: "sepolia",
    name: "Sepolia",
    rpcUrl: "https://api.zan.top/node/v1/starknet/sepolia/30623d06317c4234ac2934876f2fd542",
    classHash: "0x0",
    explorerBaseUrl: "https://sepolia.voyager.online",
    isTestnet: true,
    isDevnet: false,
  },
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    rpcUrl: "https://api.zan.top/node/v1/starknet/mainnet/30623d06317c4234ac2934876f2fd542",
    classHash: "0x0",
    explorerBaseUrl: "https://voyager.online",
    isTestnet: false,
    isDevnet: false,
  },
}

export const DEFAULT_NETWORK: NetworkId = "devnet"
```

Also update `readStoredNetwork` in `apps/demo/src/atoms/starknet.ts`:

```typescript
function readStoredNetwork(): NetworkId {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return DEFAULT_NETWORK
    }
    const stored = localStorage.getItem(NETWORK_STORAGE_KEY)
    if (stored === "mainnet" || stored === "sepolia" || stored === "devnet") {
      return stored
    }
    return DEFAULT_NETWORK
  } catch {
    return DEFAULT_NETWORK
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/demo && bun test src/__tests__/config/networks.test.ts`
Expected: PASS

**Step 5: Update NavHeader to show 3 network pills**

In `apps/demo/src/components/landing/NavHeader.tsx`, change line 68:

```typescript
// Before:
{(["sepolia", "mainnet"] as const).map((id) => {
// After:
{(["devnet", "sepolia", "mainnet"] as const).map((id) => {
```

**Step 6: Run full test suite**

Run: `cd apps/demo && bun test`
Expected: All existing tests still pass

**Step 7: Commit**

```bash
git add apps/demo/src/config/networks.ts apps/demo/src/atoms/starknet.ts apps/demo/src/components/landing/NavHeader.tsx apps/demo/src/__tests__/config/networks.test.ts
git commit -m "feat(demo): add devnet as third network option with isDevnet flag"
```

---

## Task 2: Unified declare script

**Files:**
- Create: `bin/declare.sh`
- Modify: `sncast.toml` (add devnet + mainnet profiles)
- Delete: `bin/declare-sepolia.sh` (replaced)

**Step 1: Create sncast.toml with profiles**

```toml
# sncast.toml
[default]
url = "http://localhost:5050"
accounts-file = "~/.starknet_accounts/starknet_open_zeppelin_accounts.json"
wait = true

[profile.devnet]
url = "http://localhost:5050"

[profile.sepolia]
url = "https://api.zan.top/public/starknet-sepolia/rpc/v0_10"

[profile.mainnet]
url = "https://api.zan.top/node/v1/starknet/mainnet/30623d06317c4234ac2934876f2fd542"
```

**Step 2: Create bin/declare.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Declare FalconAccount on a Starknet network
# Usage: ./bin/declare.sh devnet|sepolia|mainnet [--account <name>]

NETWORK="${1:?Usage: ./bin/declare.sh devnet|sepolia|mainnet}"
shift

case "$NETWORK" in
  devnet|sepolia|mainnet) ;;
  *) echo "ERROR: Unknown network '$NETWORK'. Use: devnet, sepolia, or mainnet"; exit 1 ;;
esac

SIERRA_PATH="target/dev/falcon_account_FalconAccount.contract_class.json"
CASM_PATH="target/dev/falcon_account_FalconAccount.compiled_contract_class.json"

if [[ ! -f "$SIERRA_PATH" ]]; then
  echo "ERROR: Sierra artifact not found at $SIERRA_PATH"
  echo "Run: scarb build --package falcon_account"
  exit 1
fi

if [[ ! -f "$CASM_PATH" ]]; then
  echo "ERROR: CASM artifact not found at $CASM_PATH"
  echo "Ensure casm = true in packages/falcon_account/Scarb.toml and rebuild"
  exit 1
fi

echo "Declaring FalconAccount on $NETWORK..."

OUTPUT=$(sncast --profile "$NETWORK" declare \
  --contract-name FalconAccount \
  --fee-token strk \
  "$@" 2>&1) || true

echo "$OUTPUT"

# Extract class_hash from sncast output
CLASS_HASH=$(echo "$OUTPUT" | grep -oP 'class_hash: \K0x[0-9a-fA-F]+' || true)

if [[ -z "$CLASS_HASH" ]]; then
  # Already declared — extract from "is already declared" message
  CLASS_HASH=$(echo "$OUTPUT" | grep -oP '0x[0-9a-fA-F]{50,}' | head -1 || true)
fi

if [[ -n "$CLASS_HASH" ]]; then
  echo ""
  echo "Class hash: $CLASS_HASH"

  # Auto-patch networks.ts
  NETWORKS_FILE="apps/demo/src/config/networks.ts"
  if [[ -f "$NETWORKS_FILE" ]]; then
    # Find the network block and replace its classHash
    # Uses perl for multi-line matching
    perl -i -0pe "
      s/(id: \"$NETWORK\".*?classHash: \")0x0(\")/$1${CLASS_HASH}$2/s
    " "$NETWORKS_FILE"
    echo "Updated $NETWORKS_FILE with classHash for $NETWORK"
  fi
else
  echo ""
  echo "Could not extract class_hash. Update networks.ts manually."
fi
```

**Step 3: Make executable and test syntax**

Run: `chmod +x bin/declare.sh && bash -n bin/declare.sh`
Expected: No syntax errors

**Step 4: Delete old script**

Run: `git rm bin/declare-sepolia.sh`

**Step 5: Commit**

```bash
git add bin/declare.sh sncast.toml
git commit -m "feat: unified bin/declare.sh for devnet/sepolia/mainnet with auto-patch"
```

---

## Task 3: New error types and extended DeployStep

**Files:**
- Modify: `apps/demo/src/services/errors.ts`
- Modify: `apps/demo/src/atoms/starknet.ts`
- Modify: `apps/demo/src/services/types.ts`

**Step 1: Add new error types to errors.ts**

Append to `apps/demo/src/services/errors.ts`:

```typescript
export class TransactionSignError extends Schema.TaggedError<TransactionSignError>()(
  "TransactionSignError",
  { message: Schema.String },
) {}

export class TransactionSubmitError extends Schema.TaggedError<TransactionSubmitError>()(
  "TransactionSubmitError",
  { message: Schema.String, txHash: Schema.optional(Schema.String) },
) {}

export class DevnetFetchError extends Schema.TaggedError<DevnetFetchError>()(
  "DevnetFetchError",
  { message: Schema.String },
) {}
```

**Step 2: Extend DeployStep in starknet.ts**

Add two new variants to `DeployStep`:

```typescript
export type DeployStep =
  | { step: "idle" }
  | { step: "generating-keypair" }
  | { step: "packing" }
  | { step: "computing-address" }
  | { step: "awaiting-funds"; address: ContractAddress }
  | { step: "deploying"; address: ContractAddress }
  | { step: "deployed"; address: ContractAddress; txHash: TxHash }
  | { step: "sending-tx"; address: ContractAddress }
  | { step: "tx-confirmed"; address: ContractAddress; txHash: TxHash; transferTxHash: TxHash }
  | { step: "error"; message: string }
```

**Step 3: Add key file schema type to types.ts**

Append to `apps/demo/src/services/types.ts`:

```typescript
export interface FalconKeyFile {
  readonly version: 1
  readonly algorithm: "falcon-512"
  readonly secretKey: string        // 0x hex
  readonly verifyingKey: string     // 0x hex
  readonly publicKeyNtt: number[]   // 512 integers in [0, 12289)
  readonly packedPublicKey: string[] // 29 hex felt252
}

export interface DevnetAccount {
  readonly address: string
  readonly private_key: string
  readonly initial_balance: string
}
```

**Step 4: Run typecheck**

Run: `cd apps/demo && bunx tsc --noEmit`
Expected: PASS (no type errors)

**Step 5: Commit**

```bash
git add apps/demo/src/services/errors.ts apps/demo/src/atoms/starknet.ts apps/demo/src/services/types.ts
git commit -m "feat(demo): add transaction error types, extended DeployStep, key file schema"
```

---

## Task 4: Key import/export utilities

**Files:**
- Create: `apps/demo/src/services/keyfile.ts`
- Test: `apps/demo/src/__tests__/verify-playground/keyfile.test.ts` (new)

**Step 1: Write the failing tests**

```typescript
// apps/demo/src/__tests__/verify-playground/keyfile.test.ts
import { describe, it, expect } from "bun:test"
import { Exit, Effect } from "effect"
import { exportKeyFile, parseKeyFile } from "../../services/keyfile"
import type { FalconKeypair, PackedPublicKey } from "../../services/types"

const MOCK_KEYPAIR: FalconKeypair = {
  secretKey: new Uint8Array([0x01, 0x02, 0x03]),
  verifyingKey: new Uint8Array([0x0a, 0x0b]),
  publicKeyNtt: new Int32Array([100, 200, 300]),
}

const MOCK_PACKED: PackedPublicKey = {
  slots: ["0xaaa", "0xbbb"],
}

describe("exportKeyFile", () => {
  it("returns a valid FalconKeyFile JSON string", () => {
    const json = exportKeyFile(MOCK_KEYPAIR, MOCK_PACKED)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.algorithm).toBe("falcon-512")
    expect(parsed.secretKey).toBe("0x010203")
    expect(parsed.verifyingKey).toBe("0x0a0b")
    expect(parsed.publicKeyNtt).toEqual([100, 200, 300])
    expect(parsed.packedPublicKey).toEqual(["0xaaa", "0xbbb"])
  })
})

describe("parseKeyFile", () => {
  it("succeeds with valid JSON", async () => {
    const json = exportKeyFile(MOCK_KEYPAIR, MOCK_PACKED)
    const exit = await Effect.runPromiseExit(parseKeyFile(json))
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.keypair.secretKey).toBeInstanceOf(Uint8Array)
      expect(exit.value.keypair.verifyingKey).toBeInstanceOf(Uint8Array)
      expect(exit.value.keypair.publicKeyNtt).toBeInstanceOf(Int32Array)
      expect(exit.value.packedPublicKey.slots).toEqual(["0xaaa", "0xbbb"])
    }
  })

  it("fails with invalid JSON", async () => {
    const exit = await Effect.runPromiseExit(parseKeyFile("not json"))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it("fails with wrong version", async () => {
    const bad = JSON.stringify({ version: 2, algorithm: "falcon-512", secretKey: "0x01", verifyingKey: "0x02", publicKeyNtt: [], packedPublicKey: [] })
    const exit = await Effect.runPromiseExit(parseKeyFile(bad))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it("fails with missing fields", async () => {
    const bad = JSON.stringify({ version: 1 })
    const exit = await Effect.runPromiseExit(parseKeyFile(bad))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it("fails when publicKeyNtt has coefficient >= 12289", async () => {
    const bad = JSON.stringify({
      version: 1,
      algorithm: "falcon-512",
      secretKey: "0x01",
      verifyingKey: "0x02",
      publicKeyNtt: [99999],
      packedPublicKey: ["0xaaa"],
    })
    const exit = await Effect.runPromiseExit(parseKeyFile(bad))
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/demo && bun test src/__tests__/verify-playground/keyfile.test.ts`
Expected: FAIL — module `../../services/keyfile` not found

**Step 3: Implement keyfile.ts**

```typescript
// apps/demo/src/services/keyfile.ts
import { Effect, Schema } from "effect"
import { bytesToHex } from "@/components/interactive/verification-utils"
import type { FalconKeypair, FalconKeyFile, PackedPublicKey } from "./types"

const Q = 12289

export class KeyFileParseError extends Schema.TaggedError<KeyFileParseError>()(
  "KeyFileParseError",
  { message: Schema.String },
) {}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function exportKeyFile(
  keypair: FalconKeypair,
  packedPublicKey: PackedPublicKey,
): string {
  const file: FalconKeyFile = {
    version: 1,
    algorithm: "falcon-512",
    secretKey: "0x" + bytesToHex(keypair.secretKey),
    verifyingKey: "0x" + bytesToHex(keypair.verifyingKey),
    publicKeyNtt: Array.from(keypair.publicKeyNtt),
    packedPublicKey: Array.from(packedPublicKey.slots),
  }
  return JSON.stringify(file, null, 2)
}

export const parseKeyFile = Effect.fn("KeyFile.parse")(
  function* (json: string) {
    const raw = yield* Effect.try({
      try: () => JSON.parse(json) as Record<string, unknown>,
      catch: () => new KeyFileParseError({ message: "Invalid JSON" }),
    })

    if (raw.version !== 1) {
      return yield* Effect.fail(
        new KeyFileParseError({ message: `Unsupported version: ${raw.version}` }),
      )
    }
    if (raw.algorithm !== "falcon-512") {
      return yield* Effect.fail(
        new KeyFileParseError({ message: `Unsupported algorithm: ${raw.algorithm}` }),
      )
    }
    if (typeof raw.secretKey !== "string" || typeof raw.verifyingKey !== "string") {
      return yield* Effect.fail(
        new KeyFileParseError({ message: "Missing secretKey or verifyingKey" }),
      )
    }
    if (!Array.isArray(raw.publicKeyNtt) || !Array.isArray(raw.packedPublicKey)) {
      return yield* Effect.fail(
        new KeyFileParseError({ message: "Missing publicKeyNtt or packedPublicKey" }),
      )
    }

    for (const coeff of raw.publicKeyNtt as number[]) {
      if (typeof coeff !== "number" || coeff < 0 || coeff >= Q) {
        return yield* Effect.fail(
          new KeyFileParseError({
            message: `publicKeyNtt coefficient out of range: ${coeff}`,
          }),
        )
      }
    }

    const keypair: FalconKeypair = {
      secretKey: hexToBytes(raw.secretKey as string),
      verifyingKey: hexToBytes(raw.verifyingKey as string),
      publicKeyNtt: new Int32Array(raw.publicKeyNtt as number[]),
    }

    const packedPublicKey: PackedPublicKey = {
      slots: raw.packedPublicKey as string[],
    }

    return { keypair, packedPublicKey }
  },
)
```

**Step 4: Run test to verify it passes**

Run: `cd apps/demo && bun test src/__tests__/verify-playground/keyfile.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/demo/src/services/keyfile.ts apps/demo/src/__tests__/verify-playground/keyfile.test.ts
git commit -m "feat(demo): add key file import/export with validation"
```

---

## Task 5: KeyManagementPanel component

**Files:**
- Create: `apps/demo/src/components/interactive/KeyManagementPanel.tsx`
- Modify: `apps/demo/src/atoms/falcon.ts` (packedKeyAtom needs keepAlive for eager display)

**Step 1: Make packedKeyAtom keepAlive**

In `apps/demo/src/atoms/falcon.ts`, change:

```typescript
// Before:
export const packedKeyAtom = Atom.make<Option.Option<PackedPublicKey>>(Option.none())
// After:
export const packedKeyAtom = Atom.make<Option.Option<PackedPublicKey>>(Option.none()).pipe(
  Atom.keepAlive,
)
```

**Step 2: Create KeyManagementPanel**

```typescript
// apps/demo/src/components/interactive/KeyManagementPanel.tsx
"use client"

import React, { useCallback, useState } from "react"
import { Cause, Exit, Layer, ManagedRuntime, Option } from "effect"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { FalconService } from "@/services/FalconService"
import { WasmRuntimeLive } from "@/services/WasmRuntime"
import {
  keypairAtom,
  packedKeyAtom,
  verificationStepAtom,
  wasmStatusAtom,
} from "@/atoms/falcon"
import { exportKeyFile, parseKeyFile } from "@/services/keyfile"
import { HexDisplay } from "./HexDisplay"
import { bytesToHex } from "./verification-utils"
import type { PackedPublicKey } from "@/services/types"

const appRuntime = ManagedRuntime.make(
  FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
)

export function KeyManagementPanel(): React.JSX.Element {
  const keypair = useAtomValue(keypairAtom)
  const packedKey = useAtomValue(packedKeyAtom)
  const step = useAtomValue(verificationStepAtom)
  const setKeypair = useAtomSet(keypairAtom)
  const setPackedKey = useAtomSet(packedKeyAtom)
  const setStep = useAtomSet(verificationStepAtom)
  const setWasmStatus = useAtomSet(wasmStatusAtom)

  const [showNtt, setShowNtt] = useState(false)
  const [showPacked, setShowPacked] = useState(false)

  const isBusy = step.step === "generating-keypair"

  const packPublicKey = useCallback(
    async (pkNtt: Int32Array) => {
      const pkNtt16 = new Uint16Array(pkNtt.length)
      for (let i = 0; i < pkNtt.length; i++) pkNtt16[i] = pkNtt[i]
      const exit = await appRuntime.runPromiseExit(
        FalconService.packPublicKey(pkNtt16),
      )
      if (Exit.isSuccess(exit)) {
        setPackedKey(Option.some(exit.value))
      }
    },
    [setPackedKey],
  )

  const handleGenerate = useCallback(async () => {
    setStep({ step: "generating-keypair" })
    setPackedKey(Option.none())
    const seed = crypto.getRandomValues(new Uint8Array(32))

    const exit = await appRuntime.runPromiseExit(
      FalconService.generateKeypair(seed),
    )

    if (Exit.isSuccess(exit)) {
      setKeypair(Option.some(exit.value))
      setWasmStatus("ready")
      setStep({ step: "idle" })
      await packPublicKey(exit.value.publicKeyNtt)
    } else {
      const errOpt = Cause.failureOption(exit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Keypair generation failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
    }
  }, [setKeypair, setPackedKey, setStep, setWasmStatus, packPublicKey])

  const handleImport = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const exit = await appRuntime.runPromiseExit(parseKeyFile(text))

      if (Exit.isSuccess(exit)) {
        setKeypair(Option.some(exit.value.keypair))
        setPackedKey(Option.some(exit.value.packedPublicKey))
        setWasmStatus("ready")
        setStep({ step: "idle" })
      } else {
        const errOpt = Cause.failureOption(exit.cause)
        const msg = Option.match(errOpt, {
          onNone: () => "Failed to parse key file",
          onSome: (e) => e.message,
        })
        setStep({ step: "error", message: msg })
      }
    }
    input.click()
  }, [setKeypair, setPackedKey, setWasmStatus, setStep])

  const handleExport = useCallback(() => {
    const kp = Option.match(keypair, { onNone: () => null, onSome: (k) => k })
    const pk = Option.match(packedKey, { onNone: () => null, onSome: (p) => p })
    if (!kp || !pk) return

    const json = exportKeyFile(kp, pk)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "falcon-keypair.json"
    a.click()
    URL.revokeObjectURL(url)
  }, [keypair, packedKey])

  const hasKeypair = Option.isSome(keypair)
  const hasPacked = Option.isSome(packedKey)

  const keypairHex = Option.match(keypair, {
    onNone: () => null,
    onSome: (kp) => "0x" + bytesToHex(kp.verifyingKey),
  })

  const nttCoeffs = Option.match(keypair, {
    onNone: () => null,
    onSome: (kp) => Array.from(kp.publicKeyNtt),
  })

  const packedSlots = Option.match(packedKey, {
    onNone: () => null,
    onSome: (pk) => pk.slots,
  })

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-falcon-text">Key Management</h3>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleGenerate}
          disabled={isBusy}
          className="rounded-lg bg-falcon-primary px-4 py-2 text-sm font-semibold text-falcon-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? "Generating..." : "Generate"}
        </button>
        <button
          onClick={handleImport}
          disabled={isBusy}
          className="rounded-lg border border-falcon-muted/30 px-4 py-2 text-sm font-semibold text-falcon-text transition-opacity hover:bg-falcon-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          Import
        </button>
        <button
          onClick={handleExport}
          disabled={!hasKeypair || !hasPacked}
          className="rounded-lg border border-falcon-muted/30 px-4 py-2 text-sm font-semibold text-falcon-text transition-opacity hover:bg-falcon-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export
        </button>
      </div>

      {keypairHex !== null && (
        <div className="space-y-3">
          <HexDisplay
            label="Verifying Key (896-byte h polynomial)"
            value={keypairHex}
            truncate={{ head: 18, tail: 8 }}
          />

          {nttCoeffs !== null && (
            <div>
              <button
                onClick={() => setShowNtt(!showNtt)}
                className="flex items-center gap-1 text-sm font-medium text-falcon-muted hover:text-falcon-text"
              >
                <span className="text-xs">{showNtt ? "▼" : "▶"}</span>
                NTT Coefficients ({nttCoeffs.length})
              </button>
              {showNtt && (
                <div className="mt-1 max-h-32 overflow-y-auto rounded bg-falcon-bg p-2 font-mono text-xs text-falcon-accent">
                  [{nttCoeffs.slice(0, 20).join(", ")}
                  {nttCoeffs.length > 20 && `, ... ${nttCoeffs.length - 20} more`}]
                </div>
              )}
            </div>
          )}

          {packedSlots !== null && (
            <div>
              <button
                onClick={() => setShowPacked(!showPacked)}
                className="flex items-center gap-1 text-sm font-medium text-falcon-muted hover:text-falcon-text"
              >
                <span className="text-xs">{showPacked ? "▼" : "▶"}</span>
                Packed Public Key ({packedSlots.length} felt252 slots)
              </button>
              {showPacked && (
                <HexDisplay
                  label=""
                  value={packedSlots}
                  maxRows={29}
                  truncate={{ head: 18, tail: 8 }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Run typecheck**

Run: `cd apps/demo && bunx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/demo/src/components/interactive/KeyManagementPanel.tsx apps/demo/src/atoms/falcon.ts
git commit -m "feat(demo): KeyManagementPanel with generate/import/export and expandable key views"
```

---

## Task 6: SignVerifyPanel component

**Files:**
- Create: `apps/demo/src/components/interactive/SignVerifyPanel.tsx`

**Step 1: Create SignVerifyPanel**

```typescript
// apps/demo/src/components/interactive/SignVerifyPanel.tsx
"use client"

import React, { useCallback } from "react"
import { Cause, Exit, Layer, ManagedRuntime, Option } from "effect"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { FalconService } from "@/services/FalconService"
import { WasmRuntimeLive } from "@/services/WasmRuntime"
import {
  keypairAtom,
  messageAtom,
  packedKeyAtom,
  signatureAtom,
  verificationStepAtom,
} from "@/atoms/falcon"
import { HexDisplay } from "./HexDisplay"
import { bytesToHex, getVerificationDisabledState } from "./verification-utils"

const appRuntime = ManagedRuntime.make(
  FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
)

export function SignVerifyPanel(): React.JSX.Element {
  const message = useAtomValue(messageAtom)
  const keypair = useAtomValue(keypairAtom)
  const step = useAtomValue(verificationStepAtom)
  const signature = useAtomValue(signatureAtom)

  const setMessage = useAtomSet(messageAtom)
  const setStep = useAtomSet(verificationStepAtom)
  const setSignature = useAtomSet(signatureAtom)
  const setPackedKey = useAtomSet(packedKeyAtom)

  const { isBusy, canSign } = getVerificationDisabledState({
    keypair,
    message,
    step,
  })

  const handleSignAndVerify = useCallback(async () => {
    const kp = Option.match(keypair, {
      onNone: () => null,
      onSome: (k) => k,
    })
    if (!kp) return

    const startTime = Date.now()
    const messageBytes = new TextEncoder().encode(message)

    // Sign
    setStep({ step: "signing" })
    const signExit = await appRuntime.runPromiseExit(
      FalconService.sign(kp.secretKey, messageBytes),
    )

    if (Exit.isFailure(signExit)) {
      const errOpt = Cause.failureOption(signExit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Signing failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
      return
    }

    const sigResult = signExit.value
    setSignature(Option.some(sigResult))

    // Pack Public Key
    setStep({ step: "packing" })
    const pkNtt16 = new Uint16Array(kp.publicKeyNtt.length)
    for (let i = 0; i < kp.publicKeyNtt.length; i++) {
      pkNtt16[i] = kp.publicKeyNtt[i]
    }
    const packExit = await appRuntime.runPromiseExit(
      FalconService.packPublicKey(pkNtt16),
    )

    if (Exit.isFailure(packExit)) {
      const errOpt = Cause.failureOption(packExit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Packing failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
      return
    }

    setPackedKey(Option.some(packExit.value))

    // Verify
    setStep({ step: "verifying", substep: "verify" })
    const verifyExit = await appRuntime.runPromiseExit(
      FalconService.verify(kp.verifyingKey, messageBytes, sigResult.signature),
    )

    if (Exit.isFailure(verifyExit)) {
      const errOpt = Cause.failureOption(verifyExit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Verification failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
      return
    }

    const durationMs = Date.now() - startTime
    setStep({ step: "complete", valid: verifyExit.value, durationMs })
  }, [keypair, message, setPackedKey, setSignature, setStep])

  const signatureHex = Option.match(signature, {
    onNone: () => null,
    onSome: (s) => "0x" + bytesToHex(s.signature),
  })

  const saltHex = Option.match(signature, {
    onNone: () => null,
    onSome: (s) => "0x" + bytesToHex(s.salt),
  })

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-falcon-text">Sign & Verify</h3>

      <div>
        <label
          htmlFor="message-input"
          className="block text-sm font-medium text-falcon-text"
        >
          Message
        </label>
        <input
          id="message-input"
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isBusy}
          placeholder="Enter a message to sign..."
          className="mt-1 w-full rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 font-mono text-sm text-falcon-text placeholder-falcon-muted focus:outline-none focus:ring-2 focus:ring-falcon-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <button
        onClick={handleSignAndVerify}
        aria-label="Sign and verify message"
        disabled={!canSign}
        className="rounded-lg bg-falcon-accent px-6 py-2.5 text-sm font-semibold text-falcon-text transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {step.step === "signing" || step.step === "packing" || step.step === "verifying"
          ? "Running..."
          : "Sign & Verify"}
      </button>

      {signatureHex !== null && step.step === "complete" && (
        <div className="space-y-3">
          <HexDisplay
            label={`Signature (${Option.match(signature, { onNone: () => 0, onSome: (s) => s.signature.length })} bytes)`}
            value={signatureHex}
            truncate={{ head: 18, tail: 8 }}
          />
          {saltHex !== null && (
            <HexDisplay
              label={`Salt (${Option.match(signature, { onNone: () => 0, onSome: (s) => s.salt.length })} bytes)`}
              value={saltHex}
              truncate={{ head: 18, tail: 8 }}
            />
          )}
        </div>
      )}

      {step.step === "complete" && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border p-4 ${
            step.valid
              ? "border-falcon-success/30 bg-falcon-success/10"
              : "border-falcon-error/30 bg-falcon-error/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={`text-xl font-bold ${step.valid ? "text-falcon-success" : "text-falcon-error"}`}>
              {step.valid ? "✓" : "✗"}
            </span>
            <span className="font-semibold text-falcon-text">
              {step.valid ? "Signature valid" : "Signature invalid"}
            </span>
            <span className="ml-auto text-sm text-falcon-muted">{step.durationMs}ms</span>
          </div>
        </div>
      )}

      {step.step === "error" && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-falcon-error/30 bg-falcon-error/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl font-bold text-falcon-error">✗</span>
            <div className="flex-1">
              <p className="font-semibold text-falcon-error">Error</p>
              <p className="mt-1 break-all text-sm text-falcon-muted">{step.message}</p>
            </div>
            <button
              onClick={() => setStep({ step: "idle" })}
              className="ml-auto rounded-lg border border-falcon-muted/30 px-3 py-1 text-xs text-falcon-muted hover:bg-falcon-surface"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Run typecheck**

Run: `cd apps/demo && bunx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/demo/src/components/interactive/SignVerifyPanel.tsx
git commit -m "feat(demo): SignVerifyPanel with signature/salt hex display"
```

---

## Task 7: Refactor VerificationPlayground to 2-panel layout

**Files:**
- Modify: `apps/demo/src/components/interactive/VerificationPlayground.tsx` (rewrite)

**Step 1: Rewrite VerificationPlayground to compose the two panels**

```typescript
// apps/demo/src/components/interactive/VerificationPlayground.tsx
"use client"

import React from "react"
import { KeyManagementPanel } from "./KeyManagementPanel"
import { SignVerifyPanel } from "./SignVerifyPanel"

export function VerificationPlayground(): React.JSX.Element {
  return (
    <section id="verify" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold tracking-tight text-falcon-text">
          Verification Playground
        </h2>
        <p className="mt-4 text-falcon-muted">
          Generate a Falcon-512 keypair in-browser via WASM, sign a message,
          and verify the signature. All crypto runs locally — no server
          involvement.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
            <KeyManagementPanel />
          </div>
          <div className="rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
            <SignVerifyPanel />
          </div>
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Run full test suite**

Run: `cd apps/demo && bun test`
Expected: Existing VerificationPlayground tests may need minor updates (check output).

**Step 3: Fix any broken tests**

The existing `verification-playground.test.tsx` tests for buttons by label. These should still work since the same labels exist in the sub-panels. If tests reference the old layout, update them to match the new component tree.

**Step 4: Commit**

```bash
git add apps/demo/src/components/interactive/VerificationPlayground.tsx
git commit -m "refactor(demo): split VerificationPlayground into 2-panel layout"
```

---

## Task 8: Class hash guard in AccountDeployFlow

**Files:**
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`

**Step 1: Add class hash guard banner and fix computing-address bug**

In `AccountDeployFlow.tsx`, add after the section description paragraph (around line 259):

```typescript
{networkConfig.classHash === "0x0" && (
  <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
    <p className="text-sm text-yellow-400">
      FalconAccount not declared on {networkConfig.name}.
      Run: <code className="rounded bg-falcon-bg px-1 font-mono text-xs">./bin/declare.sh {networkConfig.id}</code>
    </p>
  </div>
)}
```

Disable the "Prepare Deploy" button when classHash is "0x0":

```typescript
// Before the Prepare Deploy button, add:
const classHashValid = networkConfig.classHash !== "0x0"
```

In the button:

```typescript
{deployStep.step === "idle" && (
  <button
    onClick={handlePrepare}
    disabled={!classHashValid}
    className="rounded-lg bg-falcon-primary px-6 py-2.5 text-sm font-semibold text-falcon-text hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
  >
    Prepare Deploy
  </button>
)}
```

Fix the computing-address bug — remove line 129 (`setDeployStep({ step: "computing-address" })`), keeping only line 130.

**Step 2: Run typecheck**

Run: `cd apps/demo && bunx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/demo/src/components/interactive/AccountDeployFlow.tsx
git commit -m "feat(demo): add class hash guard banner and fix computing-address double-set"
```

---

## Task 9: Devnet prefunded accounts in StarknetService

**Files:**
- Modify: `apps/demo/src/services/StarknetService.ts`
- Test: `apps/demo/src/__tests__/starknet/prefunded-accounts.test.ts` (new)

**Step 1: Write the failing test**

```typescript
// apps/demo/src/__tests__/starknet/prefunded-accounts.test.ts
import { describe, it, expect, mock } from "bun:test"
import { parsePrefundedAccounts } from "../../services/StarknetService"

describe("parsePrefundedAccounts", () => {
  it("parses valid devnet response", () => {
    const raw = [
      { address: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691", private_key: "0x71d7bb07b9a64f6f78ac4c816aff4da9", initial_balance: "1000000000000000000000" },
      { address: "0x078662e7352d062084b0010068b99288486c2d8b914f6e2a55ce945f8792c8b1", private_key: "0xe1406455b7d66b1690803be066cbe5e", initial_balance: "1000000000000000000000" },
    ]
    const accounts = parsePrefundedAccounts(raw)
    expect(accounts.length).toBe(2)
    expect(accounts[0].address).toContain("0x064b")
    expect(accounts[0].private_key).toContain("0x71d7")
  })

  it("returns empty array for empty response", () => {
    const accounts = parsePrefundedAccounts([])
    expect(accounts.length).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/demo && bun test src/__tests__/starknet/prefunded-accounts.test.ts`
Expected: FAIL — `parsePrefundedAccounts` not found

**Step 3: Add fetchPrefundedAccounts and parsePrefundedAccounts to StarknetService.ts**

Add to `StarknetService.ts`, inside `makeService`:

```typescript
import { DevnetFetchError } from "./errors"
import type { DevnetAccount } from "./types"

// Add at module level (exported for testing):
export function parsePrefundedAccounts(raw: unknown[]): DevnetAccount[] {
  return raw
    .filter((item): item is Record<string, string> =>
      typeof item === "object" && item !== null &&
      "address" in item && "private_key" in item
    )
    .map((item) => ({
      address: item.address,
      private_key: item.private_key,
      initial_balance: item.initial_balance ?? "0",
    }))
}

// Add inside makeService, after waitForTx:
const fetchPrefundedAccounts = Effect.fn("Starknet.fetchPrefundedAccounts")(
  function* () {
    return yield* Effect.tryPromise({
      try: async () => {
        const baseUrl = rpcUrl.replace(/\/rpc.*$/, "").replace(/\/$/, "")
        const response = await fetch(`${baseUrl}/predeployed_accounts`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json()
        return parsePrefundedAccounts(data as unknown[])
      },
      catch: (error) =>
        new DevnetFetchError({ message: `Failed to fetch prefunded accounts: ${error}` }),
    })
  },
)

// Add to return object:
return {
  computeDeployAddress,
  getBalance,
  deployAccount,
  waitForTx,
  fetchPrefundedAccounts,
  provider,
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/demo && bun test src/__tests__/starknet/prefunded-accounts.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/demo/src/services/StarknetService.ts apps/demo/src/__tests__/starknet/prefunded-accounts.test.ts
git commit -m "feat(demo): add fetchPrefundedAccounts for devnet auto-populate"
```

---

## Task 10: Devnet account dropdown in AccountDeployFlow

**Files:**
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`

**Step 1: Add devnet account fetching and dropdown**

Add state for devnet accounts at the top of the component:

```typescript
const [devnetAccounts, setDevnetAccounts] = useState<DevnetAccount[]>([])
```

Add useEffect to fetch prefunded accounts when network is devnet:

```typescript
useEffect(() => {
  if (!networkConfig.isDevnet) {
    setDevnetAccounts([])
    return
  }
  let cancelled = false
  const fetchAccounts = async () => {
    const exit = await deployRuntimeRef.current.runPromiseExit(
      StarknetService.fetchPrefundedAccounts(),
    )
    if (!cancelled && Exit.isSuccess(exit)) {
      setDevnetAccounts(exit.value)
      if (exit.value.length > 0) {
        setPrivateKey(exit.value[0].private_key)
      }
    }
  }
  fetchAccounts()
  return () => { cancelled = true }
}, [networkConfig.isDevnet])
```

Replace the private key input section with conditional rendering:

```typescript
{networkConfig.isDevnet && devnetAccounts.length > 0 ? (
  <div>
    <label htmlFor="devnet-account" className="block text-sm font-medium text-falcon-text">
      Deployer Account
    </label>
    <select
      id="devnet-account"
      value={privateKey}
      onChange={(e) => setPrivateKey(e.target.value)}
      className="mt-1 w-full rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 font-mono text-sm text-falcon-text focus:outline-none focus:ring-2 focus:ring-falcon-primary"
    >
      {devnetAccounts.map((acc, i) => (
        <option key={acc.address} value={acc.private_key}>
          Account #{i} ({acc.address.slice(0, 10)}...{acc.address.slice(-4)})
        </option>
      ))}
    </select>
  </div>
) : (
  <div>
    <label htmlFor="deploy-private-key" className="block text-sm font-medium text-falcon-text">
      Deployer Private Key
    </label>
    <input
      id="deploy-private-key"
      type="password"
      autoComplete="off"
      value={privateKey}
      onChange={(event) => setPrivateKey(event.target.value)}
      placeholder="0x..."
      className="w-full rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 font-mono text-sm text-falcon-text placeholder-falcon-muted focus:outline-none focus:ring-2 focus:ring-falcon-primary"
    />
  </div>
)}
```

Also hide the faucet link when devnet:

```typescript
// Replace the faucet link condition:
{networkConfig.isTestnet && !networkConfig.isDevnet && (
```

Hide explorer link when no explorerBaseUrl:

```typescript
// Replace the Voyager link in deployed section:
{networkConfig.explorerBaseUrl && (
  <a href={`${networkConfig.explorerBaseUrl}/tx/${deployStep.txHash}`} ...>
    View on Voyager
  </a>
)}
```

**Step 2: Run typecheck**

Run: `cd apps/demo && bunx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/demo/src/components/interactive/AccountDeployFlow.tsx
git commit -m "feat(demo): devnet account dropdown with auto-populate from prefunded accounts"
```

---

## Task 11: WASM sign_for_starknet export (Rust)

**Files:**
- Modify: `falcon-rs` crate (WASM binding source)
- Rebuild: WASM artifacts in `apps/demo/public/wasm/`

**Step 1: Add sign_for_starknet to falcon-rs WASM bindings**

This task requires modifying the Rust crate. The exact file path depends on the falcon-rs source location. The function must:

1. Accept `sk: &[u8]`, `tx_hash: &str` (felt252 hex), `pk_ntt: &[i32]` (512 coefficients)
2. Sign `[tx_hash]` as the message using Falcon SK → extract raw s1 polynomial (512 Zq, mod Q)
3. Compute mul_hint via INTT(NTT(s1) * pk_ntt)
4. Pack s1 into 29 felt252 (base-Q Horner encoding)
5. Pack mul_hint into 29 felt252
6. Encode 40-byte salt as felt252 array
7. Serialize in Serde order matching `PackedFalconSignatureWithHint`
8. Return `JsValue` (string array of hex felt252)

**Step 2: Rebuild WASM**

Run: `cd falcon-rs && wasm-pack build --target web --out-dir ../apps/demo/public/wasm`

**Step 3: Update WasmModule interface and validator**

In `apps/demo/src/services/WasmRuntime.ts`, add to `WasmModule`:

```typescript
readonly sign_for_starknet: (
  sk: Uint8Array,
  txHash: string,
  pkNtt: Int32Array,
) => string[]
```

Update `isValidWasmModule` methods list:

```typescript
const methods = [
  "keygen", "sign", "verify",
  "create_verification_hint", "pack_public_key_wasm",
  "public_key_length", "salt_length",
  "sign_for_starknet",
] as const
```

**Step 4: Add signForStarknet to FalconService**

In `apps/demo/src/services/FalconService.ts`, add inside the Effect.gen:

```typescript
const signForStarknet = Effect.fn("Falcon.signForStarknet")(
  function* (
    secretKey: Uint8Array,
    txHash: string,
    pkNtt: Int32Array,
  ) {
    return yield* Effect.try({
      try: () => wasm.sign_for_starknet(secretKey, txHash, pkNtt),
      catch: (error) =>
        new SigningError({ message: String(error) }),
    })
  },
)

// Add to return object:
return {
  generateKeypair, sign, verify, createHint,
  packPublicKey, deserializePublicKeyNtt, signForStarknet,
}
```

**Step 5: Run typecheck**

Run: `cd apps/demo && bunx tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/demo/public/wasm/ apps/demo/src/services/WasmRuntime.ts apps/demo/src/services/FalconService.ts
git commit -m "feat(demo): add sign_for_starknet WASM export and FalconService method"
```

**Note:** This task cannot be fully completed until the falcon-rs Rust implementation is done. The frontend bindings can be added first with the WASM update as a follow-up.

---

## Task 12: FalconSigner (starknet.js SignerInterface)

**Files:**
- Create: `apps/demo/src/services/FalconSigner.ts`
- Test: `apps/demo/src/__tests__/starknet/falcon-signer.test.ts` (new)

**Step 1: Write the failing test**

```typescript
// apps/demo/src/__tests__/starknet/falcon-signer.test.ts
import { describe, it, expect } from "bun:test"
import { Effect, Exit, Layer, ManagedRuntime } from "effect"
import { FalconSigner } from "../../services/FalconSigner"
import { FalconService } from "../../services/FalconService"
import { WasmRuntime } from "../../services/WasmRuntime"
import type { WasmModule } from "../../services/WasmRuntime"

const mockWasm: WasmModule = {
  keygen: () => ({ sk: new Uint8Array(1281), vk: new Uint8Array(896) }),
  sign: () => ({ signature: new Uint8Array(666), salt: new Uint8Array(40) }),
  verify: () => true,
  create_verification_hint: () => new Uint16Array(512),
  pack_public_key_wasm: () => Array.from({ length: 29 }, () => "0x0"),
  public_key_length: () => 896,
  salt_length: () => 40,
  sign_for_starknet: (_sk, _txHash, _pkNtt) =>
    Array.from({ length: 61 }, (_, i) => `0x${i.toString(16)}`),
}

describe("FalconSigner", () => {
  it("implements signTransaction and returns string[]", async () => {
    const runtime = ManagedRuntime.make(
      FalconService.Default.pipe(
        Layer.provide(Layer.succeed(WasmRuntime, mockWasm)),
      ),
    )

    const signer = new FalconSigner(
      new Uint8Array(1281),
      new Int32Array(512),
      runtime,
    )

    const sig = await signer.signTransaction(
      [{ contractAddress: "0x1", entrypoint: "transfer", calldata: [] }],
      { walletAddress: "0x1", chainId: "0x1", version: "0x3" } as any,
    )

    expect(Array.isArray(sig)).toBe(true)
    expect(sig.length).toBe(61)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/demo && bun test src/__tests__/starknet/falcon-signer.test.ts`
Expected: FAIL — module not found

**Step 3: Implement FalconSigner**

```typescript
// apps/demo/src/services/FalconSigner.ts
import { Cause, Exit, ManagedRuntime, Option } from "effect"
import {
  type Call,
  type InvocationsSignerDetails,
  type DeployAccountSignerDetails,
  type DeclareSignerDetails,
  type Signature,
  hash,
  type SignerInterface,
} from "starknet"
import { FalconService } from "./FalconService"
import { TransactionSignError } from "./errors"

export class FalconSigner implements SignerInterface {
  constructor(
    private readonly sk: Uint8Array,
    private readonly pkNtt: Int32Array,
    private readonly runtime: ManagedRuntime.ManagedRuntime<FalconService, never>,
  ) {}

  async getPubKey(): Promise<string> {
    // Falcon public keys are not a single felt — return a placeholder.
    // The actual PK is the 29 packed felt252 slots stored in the contract.
    return "0x0"
  }

  async signTransaction(
    transactions: Call[],
    transactionsDetail: InvocationsSignerDetails,
  ): Promise<Signature> {
    const txHash = hash.calculateInvokeTransactionHash({
      ...transactionsDetail,
      senderAddress: transactionsDetail.walletAddress,
      compiledCalldata: transactions.flatMap((tx) => tx.calldata ?? []) as string[],
    })
    return this._signHash(txHash)
  }

  async signDeployAccountTransaction(
    transaction: DeployAccountSignerDetails,
  ): Promise<Signature> {
    const txHash = hash.calculateDeployAccountTransactionHash({
      ...transaction,
    })
    return this._signHash(txHash)
  }

  async signDeclareTransaction(
    transaction: DeclareSignerDetails,
  ): Promise<Signature> {
    const txHash = hash.calculateDeclareTransactionHash(transaction)
    return this._signHash(txHash)
  }

  private async _signHash(txHash: string): Promise<string[]> {
    const exit = await this.runtime.runPromiseExit(
      FalconService.signForStarknet(this.sk, txHash, this.pkNtt),
    )

    if (Exit.isSuccess(exit)) {
      return exit.value
    }

    const errOpt = Cause.failureOption(exit.cause)
    const msg = Option.match(errOpt, {
      onNone: () => "Falcon signing failed",
      onSome: (e) => e.message,
    })
    throw new TransactionSignError({ message: msg })
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/demo && bun test src/__tests__/starknet/falcon-signer.test.ts`
Expected: PASS

**Note:** The `signTransaction` implementation above uses `hash.calculateInvokeTransactionHash` — verify the exact starknet.js v9 API. The hash functions may have different parameter shapes. Adjust at implementation time based on the actual types.

**Step 5: Commit**

```bash
git add apps/demo/src/services/FalconSigner.ts apps/demo/src/__tests__/starknet/falcon-signer.test.ts
git commit -m "feat(demo): FalconSigner implementing starknet.js SignerInterface"
```

---

## Task 13: SendTransaction component and deploy integration

**Files:**
- Create: `apps/demo/src/components/interactive/SendTransaction.tsx`
- Modify: `apps/demo/src/services/StarknetService.ts` (add sendTransaction)
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx` (render SendTransaction after deployed)

**Step 1: Add sendTransaction to StarknetService**

Add inside `makeService` in `StarknetService.ts`:

```typescript
import { TransactionSubmitError } from "./errors"

const sendTransaction = Effect.fn("Starknet.sendTransaction")(
  function* (
    accountAddress: string,
    signer: SignerInterface,
    recipient: string,
    amount: bigint,
  ) {
    const account = new Account({ provider, address: accountAddress, signer })
    return yield* Effect.tryPromise({
      try: async () => {
        const result = await account.execute([
          {
            contractAddress: STRK_TOKEN_ADDRESS,
            entrypoint: "transfer",
            calldata: [recipient, amount.toString(), "0"],
          },
        ])
        await provider.waitForTransaction(result.transaction_hash)
        return { txHash: TxHash.make(result.transaction_hash) }
      },
      catch: (error) =>
        new TransactionSubmitError({ message: String(error) }),
    })
  },
)

// Add to return object
return {
  computeDeployAddress, getBalance, deployAccount,
  waitForTx, fetchPrefundedAccounts, sendTransaction, provider,
}
```

**Step 2: Create SendTransaction component**

```typescript
// apps/demo/src/components/interactive/SendTransaction.tsx
"use client"

import React, { useCallback, useState } from "react"
import { Cause, Exit, Option } from "effect"
import { useAtomValue } from "@effect-atom/atom-react"
import { keypairAtom } from "@/atoms/falcon"
import { networkAtom } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import { StarknetService, STRK_TOKEN_ADDRESS } from "@/services/StarknetService"
import { FalconSigner } from "@/services/FalconSigner"
import type { ContractAddress, TxHash } from "@/services/types"
import type { ManagedRuntime } from "effect"
import type { FalconService } from "@/services/FalconService"

interface SendTransactionProps {
  readonly deployedAddress: ContractAddress
  readonly deployRuntime: ManagedRuntime.ManagedRuntime<FalconService | StarknetService, never>
  readonly falconRuntime: ManagedRuntime.ManagedRuntime<FalconService, never>
}

export function SendTransaction({
  deployedAddress,
  deployRuntime,
  falconRuntime,
}: SendTransactionProps): React.JSX.Element {
  const keypair = useAtomValue(keypairAtom)
  const networkId = useAtomValue(networkAtom)
  const networkConfig = NETWORKS[networkId]

  const [recipient, setRecipient] = useState(deployedAddress as string)
  const [amount, setAmount] = useState("0.001")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ txHash: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSend = useCallback(async () => {
    const kp = Option.match(keypair, { onNone: () => null, onSome: (k) => k })
    if (!kp) return

    setSending(true)
    setError(null)
    setResult(null)

    const signer = new FalconSigner(kp.secretKey, kp.publicKeyNtt, falconRuntime)
    const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18))

    const exit = await deployRuntime.runPromiseExit(
      StarknetService.sendTransaction(
        deployedAddress as string,
        signer,
        recipient,
        amountWei,
      ),
    )

    setSending(false)

    if (Exit.isSuccess(exit)) {
      setResult({ txHash: exit.value.txHash })
    } else {
      const errOpt = Cause.failureOption(exit.cause)
      setError(
        Option.match(errOpt, {
          onNone: () => "Transaction failed",
          onSome: (e) => e.message,
        }),
      )
    }
  }, [keypair, deployedAddress, recipient, amount, deployRuntime, falconRuntime])

  return (
    <div className="mt-6 rounded-xl border border-falcon-muted/20 bg-falcon-surface p-5">
      <h3 className="font-semibold text-falcon-text">Test Your Falcon Account</h3>
      <p className="mt-1 text-sm text-falcon-muted">
        Send STRK using your post-quantum account.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="tx-recipient" className="block text-sm font-medium text-falcon-text">
            Recipient
          </label>
          <input
            id="tx-recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="mt-1 w-full rounded-lg border border-falcon-muted/30 bg-falcon-bg px-4 py-2 font-mono text-sm text-falcon-text focus:outline-none focus:ring-2 focus:ring-falcon-primary"
          />
        </div>

        <div>
          <label htmlFor="tx-amount" className="block text-sm font-medium text-falcon-text">
            Amount (STRK)
          </label>
          <input
            id="tx-amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-falcon-muted/30 bg-falcon-bg px-4 py-2 font-mono text-sm text-falcon-text focus:outline-none focus:ring-2 focus:ring-falcon-primary"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !Option.isSome(keypair)}
          className="rounded-lg bg-falcon-accent px-6 py-2.5 text-sm font-semibold text-falcon-text hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send STRK"}
        </button>
      </div>

      {result !== null && (
        <div className="mt-4 rounded-xl border border-falcon-success/30 bg-falcon-success/10 p-4">
          <p className="font-semibold text-falcon-success">Transaction Confirmed</p>
          <p className="mt-1 break-all font-mono text-xs text-falcon-text">
            Tx: {result.txHash}
          </p>
          {networkConfig.explorerBaseUrl && (
            <a
              href={`${networkConfig.explorerBaseUrl}/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-block text-sm text-falcon-accent hover:underline"
            >
              View on Voyager
            </a>
          )}
        </div>
      )}

      {error !== null && (
        <div className="mt-4 rounded-xl border border-falcon-error/30 bg-falcon-error/10 p-4">
          <p className="text-sm text-falcon-error">{error}</p>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Integrate into AccountDeployFlow**

In `AccountDeployFlow.tsx`, after the deployed success card, add:

```typescript
{deployStep.step === "deployed" && (
  <>
    {/* existing deployed card */}
    <SendTransaction
      deployedAddress={deployStep.address}
      deployRuntime={deployRuntimeRef.current}
      falconRuntime={appRuntime}
    />
  </>
)}
```

Import `SendTransaction` and the `appRuntime` from the module (or create a shared falcon-only runtime).

**Step 4: Run typecheck**

Run: `cd apps/demo && bunx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/demo/src/components/interactive/SendTransaction.tsx apps/demo/src/services/StarknetService.ts apps/demo/src/components/interactive/AccountDeployFlow.tsx
git commit -m "feat(demo): SendTransaction component for post-deploy STRK transfer"
```

---

## Task 14: End-to-end smoke test with devnet

**Files:** None (manual verification)

**Step 1: Build the app**

Run: `cd apps/demo && bun run build`
Expected: PASS (no build errors)

**Step 2: Run full test suite**

Run: `cd apps/demo && bun test`
Expected: All tests pass

**Step 3: Start starknet-devnet**

Run: `starknet-devnet --seed 0`
Expected: Devnet starts on port 5050 with deterministic accounts

**Step 4: Declare FalconAccount on devnet**

Run: `scarb build --package falcon_account && ./bin/declare.sh devnet`
Expected: Class hash is returned and patched into `networks.ts`

**Step 5: Start the demo app**

Run: `cd apps/demo && bun run dev`
Expected: App starts on localhost:3000

**Step 6: Manual smoke test**

1. Select "Devnet" in the network pill
2. In Verification Playground:
   - Click Generate → key appears in left panel with VK hex, expandable NTT and packed sections
   - Click Export → downloads `falcon-keypair.json`
   - Click Import → loads the same file back
   - Type a message → click Sign & Verify → shows signature, salt, and "Signature valid"
3. In Account Deploy Flow:
   - Devnet account dropdown is populated
   - No class hash warning (since we declared)
   - Click Prepare Deploy → steps 1-4 go green, shows funded address
   - Click Deploy Account → step 5 goes green, shows tx hash
   - SendTransaction panel appears → self-transfer 0.001 STRK → confirms

**Step 7: Commit final state**

```bash
git add -A
git commit -m "chore(demo): end-to-end devnet verification complete"
```

---

## Dependency Graph

```
Task 1 (networks)
  └─→ Task 2 (declare script)
  └─→ Task 3 (types/errors)
        └─→ Task 4 (keyfile)
        │     └─→ Task 5 (KeyManagementPanel)
        │     └─→ Task 6 (SignVerifyPanel)
        │           └─→ Task 7 (VerificationPlayground refactor)
        └─→ Task 8 (class hash guard)
        └─→ Task 9 (prefunded accounts)
        │     └─→ Task 10 (devnet dropdown)
        └─→ Task 11 (WASM sign_for_starknet) ⚠️ Requires Rust work
              └─→ Task 12 (FalconSigner)
                    └─→ Task 13 (SendTransaction)
                          └─→ Task 14 (smoke test)
```

Tasks 1-10 can proceed without the WASM changes. Tasks 11-14 require the falcon-rs Rust update.

## Parallelizable Groups

- **Group A** (no dependencies): Tasks 1, 2 (can run in parallel)
- **Group B** (after Task 1): Tasks 3, 8 (can run in parallel)
- **Group C** (after Task 3): Tasks 4, 9 (can run in parallel)
- **Group D** (after Task 4): Tasks 5, 6 (can run in parallel)
- **Group E** (after Tasks 5+6): Task 7
- **Group F** (after Task 9): Task 10
- **Group G** (Rust work, independent): Task 11
- **Group H** (after Tasks 11+G): Tasks 12, 13, 14 (sequential)
