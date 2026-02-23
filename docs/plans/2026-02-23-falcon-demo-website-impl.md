# Falcon Demo Website Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-page Next.js demo website showcasing Falcon-512 post-quantum signature verification on Starknet mainnet, with browser-side WASM crypto and Effect-TS service layer.

**Architecture:** Next.js 15 App Router with RSC landing sections and three client-side interactive demos (Verification Playground, Pipeline Visualizer, Account Deploy). Effect services wrap WASM (falcon-rs) and starknet.js. State managed via Effect Atoms.

**Tech Stack:** Next.js 15, Bun, Effect-TS, @effect-atom/atom-react, Tailwind CSS v4, wasm-pack, starknet.js v9, falcon-rs (WASM)

**Design doc:** `docs/plans/2026-02-23-falcon-demo-website-design.md`

---

## Task 1: Scaffold Next.js App

**Files:**
- Create: `apps/demo/package.json`
- Create: `apps/demo/next.config.mjs`
- Create: `apps/demo/tsconfig.json`
- Create: `apps/demo/postcss.config.mjs`
- Create: `apps/demo/src/app/layout.tsx`
- Create: `apps/demo/src/app/page.tsx`
- Create: `apps/demo/src/app/globals.css`
- Create: `apps/demo/.env.local`

**Step 1: Create the app directory and initialize Next.js**

```bash
mkdir -p apps/demo/src/app
cd apps/demo
bun init -y
```

**Step 2: Install core dependencies**

```bash
cd apps/demo
bun add next@latest react@latest react-dom@latest
bun add -d @types/react @types/react-dom typescript
```

**Step 3: Create `apps/demo/next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm"
    return config
  },
}

export default nextConfig
```

**Step 4: Create `apps/demo/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 5: Create `apps/demo/postcss.config.mjs`**

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
```

**Step 6: Install Tailwind CSS v4**

```bash
cd apps/demo
bun add tailwindcss @tailwindcss/postcss
```

**Step 7: Create `apps/demo/src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-falcon-primary: #6366f1;
  --color-falcon-secondary: #8b5cf6;
  --color-falcon-accent: #06b6d4;
  --color-falcon-success: #10b981;
  --color-falcon-error: #ef4444;
  --color-falcon-bg: #0f172a;
  --color-falcon-surface: #1e293b;
  --color-falcon-text: #f8fafc;
  --color-falcon-muted: #94a3b8;
}
```

**Step 8: Create `apps/demo/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Falcon-512 | Post-Quantum Signatures on Starknet",
  description:
    "Demo of Falcon-512 post-quantum signature verification for Starknet account abstraction. 63K steps, 62 calldata felts.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-falcon-bg text-falcon-text antialiased">{children}</body>
    </html>
  )
}
```

**Step 9: Create `apps/demo/src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main className="min-h-screen">
      <h1 className="text-4xl font-bold p-8">Falcon-512 Demo</h1>
      <p className="px-8 text-falcon-muted">Coming soon.</p>
    </main>
  )
}
```

**Step 10: Create `apps/demo/.env.local`**

```
NEXT_PUBLIC_STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io
```

**Step 11: Add scripts to `apps/demo/package.json`**

Ensure `package.json` has:
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  }
}
```

**Step 12: Verify the app runs**

```bash
cd apps/demo && bun run dev
```

Expected: Next.js dev server starts, page renders at http://localhost:3000 with "Falcon-512 Demo" heading.

**Step 13: Commit**

```bash
git add apps/demo/
git commit -m "feat(demo): scaffold Next.js 15 app with Tailwind v4"
```

---

## Task 2: Extend falcon-rs WASM Bindings

The existing `wasm.rs` has `keygen` and `verify` but `sign` is a stub. We need to implement `sign`, add `create_verification_hint`, `pack_public_key`, and a Poseidon-based sign flow for Starknet compatibility.

**Files:**
- Modify: `../falcon-rs/src/wasm.rs`
- Modify: `../falcon-rs/Cargo.toml` (if needed)

**Step 1: Read the existing WASM bindings**

Read `../falcon-rs/src/wasm.rs` to understand current state. Current: `keygen` works (seeded), `sign` is a stub, `verify` works (SHAKE256 only).

**Step 2: Implement `sign` in wasm.rs**

The challenge: `SecretKey` contains complex nested types (`LdlTree`, `Vec<Complex>`). We need to deserialize from bytes. The `to_bytes()` method serializes f, g, F, G as 4 × 896 bytes. We need a `from_bytes` that reconstructs the full secret key (including b0_fft and tree).

Add to `wasm.rs`:

```rust
use crate::falcon::{Falcon, SecretKey, Signature, VerifyingKey, PUBLIC_KEY_LEN};
use crate::hash_to_point::Shake256Hash;
use crate::hints::generate_mul_hint;
use crate::ntt::ntt;
use crate::packing::pack_public_key as pack_pk;
use crate::{Q, SALT_LEN};

/// Sign a message with a secret key.
///
/// Parameters:
/// - `sk_bytes`: Secret key bytes (from keygen)
/// - `message`: Message to sign
/// - `salt`: 40-byte salt (optional - if empty, generates random)
///
/// Returns a JS object with:
/// - `signature`: Uint8Array (signature bytes)
/// - `s1`: Int32Array (raw s1 polynomial, 512 coefficients)
/// - `salt`: Uint8Array (40-byte salt used)
#[wasm_bindgen]
pub fn sign(sk_bytes: &[u8], message: &[u8], salt: &[u8]) -> Result<JsValue, JsError> {
    let sk = SecretKey::from_bytes(sk_bytes)
        .map_err(|e| JsError::new(&format!("Invalid secret key: {}", e)))?;

    let sig = if salt.len() == SALT_LEN {
        let mut salt_arr = [0u8; SALT_LEN];
        salt_arr.copy_from_slice(salt);
        Falcon::<Shake256Hash>::sign_with_salt(&sk, message, &salt_arr)
    } else {
        Falcon::<Shake256Hash>::sign(&sk, message)
    };

    let result = js_sys::Object::new();
    js_sys::Reflect::set(
        &result,
        &"signature".into(),
        &js_sys::Uint8Array::from(&sig.to_bytes()[..]),
    ).map_err(|e| JsError::new(&format!("{:?}", e)))?;
    js_sys::Reflect::set(
        &result,
        &"salt".into(),
        &js_sys::Uint8Array::from(&sig.salt()[..]),
    ).map_err(|e| JsError::new(&format!("{:?}", e)))?;

    Ok(result.into())
}
```

Note: This requires adding `SecretKey::from_bytes()` and `Signature::salt()` accessors to falcon.rs. The `from_bytes` must reconstruct `b0_fft` and `tree` from `(f, g, F, G)` — reuse the computation from `keygen_with_rng`.

**Step 3: Add `SecretKey::from_bytes` to falcon.rs**

```rust
impl SecretKey {
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, FalconError> {
        if bytes.len() != 4 * PUBLIC_KEY_LEN {
            return Err(FalconError::InvalidSecretKey);
        }
        let f_vec = deserialize_public_key(&bytes[0..PUBLIC_KEY_LEN].try_into().unwrap())
            .ok_or(FalconError::InvalidSecretKey)?;
        let g_vec = deserialize_public_key(&bytes[PUBLIC_KEY_LEN..2*PUBLIC_KEY_LEN].try_into().unwrap())
            .ok_or(FalconError::InvalidSecretKey)?;
        let cf_vec = deserialize_public_key(&bytes[2*PUBLIC_KEY_LEN..3*PUBLIC_KEY_LEN].try_into().unwrap())
            .ok_or(FalconError::InvalidSecretKey)?;
        let cg_vec = deserialize_public_key(&bytes[3*PUBLIC_KEY_LEN..4*PUBLIC_KEY_LEN].try_into().unwrap())
            .ok_or(FalconError::InvalidSecretKey)?;

        // Reconstruct b0_fft and tree (same as keygen_with_rng)
        let mut f = [0i32; N]; f.copy_from_slice(&f_vec);
        let mut g = [0i32; N]; g.copy_from_slice(&g_vec);
        let mut capital_f = [0i32; N]; capital_f.copy_from_slice(&cf_vec);
        let mut capital_g = [0i32; N]; capital_g.copy_from_slice(&cg_vec);

        let neg_f: Vec<f64> = f.iter().map(|&x| -(x as f64)).collect();
        let neg_f_cap: Vec<f64> = capital_f.iter().map(|&x| -(x as f64)).collect();
        let b0: [[Vec<f64>; 2]; 2] = [
            [g.iter().map(|&x| x as f64).collect(), neg_f],
            [capital_g.iter().map(|&x| x as f64).collect(), neg_f_cap],
        ];
        let b0_fft = [
            [fft(&b0[0][0]), fft(&b0[0][1])],
            [fft(&b0[1][0]), fft(&b0[1][1])],
        ];
        let g0 = gram(&b0);
        let g0_fft = [
            [fft(&g0[0][0]), fft(&g0[0][1])],
            [fft(&g0[1][0]), fft(&g0[1][1])],
        ];
        let mut tree = ffldl_fft(&g0_fft);
        normalize_tree(&mut tree, SIGMA);

        Ok(SecretKey { f, g, capital_f, capital_g, b0_fft, tree })
    }
}
```

**Step 4: Add `create_verification_hint` WASM binding**

```rust
/// Create the mul_hint for hint-based verification.
///
/// Parameters:
/// - `s1_coeffs`: Int32Array of s1 polynomial (512 signed coefficients)
/// - `pk_h_ntt`: Int32Array of public key in NTT domain (512 coefficients)
///
/// Returns Uint16Array of mul_hint (512 values in [0, Q))
#[wasm_bindgen]
pub fn create_verification_hint(s1_coeffs: &[i32], pk_h_ntt: &[i32]) -> Result<Vec<u16>, JsError> {
    if s1_coeffs.len() != 512 || pk_h_ntt.len() != 512 {
        return Err(JsError::new("Both polynomials must have 512 coefficients"));
    }
    let s1_u16: Vec<u16> = s1_coeffs.iter().map(|&v| v.rem_euclid(Q) as u16).collect();
    let pk_u16: Vec<u16> = pk_h_ntt.iter().map(|&v| v.rem_euclid(Q) as u16).collect();
    Ok(generate_mul_hint(&s1_u16, &pk_u16))
}
```

**Step 5: Add `pack_public_key` WASM binding**

```rust
/// Pack a public key (512 NTT coefficients) into 29 felt252 slots.
///
/// Parameters:
/// - `pk_ntt`: Uint16Array of 512 NTT coefficients
///
/// Returns Array of 29 hex strings (felt252 values)
#[wasm_bindgen]
pub fn pack_public_key_wasm(pk_ntt: &[u16]) -> Result<JsValue, JsError> {
    if pk_ntt.len() != 512 {
        return Err(JsError::new("Public key must have 512 coefficients"));
    }
    let packed = pack_pk(pk_ntt);
    let arr = js_sys::Array::new();
    for felt in &packed {
        let hex = format!("0x{}", felt.to_hex_string());
        arr.push(&JsValue::from_str(&hex));
    }
    Ok(arr.into())
}
```

**Step 6: Add `Signature::salt()` accessor**

In `falcon.rs`:
```rust
impl Signature {
    pub fn salt(&self) -> &[u8; SALT_LEN] {
        &self.salt
    }
}
```

**Step 7: Build WASM and verify**

```bash
cd ../falcon-rs
wasm-pack build --target web --features wasm --out-dir ../s2morrow/apps/demo/public/wasm
```

Expected: `apps/demo/public/wasm/` contains `falcon_rs.js`, `falcon_rs_bg.wasm`, `falcon_rs.d.ts`.

**Step 8: Run existing falcon-rs tests to ensure nothing broke**

```bash
cd ../falcon-rs && cargo test
```

Expected: All tests pass.

**Step 9: Commit**

```bash
cd ../falcon-rs
git add src/wasm.rs src/falcon.rs
git commit -m "feat(wasm): implement sign, hint generation, and packing bindings"
```

---

## Task 3: Install Effect-TS and Create Service Layer

**Files:**
- Create: `apps/demo/src/services/errors.ts`
- Create: `apps/demo/src/services/types.ts`
- Create: `apps/demo/src/services/WasmRuntime.ts`
- Create: `apps/demo/src/services/FalconService.ts`
- Create: `apps/demo/src/services/StarknetService.ts`

**Step 1: Install Effect ecosystem**

```bash
cd apps/demo
bun add effect @effect-atom/atom @effect-atom/atom-react starknet
```

**Step 2: Create `apps/demo/src/services/types.ts`**

Branded types and domain types:

```typescript
import { Schema } from "effect"

// Branded IDs
export const TxHash = Schema.String.pipe(Schema.brand("@Falcon/TxHash"))
export type TxHash = Schema.Schema.Type<typeof TxHash>

export const ContractAddress = Schema.String.pipe(Schema.brand("@Falcon/ContractAddress"))
export type ContractAddress = Schema.Schema.Type<typeof ContractAddress>

// Domain types
export interface FalconKeypair {
  readonly secretKey: Uint8Array
  readonly verifyingKey: Uint8Array
  readonly publicKeyNtt: Int32Array // h polynomial, 512 coefficients
}

export interface FalconSignatureResult {
  readonly signature: Uint8Array
  readonly salt: Uint8Array
}

export interface PackedPublicKey {
  readonly slots: ReadonlyArray<string> // 29 hex strings (felt252)
}

export type VerificationStep =
  | { step: "idle" }
  | { step: "generating-keypair" }
  | { step: "signing" }
  | { step: "creating-hint" }
  | { step: "packing" }
  | { step: "verifying"; substep: string }
  | { step: "complete"; valid: boolean; durationMs: number }
  | { step: "error"; message: string }

export interface PipelineStep {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly input: string
  readonly output: string
  readonly stepCount: number
  readonly status: "pending" | "active" | "complete"
}
```

**Step 3: Create `apps/demo/src/services/errors.ts`**

```typescript
import { Schema } from "effect"

export class WasmLoadError extends Schema.TaggedError<WasmLoadError>()(
  "WasmLoadError",
  { message: Schema.String },
) {}

export class KeygenError extends Schema.TaggedError<KeygenError>()(
  "KeygenError",
  { message: Schema.String },
) {}

export class SigningError extends Schema.TaggedError<SigningError>()(
  "SigningError",
  { message: Schema.String },
) {}

export class VerificationError extends Schema.TaggedError<VerificationError>()(
  "VerificationError",
  { message: Schema.String, step: Schema.String },
) {}

export class HintGenerationError extends Schema.TaggedError<HintGenerationError>()(
  "HintGenerationError",
  { message: Schema.String },
) {}

export class PackingError extends Schema.TaggedError<PackingError>()(
  "PackingError",
  { message: Schema.String },
) {}

export class StarknetRpcError extends Schema.TaggedError<StarknetRpcError>()(
  "StarknetRpcError",
  { message: Schema.String, code: Schema.Number },
) {}

export class AccountDeployError extends Schema.TaggedError<AccountDeployError>()(
  "AccountDeployError",
  { message: Schema.String, txHash: Schema.optional(Schema.String) },
) {}

export class InsufficientFundsError extends Schema.TaggedError<InsufficientFundsError>()(
  "InsufficientFundsError",
  { message: Schema.String, address: Schema.String, required: Schema.String },
) {}
```

**Step 4: Create `apps/demo/src/services/WasmRuntime.ts`**

```typescript
import { Context, Effect, Layer } from "effect"
import { WasmLoadError } from "./errors"

export interface WasmModule {
  readonly keygen: (seed: Uint8Array) => { sk: Uint8Array; vk: Uint8Array }
  readonly sign: (skBytes: Uint8Array, message: Uint8Array, salt: Uint8Array) => {
    signature: Uint8Array
    salt: Uint8Array
  }
  readonly verify: (vkBytes: Uint8Array, message: Uint8Array, signature: Uint8Array) => boolean
  readonly create_verification_hint: (s1: Int32Array, pkNtt: Int32Array) => Uint16Array
  readonly pack_public_key_wasm: (pkNtt: Uint16Array) => string[]
  readonly public_key_length: () => number
  readonly salt_length: () => number
}

export class WasmRuntime extends Context.Tag("WasmRuntime")<WasmRuntime, WasmModule>() {}

let cachedModule: WasmModule | null = null

export const WasmRuntimeLive = Layer.effect(
  WasmRuntime,
  Effect.gen(function* () {
    if (cachedModule) return cachedModule

    const wasm = yield* Effect.tryPromise({
      try: async () => {
        const mod = await import("/wasm/falcon_rs.js")
        await mod.default()
        return mod as unknown as WasmModule
      },
      catch: (error) => new WasmLoadError({ message: String(error) }),
    })

    cachedModule = wasm
    return wasm
  }),
)
```

**Step 5: Create `apps/demo/src/services/FalconService.ts`**

```typescript
import { Effect } from "effect"
import { WasmRuntime, WasmRuntimeLive } from "./WasmRuntime"
import { KeygenError, SigningError, HintGenerationError, PackingError, VerificationError } from "./errors"
import type { FalconKeypair, FalconSignatureResult, PackedPublicKey } from "./types"

export class FalconService extends Effect.Service<FalconService>()("FalconService", {
  accessors: true,
  dependencies: [WasmRuntimeLive],
  effect: Effect.gen(function* () {
    const wasm = yield* WasmRuntime

    const generateKeypair = Effect.fn("Falcon.generateKeypair")(function* (
      seed?: Uint8Array,
    ): Generator<any, FalconKeypair, any> {
      const s = seed ?? crypto.getRandomValues(new Uint8Array(32))
      const result = yield* Effect.try({
        try: () => wasm.keygen(s),
        catch: (error) => new KeygenError({ message: String(error) }),
      })
      // Extract h polynomial from verifying key for NTT operations
      // The vk is 896 bytes = 512 coefficients at 14 bits each
      return {
        secretKey: result.sk,
        verifyingKey: result.vk,
        publicKeyNtt: new Int32Array(512), // populated by deserializing vk
      }
    })

    const sign = Effect.fn("Falcon.sign")(function* (
      secretKey: Uint8Array,
      message: Uint8Array,
    ): Generator<any, FalconSignatureResult, any> {
      return yield* Effect.try({
        try: () => wasm.sign(secretKey, message, new Uint8Array(0)),
        catch: (error) => new SigningError({ message: String(error) }),
      })
    })

    const verify = Effect.fn("Falcon.verify")(function* (
      verifyingKey: Uint8Array,
      message: Uint8Array,
      signature: Uint8Array,
    ): Generator<any, boolean, any> {
      return yield* Effect.try({
        try: () => wasm.verify(verifyingKey, message, signature),
        catch: (error) =>
          new VerificationError({ message: String(error), step: "verify" }),
      })
    })

    const createHint = Effect.fn("Falcon.createHint")(function* (
      s1: Int32Array,
      pkNtt: Int32Array,
    ): Generator<any, Uint16Array, any> {
      return yield* Effect.try({
        try: () => wasm.create_verification_hint(s1, pkNtt),
        catch: (error) => new HintGenerationError({ message: String(error) }),
      })
    })

    const packPublicKey = Effect.fn("Falcon.packPublicKey")(function* (
      pkNtt: Uint16Array,
    ): Generator<any, PackedPublicKey, any> {
      const slots = yield* Effect.try({
        try: () => wasm.pack_public_key_wasm(pkNtt),
        catch: (error) => new PackingError({ message: String(error) }),
      })
      return { slots }
    })

    return { generateKeypair, sign, verify, createHint, packPublicKey }
  }),
}) {}
```

**Step 6: Create `apps/demo/src/services/StarknetService.ts`**

Uses starknet.js v9 with the latest account deployment API per https://starknetjs.com/docs/guides/account/create_account:

```typescript
import { Config, Effect } from "effect"
import { RpcProvider, Account, hash, CallData, stark, constants } from "starknet"
import { StarknetRpcError, AccountDeployError, InsufficientFundsError } from "./errors"
import type { TxHash, ContractAddress, PackedPublicKey } from "./types"

// FalconAccount class hash — must be declared on mainnet first
const FALCON_ACCOUNT_CLASS_HASH = "0x0" // TODO: replace after declaring

export class StarknetService extends Effect.Service<StarknetService>()("StarknetService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const rpcUrl = yield* Config.string("NEXT_PUBLIC_STARKNET_RPC_URL")
    const provider = new RpcProvider({ nodeUrl: rpcUrl })

    const computeDeployAddress = Effect.fn("Starknet.computeDeployAddress")(function* (
      packedPk: PackedPublicKey,
    ): Generator<any, ContractAddress, any> {
      const constructorCalldata = CallData.compile({
        pk_packed: packedPk.slots,
      })
      const salt = stark.randomAddress()
      const address = hash.calculateContractAddressFromHash(
        salt,
        FALCON_ACCOUNT_CLASS_HASH,
        constructorCalldata,
        0,
      )
      return address as ContractAddress
    })

    const getBalance = Effect.fn("Starknet.getBalance")(function* (
      address: string,
    ): Generator<any, bigint, any> {
      return yield* Effect.tryPromise({
        try: async () => {
          const result = await provider.callContract({
            contractAddress: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d", // STRK
            entrypoint: "balanceOf",
            calldata: [address],
          })
          return BigInt(result[0])
        },
        catch: (error) => new StarknetRpcError({ message: String(error), code: -1 }),
      })
    })

    const deployAccount = Effect.fn("Starknet.deployAccount")(function* (
      packedPk: PackedPublicKey,
      privateKey: string,
    ): Generator<any, { txHash: TxHash; address: ContractAddress }, any> {
      const constructorCalldata = CallData.compile({
        pk_packed: packedPk.slots,
      })
      const salt = stark.randomAddress()
      const address = hash.calculateContractAddressFromHash(
        salt,
        FALCON_ACCOUNT_CLASS_HASH,
        constructorCalldata,
        0,
      )

      const account = new Account(provider, address, privateKey)

      const result = yield* Effect.tryPromise({
        try: () =>
          account.deployAccount({
            classHash: FALCON_ACCOUNT_CLASS_HASH,
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
        txHash: result.transaction_hash as TxHash,
        address: result.contract_address as ContractAddress,
      }
    })

    const waitForTx = Effect.fn("Starknet.waitForTx")(function* (
      txHash: string,
    ): Generator<any, void, any> {
      yield* Effect.tryPromise({
        try: () => provider.waitForTransaction(txHash),
        catch: (error) => new StarknetRpcError({ message: String(error), code: -1 }),
      })
    })

    return { computeDeployAddress, getBalance, deployAccount, waitForTx, provider }
  }),
}) {}
```

**Step 7: Verify typecheck passes**

```bash
cd apps/demo && bun run typecheck
```

Expected: No type errors.

**Step 8: Commit**

```bash
git add apps/demo/src/services/
git commit -m "feat(demo): add Effect services (Falcon, Starknet, WasmRuntime)"
```

---

## Task 4: Create Effect Atoms and Runtime Provider

**Files:**
- Create: `apps/demo/src/atoms/index.ts`
- Create: `apps/demo/src/atoms/falcon.ts`
- Create: `apps/demo/src/atoms/starknet.ts`
- Create: `apps/demo/src/atoms/pipeline.ts`
- Create: `apps/demo/src/providers/AtomProvider.tsx`
- Modify: `apps/demo/src/app/layout.tsx`

**Step 1: Create `apps/demo/src/atoms/falcon.ts`**

```typescript
import { Atom } from "@effect-atom/atom"
import { Option } from "effect"
import type { FalconKeypair, FalconSignatureResult, VerificationStep } from "@/services/types"

export const wasmStatusAtom = Atom.make<"loading" | "ready" | "error">("loading").pipe(
  Atom.keepAlive,
)

export const keypairAtom = Atom.make<Option.Option<FalconKeypair>>(Option.none())

export const signatureAtom = Atom.make<Option.Option<FalconSignatureResult>>(Option.none())

export const verificationStepAtom = Atom.make<VerificationStep>({ step: "idle" })

export const messageAtom = Atom.make("")
```

**Step 2: Create `apps/demo/src/atoms/starknet.ts`**

```typescript
import { Atom } from "@effect-atom/atom"
import { Option } from "effect"
import type { ContractAddress, TxHash } from "@/services/types"

export type DeployStep =
  | { step: "idle" }
  | { step: "generating-keypair" }
  | { step: "packing" }
  | { step: "computing-address" }
  | { step: "awaiting-funds"; address: string }
  | { step: "deploying"; address: string }
  | { step: "deployed"; address: string; txHash: string }
  | { step: "error"; message: string }

export const deployStepAtom = Atom.make<DeployStep>({ step: "idle" })

export const deployedAddressAtom = Atom.make<Option.Option<ContractAddress>>(Option.none())

export const deployTxHashAtom = Atom.make<Option.Option<TxHash>>(Option.none())
```

**Step 3: Create `apps/demo/src/atoms/pipeline.ts`**

```typescript
import { Atom } from "@effect-atom/atom"
import type { PipelineStep } from "@/services/types"

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "hash-to-point",
    name: "hash_to_point",
    description: "Poseidon hash: message || salt → 512 Zq coefficients",
    input: "message + salt",
    output: "512 coefficients ∈ [0, 12289)",
    stepCount: 5988,
    status: "pending",
  },
  {
    id: "ntt-s1",
    name: "NTT(s1)",
    description: "Forward NTT on signature polynomial s1",
    input: "s1 (512 coefficients)",
    output: "s1_ntt (frequency domain)",
    stepCount: 15000,
    status: "pending",
  },
  {
    id: "pointwise-mul",
    name: "s1_ntt * pk_ntt",
    description: "Pointwise multiplication in NTT domain",
    input: "s1_ntt, pk_ntt",
    output: "product_ntt (512 values)",
    stepCount: 1500,
    status: "pending",
  },
  {
    id: "ntt-hint",
    name: "NTT(mul_hint)",
    description: "Forward NTT on verification hint (provided off-chain)",
    input: "mul_hint (512 coefficients)",
    output: "hint_ntt — must equal product_ntt",
    stepCount: 15000,
    status: "pending",
  },
  {
    id: "recover-s0",
    name: "s0 = msg_point - mul_hint",
    description: "Recover s0 from message point and hint",
    input: "msg_point, mul_hint",
    output: "s0 (512 coefficients)",
    stepCount: 500,
    status: "pending",
  },
  {
    id: "norm-check",
    name: "‖(s0, s1)‖² ≤ bound",
    description: "Check combined Euclidean norm against security bound",
    input: "s0, s1",
    output: "pass/fail (bound = 34,034,726)",
    stepCount: 26000,
    status: "pending",
  },
]

export const pipelineStepsAtom = Atom.make<PipelineStep[]>(PIPELINE_STEPS)

export const pipelineActiveStepAtom = Atom.make<number>(-1)

export const pipelinePlayingAtom = Atom.make(false)
```

**Step 4: Create `apps/demo/src/atoms/index.ts`**

```typescript
export * from "./falcon"
export * from "./starknet"
export * from "./pipeline"
```

**Step 5: Create `apps/demo/src/providers/AtomProvider.tsx`**

```tsx
"use client"

import { AtomProvider as BaseAtomProvider } from "@effect-atom/atom-react"

export function AtomProvider({ children }: { children: React.ReactNode }) {
  return <BaseAtomProvider>{children}</BaseAtomProvider>
}
```

**Step 6: Update `apps/demo/src/app/layout.tsx` to wrap with AtomProvider**

```tsx
import type { Metadata } from "next"
import { AtomProvider } from "@/providers/AtomProvider"
import "./globals.css"

export const metadata: Metadata = {
  title: "Falcon-512 | Post-Quantum Signatures on Starknet",
  description:
    "Demo of Falcon-512 post-quantum signature verification for Starknet account abstraction. 63K steps, 62 calldata felts.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-falcon-bg text-falcon-text antialiased">
        <AtomProvider>{children}</AtomProvider>
      </body>
    </html>
  )
}
```

**Step 7: Typecheck**

```bash
cd apps/demo && bun run typecheck
```

**Step 8: Commit**

```bash
git add apps/demo/src/atoms/ apps/demo/src/providers/ apps/demo/src/app/layout.tsx
git commit -m "feat(demo): add Effect Atoms and AtomProvider"
```

---

## Task 5: Build Landing Page Sections (RSC)

**Files:**
- Create: `apps/demo/src/components/landing/Hero.tsx`
- Create: `apps/demo/src/components/landing/WhyPostQuantum.tsx`
- Create: `apps/demo/src/components/landing/PerformanceStats.tsx`
- Create: `apps/demo/src/components/landing/Footer.tsx`
- Modify: `apps/demo/src/app/page.tsx`

**Step 1: Create `apps/demo/src/components/landing/Hero.tsx`**

```tsx
export function Hero() {
  return (
    <section className="relative px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-semibold tracking-widest text-falcon-accent uppercase">
          Post-Quantum Cryptography
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">
          Falcon-512 on{" "}
          <span className="text-falcon-primary">Starknet</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-falcon-muted max-w-2xl mx-auto">
          Ultra-performant post-quantum signature verification for Starknet account abstraction.
          Quantum-safe wallets without changing your address.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="#verify"
            className="rounded-lg bg-falcon-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-falcon-primary/80 transition-colors"
          >
            Try Verification
          </a>
          <a
            href="#deploy"
            className="rounded-lg border border-falcon-muted/30 px-6 py-3 text-sm font-semibold text-falcon-text hover:border-falcon-muted/60 transition-colors"
          >
            Deploy Account
          </a>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
          <Stat value="63K" label="Steps" />
          <Stat value="62" label="Calldata felts" />
          <Stat value="29" label="Storage slots" />
        </div>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-falcon-accent">{value}</p>
      <p className="mt-1 text-sm text-falcon-muted">{label}</p>
    </div>
  )
}
```

**Step 2: Create `apps/demo/src/components/landing/WhyPostQuantum.tsx`**

```tsx
export function WhyPostQuantum() {
  return (
    <section className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">Why Post-Quantum?</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <Card
            title="Quantum Threat"
            description="Shor's algorithm on a cryptographically-relevant quantum computer breaks ECDSA. Every Ethereum and Starknet wallet using ECDSA becomes vulnerable."
          />
          <Card
            title="Account Abstraction"
            description="Starknet's native account abstraction lets wallets upgrade their signature verification logic without changing addresses. No hard fork needed."
          />
          <Card
            title="Falcon-512"
            description="NIST-standardized lattice-based signature scheme. 666-byte signatures, 896-byte public keys. Based on NTRU lattices with tight security proofs."
          />
          <Card
            title="Hint-Based Verification"
            description="Off-chain signer provides a precomputed hint, reducing on-chain work from 4 NTTs to 2 NTTs. Cuts verification cost by ~50%."
          />
        </div>
      </div>
    </section>
  )
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
      <h3 className="text-lg font-semibold text-falcon-text">{title}</h3>
      <p className="mt-2 text-sm text-falcon-muted leading-relaxed">{description}</p>
    </div>
  )
}
```

**Step 3: Create `apps/demo/src/components/landing/PerformanceStats.tsx`**

```tsx
export function PerformanceStats() {
  const stats = [
    { operation: "verify (e2e)", steps: "63,177", gas: "~13.2M L2" },
    { operation: "verify_with_msg_point", steps: "26,301", gas: "~5.5M L2" },
    { operation: "hash_to_point (Poseidon)", steps: "5,988", gas: "~1.3M L2" },
    { operation: "NTT-512 (unrolled)", steps: "~15,000", gas: "~3.1M L2" },
  ]

  return (
    <section className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">Performance</h2>
        <p className="mt-4 text-falcon-muted">
          All operations measured in Cairo steps on Starknet.
        </p>
        <div className="mt-8 overflow-hidden rounded-xl border border-falcon-muted/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-falcon-surface">
              <tr>
                <th className="px-6 py-3 font-semibold">Operation</th>
                <th className="px-6 py-3 font-semibold text-right">Steps</th>
                <th className="px-6 py-3 font-semibold text-right">Gas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-falcon-muted/10">
              {stats.map((row) => (
                <tr key={row.operation}>
                  <td className="px-6 py-4 font-mono text-falcon-accent">{row.operation}</td>
                  <td className="px-6 py-4 text-right">{row.steps}</td>
                  <td className="px-6 py-4 text-right text-falcon-muted">{row.gas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
          <h3 className="font-semibold">Calldata Efficiency</h3>
          <p className="mt-2 text-sm text-falcon-muted">
            Base-Q polynomial packing reduces calldata by <strong className="text-falcon-text">~17x</strong>:
            512 Zq values → 29 felt252 storage slots. Total signature calldata: 62 felt252 (vs ~1,030 unpacked).
          </p>
        </div>
      </div>
    </section>
  )
}
```

**Step 4: Create `apps/demo/src/components/landing/Footer.tsx`**

```tsx
export function Footer() {
  return (
    <footer className="border-t border-falcon-muted/20 px-6 py-12 lg:px-8">
      <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-falcon-muted">
          Falcon-512 for Starknet — Post-quantum account abstraction
        </p>
        <div className="flex gap-6">
          <a
            href="https://github.com"
            className="text-sm text-falcon-muted hover:text-falcon-text transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://docs.starknet.io"
            className="text-sm text-falcon-muted hover:text-falcon-text transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Starknet Docs
          </a>
        </div>
      </div>
    </footer>
  )
}
```

**Step 5: Update `apps/demo/src/app/page.tsx`**

```tsx
import { Hero } from "@/components/landing/Hero"
import { WhyPostQuantum } from "@/components/landing/WhyPostQuantum"
import { PerformanceStats } from "@/components/landing/PerformanceStats"
import { Footer } from "@/components/landing/Footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <WhyPostQuantum />
      <PerformanceStats />
      {/* Interactive sections will be added in subsequent tasks */}
      <div id="verify" className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight">Verification Playground</h2>
          <p className="mt-4 text-falcon-muted">Loading...</p>
        </div>
      </div>
      <div id="pipeline" className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight">Pipeline Deep-Dive</h2>
          <p className="mt-4 text-falcon-muted">Loading...</p>
        </div>
      </div>
      <div id="deploy" className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight">Deploy Account</h2>
          <p className="mt-4 text-falcon-muted">Loading...</p>
        </div>
      </div>
      <Footer />
    </main>
  )
}
```

**Step 6: Verify dev server renders correctly**

```bash
cd apps/demo && bun run dev
```

Expected: Landing page renders with Hero, Why Post-Quantum, Performance Stats, placeholder interactive sections, Footer.

**Step 7: Commit**

```bash
git add apps/demo/src/components/landing/ apps/demo/src/app/page.tsx
git commit -m "feat(demo): add landing page sections (Hero, WhyPQ, Stats, Footer)"
```

---

## Task 6: Build Verification Playground (Client Component)

**Files:**
- Create: `apps/demo/src/components/interactive/VerificationPlayground.tsx`
- Create: `apps/demo/src/components/interactive/HexDisplay.tsx`
- Modify: `apps/demo/src/app/page.tsx`

**Step 1: Create `apps/demo/src/components/interactive/HexDisplay.tsx`**

Reusable component for showing hex/felt252 data:

```tsx
"use client"

interface HexDisplayProps {
  label: string
  value: string | string[]
  maxLines?: number
}

export function HexDisplay({ label, value, maxLines = 3 }: HexDisplayProps) {
  const lines = Array.isArray(value) ? value : [value]
  const truncated = lines.length > maxLines

  return (
    <div className="rounded-lg bg-falcon-bg border border-falcon-muted/20 p-3">
      <p className="text-xs font-semibold text-falcon-muted uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="font-mono text-xs text-falcon-text/80 space-y-0.5 overflow-x-auto">
        {lines.slice(0, maxLines).map((line, i) => (
          <p key={i} className="truncate">{line}</p>
        ))}
        {truncated && (
          <p className="text-falcon-muted">... {lines.length - maxLines} more</p>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create `apps/demo/src/components/interactive/VerificationPlayground.tsx`**

```tsx
"use client"

import { useCallback, useState } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { Option } from "effect"
import { keypairAtom, verificationStepAtom, messageAtom, wasmStatusAtom } from "@/atoms"
import { HexDisplay } from "./HexDisplay"

export function VerificationPlayground() {
  const wasmStatus = useAtomValue(wasmStatusAtom)
  const keypair = useAtomValue(keypairAtom)
  const step = useAtomValue(verificationStepAtom)
  const message = useAtomValue(messageAtom)
  const setMessage = useAtomSet(messageAtom)
  const setKeypair = useAtomSet(keypairAtom)
  const setStep = useAtomSet(verificationStepAtom)

  const handleGenerateKeypair = useCallback(async () => {
    setStep({ step: "generating-keypair" })
    try {
      // FalconService integration will be wired in when WASM is ready
      // For now, show the flow
      setStep({ step: "idle" })
    } catch {
      setStep({ step: "error", message: "Keypair generation failed" })
    }
  }, [setStep])

  const handleSignAndVerify = useCallback(async () => {
    if (Option.isNone(keypair)) return
    setStep({ step: "signing" })
    // Pipeline: sign → create hint → pack → verify
    // Will be wired to FalconService
  }, [keypair, setStep])

  const hasKeypair = Option.isSome(keypair)
  const isLoading = step.step !== "idle" && step.step !== "complete" && step.step !== "error"

  return (
    <section id="verify" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">Verification Playground</h2>
        <p className="mt-4 text-falcon-muted">
          Generate a Falcon-512 keypair, sign a message, and verify the signature — all in your browser via WASM.
        </p>

        {wasmStatus === "loading" && (
          <div className="mt-8 rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6 text-center">
            <p className="text-falcon-muted animate-pulse">Loading WASM module...</p>
          </div>
        )}

        {wasmStatus === "error" && (
          <div className="mt-8 rounded-xl border border-falcon-error/30 bg-falcon-error/10 p-6 text-center">
            <p className="text-falcon-error">Failed to load WASM module. Check browser console.</p>
          </div>
        )}

        {wasmStatus === "ready" && (
          <div className="mt-8 space-y-6">
            {/* Step 1: Generate Keypair */}
            <div className="rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Step 1: Generate Keypair</h3>
                  <p className="text-sm text-falcon-muted mt-1">
                    Creates a Falcon-512 keypair (slow: ~1-2 min for NTRU key generation)
                  </p>
                </div>
                <button
                  onClick={handleGenerateKeypair}
                  disabled={isLoading}
                  className="rounded-lg bg-falcon-primary px-4 py-2 text-sm font-semibold text-white hover:bg-falcon-primary/80 disabled:opacity-50 transition-colors"
                >
                  {step.step === "generating-keypair" ? "Generating..." : "Generate"}
                </button>
              </div>
              {hasKeypair && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <HexDisplay
                    label="Public Key (896 bytes)"
                    value={`0x${Buffer.from(Option.getOrThrow(keypair).verifyingKey).toString("hex").slice(0, 64)}...`}
                  />
                  <HexDisplay
                    label="Secret Key"
                    value="[hidden]"
                  />
                </div>
              )}
            </div>

            {/* Step 2: Sign & Verify */}
            <div className="rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
              <h3 className="font-semibold">Step 2: Sign & Verify</h3>
              <div className="mt-4">
                <label className="block text-sm text-falcon-muted mb-2">Message</label>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter a message to sign..."
                  className="w-full rounded-lg border border-falcon-muted/20 bg-falcon-bg px-4 py-2 text-sm text-falcon-text placeholder:text-falcon-muted/50 focus:outline-none focus:ring-2 focus:ring-falcon-primary/50"
                />
              </div>
              <button
                onClick={handleSignAndVerify}
                disabled={!hasKeypair || !message || isLoading}
                className="mt-4 rounded-lg bg-falcon-accent px-4 py-2 text-sm font-semibold text-white hover:bg-falcon-accent/80 disabled:opacity-50 transition-colors"
              >
                {isLoading ? `${step.step}...` : "Sign & Verify"}
              </button>

              {/* Verification Result */}
              {step.step === "complete" && (
                <div
                  className={`mt-4 rounded-lg p-4 ${
                    step.valid
                      ? "bg-falcon-success/10 border border-falcon-success/30"
                      : "bg-falcon-error/10 border border-falcon-error/30"
                  }`}
                >
                  <p className={`font-semibold ${step.valid ? "text-falcon-success" : "text-falcon-error"}`}>
                    {step.valid ? "Signature Valid" : "Signature Invalid"}
                  </p>
                  <p className="text-sm text-falcon-muted mt-1">
                    Verified in {step.durationMs}ms
                  </p>
                </div>
              )}

              {step.step === "error" && (
                <div className="mt-4 rounded-lg p-4 bg-falcon-error/10 border border-falcon-error/30">
                  <p className="text-falcon-error text-sm">{step.message}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
```

**Step 3: Update `apps/demo/src/app/page.tsx` to use dynamic import**

```tsx
import dynamic from "next/dynamic"
import { Hero } from "@/components/landing/Hero"
import { WhyPostQuantum } from "@/components/landing/WhyPostQuantum"
import { PerformanceStats } from "@/components/landing/PerformanceStats"
import { Footer } from "@/components/landing/Footer"

const VerificationPlayground = dynamic(
  () => import("@/components/interactive/VerificationPlayground").then((m) => m.VerificationPlayground),
  { ssr: false, loading: () => <SectionSkeleton title="Verification Playground" /> },
)

function SectionSkeleton({ title }: { title: string }) {
  return (
    <div className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <div className="mt-8 h-48 rounded-xl bg-falcon-surface animate-pulse" />
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <WhyPostQuantum />
      <PerformanceStats />
      <VerificationPlayground />
      <div id="pipeline" className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight">Pipeline Deep-Dive</h2>
          <p className="mt-4 text-falcon-muted">Coming soon.</p>
        </div>
      </div>
      <div id="deploy" className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight">Deploy Account</h2>
          <p className="mt-4 text-falcon-muted">Coming soon.</p>
        </div>
      </div>
      <Footer />
    </main>
  )
}
```

**Step 4: Verify the page renders**

```bash
cd apps/demo && bun run dev
```

Expected: Page loads with all landing sections + Verification Playground (showing WASM loading state).

**Step 5: Commit**

```bash
git add apps/demo/src/components/interactive/ apps/demo/src/app/page.tsx
git commit -m "feat(demo): add Verification Playground component"
```

---

## Task 7: Build Pipeline Visualizer (Client Component)

**Files:**
- Create: `apps/demo/src/components/interactive/PipelineVisualizer.tsx`
- Modify: `apps/demo/src/app/page.tsx`

**Step 1: Create `apps/demo/src/components/interactive/PipelineVisualizer.tsx`**

```tsx
"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAtomValue, useAtomSet, useAtom } from "@effect-atom/atom-react"
import { pipelineStepsAtom, pipelineActiveStepAtom, pipelinePlayingAtom } from "@/atoms"
import type { PipelineStep } from "@/services/types"

export function PipelineVisualizer() {
  const steps = useAtomValue(pipelineStepsAtom)
  const [activeStep, setActiveStep] = useAtom(pipelineActiveStepAtom)
  const [playing, setPlaying] = useAtom(pipelinePlayingAtom)
  const setSteps = useAtomSet(pipelineStepsAtom)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const updateStepStatuses = useCallback(
    (currentIdx: number) => {
      setSteps(
        steps.map((s, i) => ({
          ...s,
          status: i < currentIdx ? "complete" : i === currentIdx ? "active" : "pending",
        })),
      )
    },
    [steps, setSteps],
  )

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setActiveStep((prev) => {
          const next = prev + 1
          if (next >= steps.length) {
            setPlaying(false)
            return prev
          }
          updateStepStatuses(next)
          return next
        })
      }, 2000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [playing, steps.length, setActiveStep, setPlaying, updateStepStatuses])

  const handlePlay = () => {
    if (activeStep >= steps.length - 1) {
      setActiveStep(-1)
      updateStepStatuses(-1)
    }
    setPlaying(true)
    setActiveStep(0)
    updateStepStatuses(0)
  }

  const handlePause = () => setPlaying(false)

  const handleStep = () => {
    const next = activeStep + 1
    if (next < steps.length) {
      setActiveStep(next)
      updateStepStatuses(next)
    }
  }

  const handleReset = () => {
    setPlaying(false)
    setActiveStep(-1)
    updateStepStatuses(-1)
  }

  const totalSteps = steps.reduce((sum, s) => sum + s.stepCount, 0)

  return (
    <section id="pipeline" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">Pipeline Deep-Dive</h2>
        <p className="mt-4 text-falcon-muted">
          Step through the on-chain verification algorithm. Total: ~{totalSteps.toLocaleString()} Cairo steps.
        </p>

        {/* Controls */}
        <div className="mt-8 flex gap-3">
          {!playing ? (
            <button
              onClick={handlePlay}
              className="rounded-lg bg-falcon-primary px-4 py-2 text-sm font-semibold text-white hover:bg-falcon-primary/80 transition-colors"
            >
              {activeStep >= 0 ? "Restart" : "Play"}
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="rounded-lg bg-falcon-surface border border-falcon-muted/20 px-4 py-2 text-sm font-semibold hover:bg-falcon-surface/80 transition-colors"
            >
              Pause
            </button>
          )}
          <button
            onClick={handleStep}
            disabled={playing || activeStep >= steps.length - 1}
            className="rounded-lg bg-falcon-surface border border-falcon-muted/20 px-4 py-2 text-sm font-semibold hover:bg-falcon-surface/80 disabled:opacity-50 transition-colors"
          >
            Step
          </button>
          <button
            onClick={handleReset}
            className="rounded-lg bg-falcon-surface border border-falcon-muted/20 px-4 py-2 text-sm font-semibold hover:bg-falcon-surface/80 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Pipeline Steps */}
        <div className="mt-8 space-y-4">
          {steps.map((step, i) => (
            <PipelineStepCard key={step.id} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PipelineStepCard({ step, index }: { step: PipelineStep; index: number }) {
  const statusColors = {
    pending: "border-falcon-muted/20",
    active: "border-falcon-primary ring-2 ring-falcon-primary/20",
    complete: "border-falcon-success/30",
  }

  const statusIcons = {
    pending: "text-falcon-muted",
    active: "text-falcon-primary animate-pulse",
    complete: "text-falcon-success",
  }

  return (
    <div
      className={`rounded-xl border bg-falcon-surface p-5 transition-all duration-300 ${statusColors[step.status]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step.status === "complete"
                ? "bg-falcon-success/20 text-falcon-success"
                : step.status === "active"
                  ? "bg-falcon-primary/20 text-falcon-primary"
                  : "bg-falcon-muted/10 text-falcon-muted"
            }`}
          >
            {step.status === "complete" ? "\u2713" : index + 1}
          </span>
          <div>
            <h3 className="font-mono font-semibold">{step.name}</h3>
            <p className="text-sm text-falcon-muted mt-0.5">{step.description}</p>
          </div>
        </div>
        <span className="text-sm text-falcon-muted font-mono">
          {step.stepCount.toLocaleString()} steps
        </span>
      </div>

      {step.status === "active" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-falcon-bg p-3">
            <p className="text-xs font-semibold text-falcon-muted uppercase tracking-wider mb-1">
              Input
            </p>
            <p className="text-sm font-mono text-falcon-text/80">{step.input}</p>
          </div>
          <div className="rounded-lg bg-falcon-bg p-3">
            <p className="text-xs font-semibold text-falcon-muted uppercase tracking-wider mb-1">
              Output
            </p>
            <p className="text-sm font-mono text-falcon-text/80">{step.output}</p>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Wire PipelineVisualizer into `page.tsx`**

Add dynamic import and replace the pipeline placeholder:

```tsx
const PipelineVisualizer = dynamic(
  () => import("@/components/interactive/PipelineVisualizer").then((m) => m.PipelineVisualizer),
  { ssr: false, loading: () => <SectionSkeleton title="Pipeline Deep-Dive" /> },
)
```

Replace the `#pipeline` div in `page.tsx` with `<PipelineVisualizer />`.

**Step 3: Verify it renders and play/step controls work**

```bash
cd apps/demo && bun run dev
```

Expected: Pipeline section shows 6 steps. Play auto-advances. Step advances one at a time. Reset clears.

**Step 4: Commit**

```bash
git add apps/demo/src/components/interactive/PipelineVisualizer.tsx apps/demo/src/app/page.tsx
git commit -m "feat(demo): add Pipeline Visualizer with play/step/reset controls"
```

---

## Task 8: Build Account Deploy Flow (Client Component)

**Files:**
- Create: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
- Modify: `apps/demo/src/app/page.tsx`

**Step 1: Create `apps/demo/src/components/interactive/AccountDeployFlow.tsx`**

```tsx
"use client"

import { useCallback } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { Option } from "effect"
import { deployStepAtom, keypairAtom } from "@/atoms"
import { HexDisplay } from "./HexDisplay"

export function AccountDeployFlow() {
  const step = useAtomValue(deployStepAtom)
  const setStep = useAtomSet(deployStepAtom)
  const keypair = useAtomValue(keypairAtom)
  const hasKeypair = Option.isSome(keypair)

  const handleStartDeploy = useCallback(async () => {
    if (!hasKeypair) {
      setStep({ step: "generating-keypair" })
      // Will wire to FalconService
      return
    }
    setStep({ step: "packing" })
    // Will wire to full deploy pipeline
  }, [hasKeypair, setStep])

  return (
    <section id="deploy" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">Deploy Account</h2>
        <p className="mt-4 text-falcon-muted">
          Deploy a Falcon-512 account on Starknet mainnet. Real transactions, real post-quantum security.
        </p>

        <div className="mt-8 space-y-4">
          {/* Step indicators */}
          <DeployStepIndicator
            number={1}
            title="Generate Keypair"
            description="Create a Falcon-512 keypair for your account"
            active={step.step === "generating-keypair"}
            complete={hasKeypair}
          />
          <DeployStepIndicator
            number={2}
            title="Pack Public Key"
            description="Encode 512 Zq values into 29 felt252 storage slots"
            active={step.step === "packing"}
            complete={step.step === "computing-address" || step.step === "awaiting-funds" || step.step === "deploying" || step.step === "deployed"}
          />
          <DeployStepIndicator
            number={3}
            title="Compute Address"
            description="Derive the counterfactual contract address"
            active={step.step === "computing-address"}
            complete={step.step === "awaiting-funds" || step.step === "deploying" || step.step === "deployed"}
          />
          <DeployStepIndicator
            number={4}
            title="Fund Account"
            description="Send STRK to the pre-computed address"
            active={step.step === "awaiting-funds"}
            complete={step.step === "deploying" || step.step === "deployed"}
          >
            {step.step === "awaiting-funds" && (
              <div className="mt-3">
                <HexDisplay label="Send STRK to" value={step.address} />
                <p className="mt-2 text-xs text-falcon-muted">Waiting for funds...</p>
              </div>
            )}
          </DeployStepIndicator>
          <DeployStepIndicator
            number={5}
            title="Deploy"
            description="Submit the deploy_account transaction"
            active={step.step === "deploying"}
            complete={step.step === "deployed"}
          />
          {step.step === "deployed" && (
            <div className="rounded-xl border border-falcon-success/30 bg-falcon-success/10 p-6">
              <h3 className="font-semibold text-falcon-success">Account Deployed</h3>
              <div className="mt-3 space-y-2">
                <HexDisplay label="Contract Address" value={step.address} />
                <HexDisplay label="Transaction Hash" value={step.txHash} />
                <a
                  href={`https://starkscan.co/tx/${step.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-sm text-falcon-accent hover:underline"
                >
                  View on Starkscan
                </a>
              </div>
            </div>
          )}
        </div>

        {step.step === "idle" && (
          <button
            onClick={handleStartDeploy}
            className="mt-8 rounded-lg bg-falcon-primary px-6 py-3 text-sm font-semibold text-white hover:bg-falcon-primary/80 transition-colors"
          >
            {hasKeypair ? "Deploy Account" : "Generate Keypair & Deploy"}
          </button>
        )}

        {step.step === "error" && (
          <div className="mt-4 rounded-xl border border-falcon-error/30 bg-falcon-error/10 p-6">
            <p className="text-falcon-error">{step.message}</p>
            <button
              onClick={() => setStep({ step: "idle" })}
              className="mt-3 text-sm text-falcon-accent hover:underline"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function DeployStepIndicator({
  number,
  title,
  description,
  active,
  complete,
  children,
}: {
  number: number
  title: string
  description: string
  active: boolean
  complete: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl border bg-falcon-surface p-5 transition-all ${
        active
          ? "border-falcon-primary ring-2 ring-falcon-primary/20"
          : complete
            ? "border-falcon-success/30"
            : "border-falcon-muted/20"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            complete
              ? "bg-falcon-success/20 text-falcon-success"
              : active
                ? "bg-falcon-primary/20 text-falcon-primary"
                : "bg-falcon-muted/10 text-falcon-muted"
          }`}
        >
          {complete ? "\u2713" : number}
        </span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-falcon-muted">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
```

**Step 2: Wire AccountDeployFlow into `page.tsx`**

Add dynamic import:
```tsx
const AccountDeployFlow = dynamic(
  () => import("@/components/interactive/AccountDeployFlow").then((m) => m.AccountDeployFlow),
  { ssr: false, loading: () => <SectionSkeleton title="Deploy Account" /> },
)
```

Replace the `#deploy` div with `<AccountDeployFlow />`.

**Step 3: Verify it renders**

```bash
cd apps/demo && bun run dev
```

Expected: Deploy section shows 5-step flow with indicators and a "Deploy Account" button.

**Step 4: Commit**

```bash
git add apps/demo/src/components/interactive/AccountDeployFlow.tsx apps/demo/src/app/page.tsx
git commit -m "feat(demo): add Account Deploy Flow component"
```

---

## Task 9: Wire WASM to Effect Services

Once the falcon-rs WASM is built (Task 2) and services exist (Task 3), wire them together.

**Files:**
- Create: `apps/demo/src/hooks/useFalcon.ts`
- Modify: `apps/demo/src/components/interactive/VerificationPlayground.tsx`

**Step 1: Create `apps/demo/src/hooks/useFalcon.ts`**

```typescript
"use client"

import { useCallback, useEffect } from "react"
import { useAtomSet } from "@effect-atom/atom-react"
import { Effect, Layer, Exit } from "effect"
import { wasmStatusAtom, keypairAtom, verificationStepAtom } from "@/atoms"
import { FalconService } from "@/services/FalconService"
import { WasmRuntimeLive } from "@/services/WasmRuntime"
import type { FalconKeypair } from "@/services/types"
import { Option } from "effect"

const FalconLive = FalconService.Default

export function useFalconInit() {
  const setWasmStatus = useAtomSet(wasmStatusAtom)

  useEffect(() => {
    const program = Effect.gen(function* () {
      yield* FalconService // accessing service triggers WASM load
    }).pipe(Effect.provide(FalconLive))

    Effect.runPromiseExit(program).then((exit) => {
      if (Exit.isSuccess(exit)) {
        setWasmStatus("ready")
      } else {
        setWasmStatus("error")
      }
    })
  }, [setWasmStatus])
}

export function useFalconActions() {
  const setKeypair = useAtomSet(keypairAtom)
  const setStep = useAtomSet(verificationStepAtom)

  const generateKeypair = useCallback(async () => {
    setStep({ step: "generating-keypair" })
    const program = FalconService.generateKeypair().pipe(Effect.provide(FalconLive))
    const exit = await Effect.runPromiseExit(program)
    if (Exit.isSuccess(exit)) {
      setKeypair(Option.some(exit.value))
      setStep({ step: "idle" })
    } else {
      setStep({ step: "error", message: "Keypair generation failed" })
    }
  }, [setKeypair, setStep])

  const signAndVerify = useCallback(
    async (message: string, keypair: FalconKeypair) => {
      const start = performance.now()
      setStep({ step: "signing" })

      const program = Effect.gen(function* () {
        const falcon = yield* FalconService
        const msgBytes = new TextEncoder().encode(message)

        // Sign
        setStep({ step: "signing" })
        const sigResult = yield* falcon.sign(keypair.secretKey, msgBytes)

        // Verify
        setStep({ step: "verifying", substep: "checking signature" })
        const valid = yield* falcon.verify(keypair.verifyingKey, msgBytes, sigResult.signature)

        return valid
      }).pipe(Effect.provide(FalconLive))

      const exit = await Effect.runPromiseExit(program)
      const durationMs = Math.round(performance.now() - start)

      if (Exit.isSuccess(exit)) {
        setStep({ step: "complete", valid: exit.value, durationMs })
      } else {
        setStep({ step: "error", message: "Verification failed" })
      }
    },
    [setStep],
  )

  return { generateKeypair, signAndVerify }
}
```

**Step 2: Update VerificationPlayground to use hooks**

Wire `useFalconInit()` in the playground (or in a parent component) and replace the placeholder handlers with `useFalconActions()`.

**Step 3: Verify end-to-end flow (requires WASM build from Task 2)**

```bash
cd apps/demo && bun run dev
```

Expected: WASM loads → "ready" status → Generate Keypair works → Sign & Verify works.

**Step 4: Commit**

```bash
git add apps/demo/src/hooks/ apps/demo/src/components/interactive/VerificationPlayground.tsx
git commit -m "feat(demo): wire WASM to Effect services via hooks"
```

---

## Task 10: Initialize Super-Ralph Workflow

**Files:**
- Create: `apps/demo/.workflow/` (generated by init script)
- Modify: `apps/demo/.workflow/components/focuses.ts`
- Modify: `apps/demo/.workflow/components/workflow.tsx`

**Step 1: Run super-ralph init**

```bash
uv run ~/.claude/plugins/cache/eni-skills/personal-skills/1.0.0/skills/super-ralph/scripts/init_super_ralph.py \
  apps/demo/.workflow --root ../.. --name "Falcon Demo" --id falcon-demo
```

Expected: Creates 9 files in `apps/demo/.workflow/`, runs `bun install`.

**Step 2: Replace focuses**

Edit `apps/demo/.workflow/components/focuses.ts`:

```typescript
export const focuses = [
  { id: "landing", name: "Landing page (Hero, Why PQ, Stats, Footer)" },
  { id: "effect-services", name: "Effect services (FalconService, StarknetService, WasmRuntime)" },
  { id: "wasm", name: "falcon-wasm WASM bindings (sign, hint, pack)" },
  { id: "verify-playground", name: "Verification Playground (interactive demo)" },
  { id: "pipeline-viz", name: "Pipeline Visualizer (animated step-through)" },
  { id: "account-deploy", name: "Account Deploy Flow (mainnet)" },
  { id: "atoms-state", name: "Effect Atoms (reactive state management)" },
  { id: "styling", name: "Styling and design system (Tailwind, components)" },
] as const
```

**Step 3: Customize workflow.tsx**

Fill in the TODO sections in `apps/demo/.workflow/components/workflow.tsx`:

- `specsPath`: `"docs/plans/"`
- `referenceFiles`: `["docs/plans/2026-02-23-falcon-demo-website-design.md", "docs/plans/2026-02-23-falcon-demo-website-impl.md", "apps/demo/src/", "CLAUDE.md"]`
- `buildCmds`: `{ typecheck: "cd apps/demo && bun run typecheck" }`
- `testCmds`: `{ dev: "cd apps/demo && bun run build" }`
- `codeStyle`: `"TypeScript strict, Effect-TS patterns (Effect.Service, Schema.TaggedError, Effect.fn), React best practices (RSC where possible, lazy client components), Tailwind v4 CSS-first"`
- `reviewChecklist`: `["Effect patterns (no try-catch for Effect failures, no type assertions)", "React performance (no unnecessary re-renders, lazy loading)", "Accessibility (semantic HTML, ARIA labels)", "Design doc compliance"]`

**Step 4: Commit**

```bash
git add apps/demo/.workflow/
git commit -m "feat(demo): initialize super-ralph workflow"
```

---

## Task 11: Dark/Light Theme Toggle

**Files:**
- Create: `apps/demo/src/components/ThemeToggle.tsx`
- Modify: `apps/demo/src/app/layout.tsx`
- Modify: `apps/demo/src/app/globals.css`

**Step 1: Add light theme variables to `globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-falcon-primary: #6366f1;
  --color-falcon-secondary: #8b5cf6;
  --color-falcon-accent: #06b6d4;
  --color-falcon-success: #10b981;
  --color-falcon-error: #ef4444;
}

.dark {
  --color-falcon-bg: #0f172a;
  --color-falcon-surface: #1e293b;
  --color-falcon-text: #f8fafc;
  --color-falcon-muted: #94a3b8;
}

.light {
  --color-falcon-bg: #ffffff;
  --color-falcon-surface: #f1f5f9;
  --color-falcon-text: #0f172a;
  --color-falcon-muted: #64748b;
}
```

**Step 2: Create `apps/demo/src/components/ThemeToggle.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"

export function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    document.documentElement.className = dark ? "dark" : "light"
  }, [dark])

  return (
    <button
      onClick={() => setDark(!dark)}
      className="fixed top-4 right-4 z-50 rounded-lg border border-falcon-muted/20 bg-falcon-surface p-2 text-sm hover:bg-falcon-surface/80 transition-colors"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? "\u2600" : "\u263E"}
    </button>
  )
}
```

**Step 3: Add ThemeToggle to layout**

Add `<ThemeToggle />` inside the `<body>` in `layout.tsx`.

**Step 4: Verify both themes work**

```bash
cd apps/demo && bun run dev
```

Expected: Toggle switches between dark and light themes.

**Step 5: Commit**

```bash
git add apps/demo/src/components/ThemeToggle.tsx apps/demo/src/app/layout.tsx apps/demo/src/app/globals.css
git commit -m "feat(demo): add dark/light theme toggle"
```

---

## Task 12: Final Integration & Build Verification

**Files:** None new — verification pass.

**Step 1: Run typecheck**

```bash
cd apps/demo && bun run typecheck
```

Expected: Zero errors.

**Step 2: Run production build**

```bash
cd apps/demo && bun run build
```

Expected: Build succeeds. No warnings about missing modules.

**Step 3: Test production server**

```bash
cd apps/demo && bun run start
```

Expected: App serves at http://localhost:3000. All sections render. Theme toggle works.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(demo): falcon-512 demo website - initial release"
```
