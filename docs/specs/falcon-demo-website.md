# Falcon-512 Demo Website PRD

## Summary

Starknet developers, the crypto/security community, and potential partners have no way to interact with or evaluate Falcon-512 post-quantum signature verification without reading Cairo source code and running local tests. We're building a single-page demo website that lets users generate keypairs, sign messages, visualize the verification pipeline, and deploy a Falcon account on Starknet mainnet — all from their browser. This gives the project a public face that demonstrates production-readiness and builds credibility for the first post-quantum account abstraction on Starknet.

## Problem Statement

**Current State:** The s2morrow project contains a highly optimized Falcon-512 Cairo library (63K steps for full verification) with account abstraction support, but the only way to interact with it is through `scarb test` and Rust test vector generation. There is no consumer-facing interface.

**User Pain:** A Starknet developer evaluating post-quantum options must clone the repo, install Cairo tooling, understand the test structure, and manually read profiling output to assess the library. This takes hours and requires domain expertise. Investors and security researchers get even less — a README with numbers they can't independently verify.

**Impact:** Without a demo, adoption is bottlenecked by the high barrier to entry. Competing post-quantum efforts (even less optimized ones) will win mindshare if they ship a public demo first.

## Goals and Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Developers can evaluate the library | Time from landing to first successful verification | < 30 seconds |
| Technical credibility | All interactive demos produce real cryptographic output (not simulated) | 100% real WASM crypto |
| Starknet integration proof | Users can deploy a Falcon account on mainnet | Working deploy flow |
| Educational value | Users understand the verification pipeline | 6-step animated walkthrough with step counts |
| Performance transparency | All step counts and gas costs visible | Match README numbers |

## Target Audience

**Starknet Developers:** Building wallets, account abstraction, or evaluating signature schemes. They want to see the API surface, step counts, and try verification. They understand NTTs and modular arithmetic at a high level.

**Crypto/Security Community:** Researchers and engineers interested in post-quantum on-chain. They want to understand why Falcon-512 matters, how hint-based verification works, and see it running. They understand lattice cryptography.

**Investors/Partners:** Non-technical stakeholders evaluating the project. They need a polished visual demonstration of post-quantum readiness. They understand "quantum computers will break current wallets" but not NTT internals.

## Proposed Solution

A single-page Next.js website at `apps/demo/` with six sections:

1. **Hero** — Headline, key stats (63K steps, 62 calldata felts, 29 storage slots), CTA buttons
2. **Why Post-Quantum** — Four cards explaining the quantum threat, account abstraction solution, Falcon-512, and hint-based verification
3. **Performance Stats** — Table of operation step counts and gas costs, calldata efficiency comparison
4. **Verification Playground** — Generate a Falcon-512 keypair in-browser (WASM), sign a message, verify the signature, see packed calldata representation
5. **Pipeline Visualizer** — Animated step-through of the 6 verification stages (hash_to_point → NTT → multiply → NTT hint → recover s0 → norm check) with input/output for each stage
6. **Account Deploy Flow** — 5-step guided deployment of a FalconAccount on Starknet mainnet (generate keypair → pack PK → compute address → fund → deploy)

All cryptographic operations run client-side via falcon-rs compiled to WASM. Starknet interactions use starknet.js v9 against mainnet RPC. State management uses Effect Atoms. Services use Effect-TS patterns (Effect.Service, Schema.TaggedError, Effect.fn).

## Requirements

### Must Have (P0)

#### Focus: wasm

- [ ] Extend falcon-rs `wasm.rs` to implement `sign()` (currently a stub) — requires adding `SecretKey::from_bytes()` to reconstruct b0_fft and LDL tree from serialized (f, g, F, G)
- [ ] Add `Signature::salt()` accessor to falcon.rs so WASM can return the salt used during signing
- [ ] Add `create_verification_hint()` WASM binding that wraps `hints::generate_mul_hint` — accepts Int32Array s1 and pk_ntt, returns Uint16Array mul_hint
- [ ] Add `pack_public_key_wasm()` WASM binding that wraps `packing::pack_public_key` — accepts Uint16Array pk_ntt, returns array of hex strings (felt252)
- [ ] WASM build produces `falcon_rs.js` + `falcon_rs_bg.wasm` via `wasm-pack build --target web --features wasm`
- [ ] All existing falcon-rs tests still pass after changes

#### Focus: effect-services

- [ ] `WasmRuntime` service loads falcon-rs WASM lazily from `/wasm/` via fetch+instantiate, caches the module, fails with `WasmLoadError`
- [ ] `FalconService` wraps WASM with Effect.fn methods: `generateKeypair`, `sign`, `verify`, `createHint`, `packPublicKey` — each returns typed results and fails with specific `Schema.TaggedError` errors (`KeygenError`, `SigningError`, `VerificationError`, `HintGenerationError`, `PackingError`)
- [ ] `StarknetService` wraps starknet.js v9 with: `computeDeployAddress`, `getBalance`, `deployAccount`, `waitForTx` — uses `RpcProvider` configured from `NEXT_PUBLIC_STARKNET_RPC_URL` env var, fails with `StarknetRpcError`, `AccountDeployError`, `InsufficientFundsError`
- [ ] All errors are `Schema.TaggedError` with `message` field and context-specific fields (e.g., `step` for VerificationError, `code` for StarknetRpcError, `txHash` for AccountDeployError)

#### Focus: atoms-state

- [ ] `wasmStatusAtom` tracks WASM loading: `"loading" | "ready" | "error"`, kept alive
- [ ] `keypairAtom` holds `Option<FalconKeypair>` (secretKey, verifyingKey, publicKeyNtt)
- [ ] `verificationStepAtom` tracks verification flow: idle → generating-keypair → signing → creating-hint → packing → verifying → complete/error
- [ ] `deployStepAtom` tracks deploy flow: idle → generating-keypair → packing → computing-address → awaiting-funds → deploying → deployed/error
- [ ] `pipelineStepsAtom` holds 6 pipeline steps with status (pending/active/complete), step counts matching README
- [ ] `AtomProvider` wraps the app in layout.tsx

#### Focus: landing

- [ ] Hero section: "Post-Quantum Signatures on Starknet" headline, three stats (63K steps, 62 calldata felts, 29 storage slots), two CTA buttons (Try Verification, Deploy Account) that smooth-scroll to respective sections
- [ ] Why Post-Quantum section: 4 cards (Quantum Threat, Account Abstraction, Falcon-512, Hint-Based Verification) with concise explanations
- [ ] Performance Stats section: table with 4 rows (verify, verify_with_msg_point, hash_to_point, NTT-512) showing steps and L2 gas, plus calldata efficiency card (17x reduction)
- [ ] Footer with GitHub and Starknet Docs links
- [ ] All landing sections are React Server Components (zero client JS)

#### Focus: verify-playground

- [ ] Text input for message
- [ ] "Generate Keypair" button calls FalconService.generateKeypair via WASM, displays truncated public key hex, shows "generating..." state
- [ ] "Sign & Verify" button runs full pipeline: sign → verify, shows green checkmark with duration on success, red X with error message on failure
- [ ] Disabled states: can't sign without keypair, can't sign without message, buttons disabled during operations
- [ ] Component lazy-loaded via `next/dynamic` with `ssr: false` and skeleton loading state

#### Focus: pipeline-viz

- [ ] 6 pipeline steps displayed as cards: hash_to_point (5,988 steps), NTT(s1) (~15,000), pointwise multiply (~1,500), NTT(mul_hint) (~15,000), recover s0 (~500), norm check (~26,000)
- [ ] Play button auto-advances through steps at 2-second intervals
- [ ] Pause button stops auto-advance
- [ ] Step button advances one step at a time
- [ ] Reset button returns all steps to pending
- [ ] Active step shows expanded input/output details
- [ ] Completed steps show green checkmark, active step shows blue highlight with ring
- [ ] Total step count displayed in section header
- [ ] Component lazy-loaded via `next/dynamic` with `ssr: false`

#### Focus: account-deploy

- [ ] 5-step visual indicator: Generate Keypair → Pack Public Key → Compute Address → Fund Account → Deploy
- [ ] Step 4 (Fund Account) displays the pre-computed address for the user to send STRK to
- [ ] Step 5 (Deploy) calls StarknetService.deployAccount, shows tx hash on success
- [ ] Success state links to Starkscan (`https://starkscan.co/tx/{txHash}`)
- [ ] Error state shows message and "Try Again" button that resets to idle
- [ ] Uses keypair from keypairAtom if available (shared with Verification Playground)
- [ ] Component lazy-loaded via `next/dynamic` with `ssr: false`

#### Focus: styling

- [ ] Dark theme by default with custom color tokens: falcon-primary (#6366f1), falcon-accent (#06b6d4), falcon-success (#10b981), falcon-error (#ef4444), falcon-bg (#0f172a), falcon-surface (#1e293b), falcon-text (#f8fafc), falcon-muted (#94a3b8)
- [ ] Light theme: falcon-bg (#ffffff), falcon-surface (#f1f5f9), falcon-text (#0f172a), falcon-muted (#64748b)
- [ ] Theme toggle button (fixed top-right) switches between dark/light by toggling CSS class on `<html>`
- [ ] Tailwind CSS v4 with CSS-first config (no tailwind.config.js)
- [ ] Consistent card component: rounded-xl border, bg-falcon-surface, p-5/p-6
- [ ] Monospace font for code/hex values, sans-serif for prose
- [ ] Responsive: single column on mobile, 2-column grids on sm+ for cards

### Should Have (P1)

#### Focus: verify-playground

- [ ] After signing, display the packed calldata representation (29 felt252 hex strings for s1, 29 for mul_hint, salt felts)
- [ ] Show intermediate values: s1 polynomial preview (first 5 coefficients + "..."), salt hex
- [ ] Keypair generation progress indicator (estimated ~1-2 min warning)

#### Focus: pipeline-viz

- [ ] When WASM is loaded and a keypair exists, run actual NTT/hint computations and display real intermediate values instead of placeholder text
- [ ] Show cumulative step count as progress bar alongside individual step counts

#### Focus: account-deploy

- [ ] Auto-poll balance every 5 seconds during "awaiting-funds" step, auto-advance to deploy when funded
- [ ] After successful deploy, offer "Sign Test Transaction" to demonstrate the account works

#### Focus: styling

- [ ] Smooth scroll behavior for CTA anchor links
- [ ] Fade-in animations for sections as they enter viewport (IntersectionObserver)
- [ ] Skeleton loading states match the shape of real content

### Could Have (P2)

#### Focus: verify-playground

- [ ] Side-by-side comparison: show "Unpacked" (1,030 felts) vs "Packed" (62 felts) calldata to visualize the 17x improvement
- [ ] Export verification proof as JSON for use in tests

#### Focus: pipeline-viz

- [ ] SVG flow diagram connecting the 6 steps with animated data flow arrows
- [ ] Toggle between "simple" view (current cards) and "detailed" view (with coefficient previews)

#### Focus: landing

- [ ] Animated hero background (subtle lattice/grid pattern)
- [ ] Comparison table: Falcon-512 vs ECDSA vs Dilithium (key size, sig size, verification cost)

### Won't Have

- Server-side rendering for interactive sections (all crypto runs client-side only)
- Wallet integration (Argent X / Braavos) — deploy flow uses raw private key, not browser wallet
- Poseidon hash-to-point in WASM — current WASM uses SHAKE256; Poseidon verification is Cairo-only
- Mobile-optimized crypto (WASM keygen is too slow on mobile devices)
- Internationalization
- User accounts or persistent state

## Assumptions and Constraints

**Assumptions:**
- falcon-rs compiles to WASM without issues (the `wasm` feature flag and wasm-bindgen are already set up)
- `SecretKey::from_bytes()` can reconstruct b0_fft and LDL tree deterministically from (f, g, F, G)
- WASM keygen takes ~1-2 minutes in browser (NTRU key generation is computationally expensive)
- The FalconAccount class hash will need to be declared on Starknet mainnet before the deploy flow works (placeholder `0x0` until then)
- starknet.js v9 `deployAccount` API matches https://starknetjs.com/docs/guides/account/create_account#create-your-account-abstraction

**Constraints:**
- Bun as package manager (not npm/yarn)
- Next.js 15+ App Router (not Pages Router)
- Effect-TS patterns mandatory: Effect.Service, Schema.TaggedError, Effect.fn, Atoms — no raw promises, no try-catch in effects, no console.log
- Tailwind CSS v4 with CSS-first config
- All crypto in browser WASM, no backend API
- Starknet mainnet (not testnet)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WASM keygen too slow (>5 min) | Medium | High — users abandon | Show progress estimate, offer pre-generated test keypair as fallback |
| FalconAccount class not declared on mainnet | High (not done yet) | High — deploy flow doesn't work | Show simulation mode with "deploy coming soon" until class is declared |
| Next.js Turbopack + WASM incompatibility | Medium | Medium — dev server broken | Fall back to webpack config or load WASM from public/ via fetch |
| starknet.js API changes | Low | Medium — deploy breaks | Pin starknet@9.2.1, test against specific API |
| Effect Atom API instability | Low | Low — state management breaks | Pin @effect-atom versions, minimal atom API surface |

## Architecture Reference

See `docs/plans/2026-02-23-falcon-demo-website-design.md` for the full architecture diagram, technology stack decisions, and service definitions.

See `docs/plans/2026-02-23-falcon-demo-website-impl.md` for the 12-task implementation plan with exact file paths and code.

## Focus Area Summary

| Focus | Scope | Key Deliverables |
|-------|-------|-----------------|
| `wasm` | falcon-rs WASM bindings | sign(), create_verification_hint(), pack_public_key_wasm(), SecretKey::from_bytes() |
| `effect-services` | Effect service layer | WasmRuntime, FalconService, StarknetService, typed errors |
| `atoms-state` | Reactive state | wasmStatusAtom, keypairAtom, verificationStepAtom, deployStepAtom, pipelineStepsAtom |
| `landing` | Static RSC sections | Hero, WhyPostQuantum, PerformanceStats, Footer |
| `verify-playground` | Interactive verification | Keypair generation, sign & verify, result display |
| `pipeline-viz` | Animated visualizer | 6-step walkthrough with play/pause/step/reset |
| `account-deploy` | Mainnet deployment | 5-step guided flow with Starkscan links |
| `styling` | Design system | Dark/light themes, color tokens, responsive layout, theme toggle |
