# Demo App Production Release — Design Document

**Date:** 2026-02-25
**Branch:** `frontend`
**Status:** Approved

---

## Goals

1. Make the Verification Playground professional and coherent — clear narrative from key generation through verification, with key import/export for falcon-rs CLI interop
2. Unlock the Account Deploy Flow end-to-end — from keypair to deployed account to sending a transaction
3. Add starknet-devnet as a third network for fast local development
4. Keep the signature format opaque to the frontend — only Cairo + Rust own the serialization

---

## 1. Network Configuration — Add Devnet

### 1.1 networks.ts

Add `"devnet"` to the `NetworkId` union type:

```typescript
export type NetworkId = "devnet" | "sepolia" | "mainnet"
```

New entry in `NETWORKS`:

```typescript
devnet: {
  id: "devnet",
  name: "Devnet",
  rpcUrl: "http://localhost:5050",
  classHash: "0x0",              // Patched by declare script
  explorerBaseUrl: "",           // No explorer for devnet
  isTestnet: true,
  isDevnet: true,                // New flag
}
```

### 1.2 NetworkConfig interface

Add `isDevnet: boolean` field. Defaults to `false` for Sepolia and Mainnet.

### 1.3 Network switcher

The existing pill toggle in NavHeader shows 3 options: Devnet | Sepolia | Mainnet.

### 1.4 Devnet-specific behaviors

- Hide faucet link when `isDevnet === true`
- Hide explorer links when `explorerBaseUrl === ""`
- Auto-fetch prefunded accounts (see Section 3.2)
- Launch devnet with `--seed 0` for deterministic account keys

### 1.5 CLI scripts — unified `bin/declare.sh`

Single idempotent script replacing `declare-sepolia.sh`:

```bash
./bin/declare.sh devnet|sepolia|mainnet
```

Behavior:
- Reads network-specific sncast profile from `sncast.toml`
- Runs `sncast declare` — if class already declared, extracts existing hash
- Auto-patches `networks.ts` with the returned class hash via `sed`
- Each network has its own `[profile.<network>]` in `sncast.toml`

---

## 2. Verification Playground — Panel-based Key Manager

### 2.1 Layout

2-panel responsive grid (`grid-cols-1 lg:grid-cols-2`):

```
+----------------------------+----------------------------+
|   KEY MANAGEMENT           |   SIGN & VERIFY            |
|                            |                            |
| [Generate] [Import] [Export]  Message: [____________]   |
|                            |                            |
| Verifying Key (896 bytes)  | [Sign & Verify]            |
|   0xabc...def  [Copy]     |                            |
|                            | Signature (666 bytes)      |
| > NTT Coefficients (512)  |   0xfed...321  [Copy]      |
|   [1234, 5678, ...]       | Salt (40 bytes)            |
|                            |   0x...  [Copy]            |
| > Packed Key (29 slots)   |                            |
|   [0x..., 0x..., ...]     | Result: VALID  142ms       |
+----------------------------+----------------------------+
```

On mobile (`< lg`), panels stack vertically: Key Management on top, Sign & Verify below.

### 2.2 Left Panel — Key Management

**Action buttons:**
- `[Generate]` — generates fresh Falcon-512 keypair via WASM, stores in `keypairAtom`
- `[Import]` — opens file picker for `.json`, validates against schema, loads keypair
- `[Export]` — triggers browser download of `falcon-keypair.json`

**After key is loaded, shows (all with copy buttons):**
- **Verifying Key** — truncated hex, label: "896-byte public key (h polynomial)"
- **NTT Coefficients** — expandable/collapsible, 512 Zq values, "show all" toggle
- **Packed Public Key** — expandable, 29 felt252 slots with copy-all

**Packed key is computed eagerly on key load** (not deferred to Sign & Verify). This makes the VK → NTT → packed relationship immediately visible.

### 2.3 Right Panel — Sign & Verify

- Message text input
- `[Sign & Verify]` button (disabled until key loaded + message non-empty)
- Results after completion:
  - **Signature** — hex with copy, byte count label
  - **Salt** — hex (40 bytes)
  - **Verification Result** — valid/invalid badge with timing in ms

### 2.4 Key file format

```json
{
  "version": 1,
  "algorithm": "falcon-512",
  "secretKey": "0xabc...def",
  "verifyingKey": "0x123...789",
  "publicKeyNtt": [1234, 5678, ...],
  "packedPublicKey": ["0x...", ...]
}
```

- `secretKey` + `verifyingKey`: hex-encoded raw bytes
- `publicKeyNtt`: 512 integers in [0, 12289)
- `packedPublicKey`: 29 hex strings (felt252)
- Import validates: version, algorithm, array lengths, coefficient bounds
- Export includes all fields — single file for both demo app and falcon-rs CLI

### 2.5 Shared keypair atom

Both Verification Playground and Account Deploy Flow read/write `keypairAtom`. Importing a key in the playground automatically makes it available for deployment.

---

## 3. Account Deploy Flow — End-to-End

### 3.1 Class hash guard

When `classHash === "0x0"` for the selected network:
- Show a warning banner above the deploy steps:
  > "FalconAccount not declared on {network}. Run: `./bin/declare.sh {network}`"
- Disable the "Prepare Deploy" button
- Replaces the current silent failure where `computeDeployAddress` computes a garbage address

### 3.2 Devnet prefunded accounts

New Effect service method: `StarknetService.fetchPrefundedAccounts()`
- Calls `GET {rpcUrl}/predeployed_accounts` (devnet REST API, not JSON-RPC)
- Returns `Array<{ address: string, private_key: string, initial_balance: string }>`

When `isDevnet === true`:
- Replace the private key text input with a dropdown of prefunded accounts
- Display format: `Account #0 (0x064b...)`
- Selecting an account auto-fills the deployer private key
- The "Fund Account" step auto-completes when balance polling returns > 0 on first check

When `isDevnet === false`:
- Keep current manual key input + faucet link flow

### 3.3 Deploy flow steps

1. **Generate Keypair** — reuses from `keypairAtom` (shared with playground) or generates fresh
2. **Pack Public Key** — runs `packPublicKey` on the NTT coefficients
3. **Compute Address** — `computeDeployAddress` with real class hash + salt (salt saved for reuse)
4. **Fund Account** — balance polling at 5s interval; auto-skipped on devnet if already funded
5. **Deploy** — `deployAccount` with saved salt; shows tx hash + address

**Bug fix:** Remove the dead `computing-address` state set (line 129 in current code) that is immediately overwritten by `awaiting-funds`.

### 3.4 Step 6: Send Transaction (new)

After successful deployment, a new panel appears: "Test Your Falcon Account".

**UI:**
- **Recipient address** — text input, defaults to deployer's own address (self-transfer)
- **Amount** — STRK amount input (default: 0.001 STRK)
- `[Send STRK]` button

**Flow:**
1. Construct STRK `transfer(recipient, amount)` call
2. Sign transaction with `FalconSigner` (calls `sign_for_starknet` via WASM)
3. Submit via starknet.js `Account.execute()`
4. Wait for confirmation
5. Display: tx hash, explorer link (if available), updated balance

**DeployStep state machine update:**
```typescript
... | { step: "sending-tx"; address: ContractAddress }
    | { step: "tx-confirmed"; address: ContractAddress; txHash: TxHash; transferTxHash: TxHash }
```

---

## 4. WASM Exports & FalconSigner

### 4.1 New WASM export: `sign_for_starknet`

```rust
#[wasm_bindgen]
pub fn sign_for_starknet(
    sk: &[u8],
    tx_hash: &str,       // felt252 hex
    pk_ntt: &[i32],      // 512 Zq coefficients
) -> JsValue             // string[] — felt252 hex array
```

Internally:
1. Sign the message `[tx_hash]` with Falcon SK → extract raw s1 polynomial (512 Zq)
2. Compute `mul_hint = INTT(NTT(s1) * pk_ntt)` via the existing hint logic
3. Pack s1 into 29 felt252 (base-Q packing)
4. Pack mul_hint into 29 felt252
5. Encode 40-byte salt as felt252 array
6. Serialize in Serde-compatible order matching `PackedFalconSignatureWithHint`:
   `[...s1_packed(29), salt_len, ...salt_felts, ...mul_hint_packed(29)]`
7. Return as `string[]` of hex felt252 values

**The serialization format is opaque to the frontend.** Only Cairo and Rust know the layout. Changing the on-chain signature format requires updating the Cairo contract + this Rust function. Zero frontend changes.

### 4.2 Existing WASM exports (unchanged)

These stay for the Verification Playground (educational display of intermediate values):

| Export | Purpose |
|--------|---------|
| `keygen(seed)` | Generate keypair |
| `sign(sk, msg, salt)` | Sign (compressed bytes) |
| `verify(vk, msg, sig)` | Verify signature |
| `create_verification_hint(s1, pk_ntt)` | Compute mul_hint |
| `pack_public_key_wasm(pk_ntt)` | Pack 512 Zq → 29 felt252 |
| `public_key_length()` | Returns 512 |
| `salt_length()` | Returns 40 |

### 4.3 FalconSigner (starknet.js SignerInterface)

```typescript
class FalconSigner implements SignerInterface {
  constructor(
    private readonly sk: Uint8Array,
    private readonly pkNtt: Int32Array,
    private readonly runtime: ManagedRuntime<FalconService>,
  ) {}

  async signTransaction(txHash: string): Promise<string[]> {
    const exit = await this.runtime.runPromiseExit(
      FalconService.signForStarknet(this.sk, txHash, this.pkNtt),
    )
    // Returns opaque felt252[] → passed directly to starknet.js
  }
}
```

The signer calls a single WASM function and returns the result unchanged. It has no knowledge of the signature format.

### 4.4 New StarknetService method

```typescript
sendTransaction(
  account: Account,        // starknet.js Account with FalconSigner
  recipient: string,
  amount: bigint,
): Effect<{ txHash: TxHash }, TransactionSubmitError>
```

Constructs a STRK transfer call and executes via `account.execute()`.

### 4.5 New Effect error types

- `TransactionSignError extends Schema.TaggedError` — Falcon signing or hint generation failed
- `TransactionSubmitError extends Schema.TaggedError` — RPC submission failed

### 4.6 Boundary of responsibilities

| Concern | Owner |
|---------|-------|
| Signature format, packing layout, serialization order, salt encoding | **Rust + Cairo** |
| UX flow, calling `signForStarknet(sk, txHash, pkNtt)`, passing result to starknet.js | **Frontend (Effect)** |
| Key generation, import/export, display | **Frontend (Effect + WASM)** |
| Contract declaration, class hash management | **CLI scripts** |

---

## 5. Effect Patterns

All new code follows the existing Effect patterns in the codebase:

- **Services:** `Effect.Service` with `Effect.fn` for tracing
- **Errors:** `Schema.TaggedError` with `{ message: string }` minimum
- **State:** Effect atoms via `@effect-atom/atom-react` (useAtomValue, useAtomSet)
- **Runtime:** `ManagedRuntime.make()` with `Layer.mergeAll()` for service composition
- **Error handling:** `Exit.isSuccess/isFailure` + `Cause.failureOption` + `Option.match` (never throw)
- **No useState for domain state** — all in atoms. useState only for ephemeral UI state (form inputs)

---

## 6. File Changes Summary

### New files
| File | Purpose |
|------|---------|
| `bin/declare.sh` | Unified declaration script (replaces `declare-sepolia.sh`) |
| `apps/demo/src/services/FalconSigner.ts` | starknet.js SignerInterface wrapper |
| `apps/demo/src/components/interactive/KeyManagementPanel.tsx` | Left panel of verification playground |
| `apps/demo/src/components/interactive/SignVerifyPanel.tsx` | Right panel of verification playground |
| `apps/demo/src/components/interactive/SendTransaction.tsx` | Post-deploy transaction UI |

### Modified files
| File | Change |
|------|--------|
| `apps/demo/src/config/networks.ts` | Add devnet entry, `isDevnet` flag |
| `apps/demo/src/services/StarknetService.ts` | Add `fetchPrefundedAccounts`, `sendTransaction` |
| `apps/demo/src/services/FalconService.ts` | Add `signForStarknet` method |
| `apps/demo/src/services/types.ts` | Add key file schema, new error types, extended DeployStep |
| `apps/demo/src/services/errors.ts` | Add `TransactionSignError`, `TransactionSubmitError` |
| `apps/demo/src/atoms/starknet.ts` | Extended DeployStep union |
| `apps/demo/src/components/interactive/VerificationPlayground.tsx` | Refactor to 2-panel layout |
| `apps/demo/src/components/interactive/AccountDeployFlow.tsx` | Class hash guard, devnet dropdown, step 6 |
| `apps/demo/src/components/interactive/accountDeployPipeline.ts` | Add send transaction effect |
| `falcon-rs (WASM)` | Add `sign_for_starknet` export |
| `sncast.toml` | Add devnet + mainnet profiles |

### Deleted files
| File | Reason |
|------|--------|
| `bin/declare-sepolia.sh` | Replaced by unified `bin/declare.sh` |
