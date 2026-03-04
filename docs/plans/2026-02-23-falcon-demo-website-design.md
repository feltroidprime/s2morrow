# Falcon Demo Website Design

**Date:** 2026-02-23
**Status:** Approved

## Overview

A demo website for Falcon-512 post-quantum signature verification on Starknet. Single-page Next.js 15 App Router application with three interactive sections, Effect-TS service layer, and browser-side WASM crypto.

**Audience:** Starknet developers, crypto/security community, investors/partners.
**Style:** Clean technical (light/dark toggle, generous whitespace, diagrams).

## Architecture

Three-layer monolith Next.js app at `apps/demo/`:

```
┌─────────────────────────────────────────────┐
│  Next.js App Router (RSC + Client)          │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Landing  │ │ Verify   │ │ Pipeline    │ │
│  │ (RSC)    │ │ Playground│ │ Visualizer  │ │
│  │          │ │ (Client) │ │ (Client)    │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
│  ┌─────────────────────────────────────────┐│
│  │ Account Deploy Flow (Client)            ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  Effect Services Layer                      │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Falcon   │ │ Starknet │ │ Telemetry   │ │
│  │ Service  │ │ Service  │ │ Service     │ │
│  │ (WASM)   │ │ (RPC)    │ │ (spans)     │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
├─────────────────────────────────────────────┤
│  Runtime Layer                              │
│  ┌──────────┐ ┌──────────────────────────┐  │
│  │ falcon-rs│ │ starknet.js              │  │
│  │ WASM     │ │ (provider + account)     │  │
│  └──────────┘ └──────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Runtime | Bun |
| State | Effect Atoms (`@effect-atom/atom-react`) |
| Services | Effect-TS (`Effect.Service`, `Schema.TaggedError`) |
| Styling | Tailwind CSS v4 |
| Crypto | falcon-rs compiled to WASM via `wasm-pack` |
| Starknet | `starknet.js` (RPC provider, account) |
| Network | Starknet Mainnet |
| Deploy | Vercel |

## Effect Services

### FalconService

Wraps the falcon-rs WASM module. Depends on `WasmRuntime` service (lazy WASM loader).

```typescript
class FalconService extends Effect.Service<FalconService>()("FalconService", {
  accessors: true,
  dependencies: [WasmRuntime.Default],
  effect: Effect.gen(function* () {
    const wasm = yield* WasmRuntime
    return {
      generateKeypair: Effect.fn("Falcon.generateKeypair")(function* () { ... }),
      sign: Effect.fn("Falcon.sign")(function* (message: Uint8Array, secretKey: SecretKey) { ... }),
      createVerificationHint: Effect.fn("Falcon.createHint")(function* (s1, pkNtt) { ... }),
      packPublicKey: Effect.fn("Falcon.packPublicKey")(function* (pk: PublicKey) { ... }),
    }
  })
}) {}
```

### StarknetService

Wraps starknet.js for mainnet interaction.

```typescript
class StarknetService extends Effect.Service<StarknetService>()("StarknetService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const rpcUrl = yield* Config.string("NEXT_PUBLIC_STARKNET_RPC_URL")
    return {
      deployAccount: Effect.fn("Starknet.deployAccount")(function* (pk: PackedPublicKey) { ... }),
      sendTransaction: Effect.fn("Starknet.sendTransaction")(function* (tx: Transaction) { ... }),
      waitForTx: Effect.fn("Starknet.waitForTx")(function* (hash: TxHash) { ... }),
    }
  })
}) {}
```

### Errors

All errors use `Schema.TaggedError` with specific types per failure mode:

- `WasmLoadError` — WASM module failed to load
- `KeygenError` — Keypair generation failed
- `SigningError` — Message signing failed
- `VerificationFailedError` — Verification returned false (with step info)
- `StarknetRpcError` — RPC call failed (with code)
- `AccountDeployError` — Account deployment failed (with txHash if available)
- `InsufficientFundsError` — Account not funded for deployment

### Atoms

```typescript
const wasmStatusAtom = Atom.make<"loading" | "ready" | "error">("loading")
const keypairAtom = Atom.make<Option<FalconKeypair>>(Option.none())
const verificationAtom = Atom.make<VerificationState>({ step: "idle" })
const starknetAtom = Atom.make<Option<StarknetConnection>>(Option.none())
const pipelineStepsAtom = Atom.make<Array<PipelineStep>>([])
```

## Page Structure

Single-page scrolling layout. Interactive sections lazy-loaded via `next/dynamic`.

```
/ (landing)
  ├── Hero (RSC) — headline, tagline, key performance stats
  ├── Why Post-Quantum (RSC) — explainer with diagrams
  ├── Performance Stats (RSC) — step counts, gas costs, comparison table
  ├── Live Verification (Client) — interactive playground
  ├── Pipeline Deep-Dive (Client) — animated step-through visualizer
  ├── Deploy Account (Client) — mainnet deployment walkthrough
  └── Footer (RSC) — links, GitHub, docs
```

### Hero Section (RSC)

- "Post-Quantum Signatures on Starknet" headline
- Key numbers: 63K steps, 62 calldata felts, 29 storage slots
- CTA buttons: "Try Verification" → scroll, "Deploy Account" → scroll

### Verification Playground (Client)

- Text input for message
- "Generate Keypair" → `FalconService.generateKeypair`
- "Sign & Verify" → full pipeline:
  1. Sign message → `(s1, salt)`
  2. Create hint → `mul_hint`
  3. Pack inputs → 62 felt252 calldata
  4. Display packed representation
- Result: green checkmark / red X with details

### Pipeline Visualizer (Client)

Animated step-through of the verification algorithm:

1. `hash_to_point(msg || salt)` → 512 Zq coefficients
2. `NTT(s1)` → frequency domain
3. Pointwise multiply `NTT(s1) * pk_ntt`
4. `NTT(mul_hint)` → verify matches product
5. `s0 = msg_point - mul_hint` → recover s0
6. Norm check: `||s0||² + ||s1||² ≤ bound`

Each step shows: input → operation → output (truncated), step count.
Play/pause/step controls.

### Account Deploy Flow (Client)

- Step 1: Generate or reuse keypair
- Step 2: Pack public key → 29 felt252 display
- Step 3: Compute counterfactual deploy address
- Step 4: Fund account (show address, wait for balance)
- Step 5: Deploy → real mainnet transaction
- Step 6: Sign a test transaction with the new account
- Transaction links to Starkscan/Voyager

## WASM Strategy

### falcon-wasm Crate

New crate at `falcon-wasm/` wrapping falcon-rs with `wasm-bindgen`:

```rust
#[wasm_bindgen]
pub fn generate_keypair() -> JsValue { ... }
#[wasm_bindgen]
pub fn sign(message: &[u8], secret_key: &[u8]) -> JsValue { ... }
#[wasm_bindgen]
pub fn create_verification_hint(s1: &[u8], pk_ntt: &[u8]) -> JsValue { ... }
#[wasm_bindgen]
pub fn pack_public_key(pk: &[u8]) -> JsValue { ... }
```

### Build

```bash
wasm-pack build falcon-wasm --target web --out-dir ../apps/demo/public/wasm
```

### Loading

WASM loaded from `public/wasm/` via `fetch` + `WebAssembly.instantiate` inside the `WasmRuntime` Effect service. `wasmStatusAtom` tracks loading state. Components show skeleton while loading.

## Super-Ralph Workflow

Workflow directory: `apps/demo/.workflow/`

### Focuses

```typescript
export const focuses = [
  { id: "landing", name: "Landing page (Hero, Why PQ, Stats)" },
  { id: "effect-services", name: "Effect services (FalconService, StarknetService, WasmRuntime)" },
  { id: "wasm", name: "falcon-wasm Rust crate (wasm-bindgen, wasm-pack)" },
  { id: "verify-playground", name: "Verification Playground (interactive demo)" },
  { id: "pipeline-viz", name: "Pipeline Visualizer (animated step-through)" },
  { id: "account-deploy", name: "Account Deploy Flow (mainnet)" },
  { id: "atoms-state", name: "Effect Atoms (reactive state management)" },
  { id: "styling", name: "Styling and design system (Tailwind, components)" },
] as const
```

### Dependency Graph

```
wasm ──────────┐
               ├──→ effect-services ──→ verify-playground
styling ───────┤                   ──→ pipeline-viz
               │                   ──→ account-deploy
landing ───────┘ (independent)
atoms-state ──→ (all client components)
```

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 15 App Router | RSC for landing, Effect integration via @prb/effect-next |
| Crypto runtime | Browser WASM | No backend needed, falcon-rs already exists |
| Network | Starknet Mainnet | Maximum credibility for demo |
| State | Effect Atoms | Integrates with Effect services, reactive |
| Styling | Tailwind CSS | Clean technical aesthetic, dark/light toggle |
| Build tool | super-ralph | Parallel ticket-driven development |
