# Falcon Demo Website — Manual Testing Findings

**Date:** 2026-02-24
**Branch:** `frontend`
**Test method:** Code analysis + curl testing + build verification (Chrome extension unavailable for visual testing)
**Dev server:** `http://localhost:3001` (Next.js 15 + Turbopack)

---

## Executive Summary

The demo website is **functionally complete** with all 7 sections rendering, all 471 tests passing, typecheck clean, and production build succeeding. The main issues are: (1) ThemeToggle component exists but is not wired into the layout, (2) the Verification Playground's Sign & Verify flow skips hint creation and packing display, (3) the Account Deploy flow has a hardcoded `FALCON_ACCOUNT_CLASS_HASH = "0x0"` placeholder, and (4) several UX polish items.

---

## Build Status

| Check | Result |
|-------|--------|
| `bun run typecheck` | PASS (clean) |
| `bun test` | PASS (471 tests, 0 failures, 8 todo) |
| `bun run build` | PASS (static generation, 104 kB first load JS) |
| Dev server (`bun run dev`) | PASS (renders on port 3001) |
| WASM files present | PASS (`falcon_rs.js` 16.6K, `falcon_rs_bg.wasm` 254.7K) |
| WASM exports 7 functions | PASS (keygen, sign, verify, create_verification_hint, pack_public_key_wasm, public_key_length, salt_length) |

---

## Section-by-Section Analysis

### 1. Hero Section (`id="hero"`)

**Status:** Working
**Renders:** Server-side (RSC)

**What works:**
- Headline "Post-Quantum Signatures on Starknet" renders correctly
- Subheading "Falcon-512 Demo" tagline visible
- Three stat cards (63K steps, 62 calldata felts, 29 storage slots) display
- Two CTA buttons: "Try Verification" (`#verify`) and "Deploy Account" (`#deploy`)
- Responsive layout: stacks vertically on mobile, row on `sm:`

**Issues:**
- [UX-01] Hero heading uses `text-4xl sm:text-6xl` but the PRD design doc suggests `text-5xl sm:text-7xl` for more visual impact
- [UX-02] No navigation bar / header — the page scrolls directly from the top. Consider a sticky nav or at minimum a logo/brand mark

---

### 2. Why Post-Quantum Section (`id="why-post-quantum"`)

**Status:** Working
**Renders:** Server-side (RSC)

**What works:**
- Four educational cards in a 2-column grid (`sm:grid-cols-2`)
- Cards: "Quantum Threat", "Account Abstraction", "Falcon-512", "Hint-Based Verification"
- Correct content covering Shor's algorithm, AA, NIST standards, and hint optimization

**Issues:**
- [UX-03] Section heading "Why Post-Quantum?" is missing `text-falcon-text` class (inherits from body, works in dark mode but could break if body class changes)
- [UX-04] No visual icons or illustrations on the cards — they're text-only. The PRD mentions diagrams/visuals for educational content

---

### 3. Performance Stats Section (`id="performance-stats"`)

**Status:** Working
**Renders:** Server-side (RSC)

**What works:**
- Performance table with 4 rows: `verify`, `verify_with_msg_point`, `hash_to_point`, `NTT-512`
- Step counts and L2 gas estimates display correctly
- "Calldata Efficiency" callout card showing 17x reduction
- Table is horizontally scrollable (`overflow-x-auto`) on mobile
- Monospace font for operation names

**Issues:**
- [UX-05] No cost estimate in USD/STRK — the table shows raw step counts and gas but doesn't help non-technical users understand the actual cost
- [UX-06] The `~15,000` and `~13.2M L2` estimates use inconsistent precision — consider normalizing

---

### 4. Verification Playground Section (`id="verify"`)

**Status:** Partially working (incomplete pipeline)
**Renders:** Client-side (dynamic import, `ssr: false`)

**What works:**
- Loading skeleton renders during dynamic import (pulsing `h-48` placeholder)
- Message text input with label, placeholder, and disabled state
- "Generate Keypair" button with loading state ("Generating...")
- "Sign & Verify" button with correct disabled logic (requires keypair + non-empty message)
- Hex display component for verifying key preview (truncated head/tail)
- Success state: green border + checkmark + "Signature valid" + timing
- Error state: red border + message + "Try Again" button
- ARIA labels on all buttons, `role="status"` and `role="alert"` on result displays
- Button disabled derivation is centralized in `verification-utils.ts` and unit-tested

**Issues:**
- [BUG-01] **Sign & Verify only does sign + verify, not the full pipeline.** The PRD specifies the flow should be: sign -> create hint -> pack calldata -> verify. The current `handleSignAndVerify` in `VerificationPlayground.tsx:89-137` skips hint creation and packing — it goes directly from sign to verify. The packed calldata (62 felt252) is never displayed.
- [UX-07] Missing packed calldata hex display. The PRD wants to show the 29 packed felt252 slots and the 62 calldata felts. The HexDisplay component supports array display with `maxRows`, but it's never used for this purpose.
- [UX-08] No signature hex display. After signing, the signature bytes are stored in `signatureAtom` but never rendered to the user.
- [UX-09] The message input is `type="text"` (single line). For signing arbitrary messages, a `<textarea>` might be more appropriate.
- [UX-10] No "copy to clipboard" button on the hex displays

---

### 5. Pipeline Visualizer Section (`id="pipeline"`)

**Status:** Working
**Renders:** Client-side (dynamic import, `ssr: false`)

**What works:**
- Loading skeleton: 6 pulsing card placeholders in a 3-column grid
- Header with "Verification Pipeline" title and "~63,988 total steps" counter
- 6 pipeline step cards in `sm:grid-cols-2 lg:grid-cols-3` layout
- Step cards show: status indicator, step name (monospace), step count, description
- Play/Pause toggle: Play shows when paused, Pause shows when playing
- Step button: advances one step at a time, disabled during play or when all complete
- Reset button: returns all steps to pending, resets active step to -1
- Auto-advance: 2-second interval when playing
- Status indicators: pulsing dot (active), checkmark (complete), dimmed dot (pending)
- Active step expansion: shows Input/Output details below description
- Correct ARIA labels on all control buttons
- All state in atoms (no `useState`)

**Issues:**
- [UX-11] No progress bar showing overall completion (e.g., "3/6 steps complete")
- [UX-12] When stepping through all 6 steps to completion, the last Step click marks step 5 as complete but `activeStep` stays at 5 (because `next >= steps.length`). This is correct behavior but the UX could be confusing — the user clicks Step and nothing visually changes on the last step except the status dot becoming a checkmark.
- [UX-13] The pipeline is purely visual/animated — it doesn't connect to the actual WASM operations. The PRD suggests the pipeline could optionally run actual WASM operations and show real timing data.

---

### 6. Account Deploy Flow Section (`id="deploy"`)

**Status:** Partially working (Starknet dependencies)
**Renders:** Client-side (dynamic import, `ssr: false`)

**What works:**
- Loading skeleton during dynamic import
- 5-step wizard UI with numbered indicators (1-5)
- Step indicators: badge color changes (muted -> primary -> success) with ring highlight for active
- "Deployer Private Key" input with placeholder "0x..."
- "Prepare Deploy" button (visible when idle)
- "Deploy Account" button (visible when awaiting funds)
- Deployed success state: green card with address, tx hash, and Starkscan link
- Error state: red card with message and "Try Again" button
- Private key validation: hex format, 0x-prefix, 64-character body
- ARIA live region for screen reader status updates
- Step completion flags derived from `deployStep` state machine

**Issues:**
- [BUG-02] **`FALCON_ACCOUNT_CLASS_HASH = "0x0"` is a placeholder.** In `StarknetService.ts:11`, the class hash is hardcoded to `"0x0"`. Any actual deploy attempt will fail because `0x0` is not a valid declared class hash. The PRD mentions this needs to be replaced after the Cairo contract is declared on mainnet.
- [BUG-03] **No balance polling loop.** The "Fund Account" step (step 4) shows the address to send STRK to, but there's no automatic polling to detect when funds arrive. The user must manually click "Deploy Account" and hope funds are there. The PRD specifies a polling loop.
- [BUG-04] **computing-address state immediately overwritten.** `handlePrepare` calls `setDeployStep({ step: "computing-address" })` then immediately `setDeployStep({ step: "awaiting-funds", address: prepared.address })` on lines 80-81 of `AccountDeployFlow.tsx`. The "computing-address" state is never visible to the user.
- [UX-14] The private key input is a plain `<input type="text">` with no masking. For sensitive data, `type="password"` or a reveal toggle would be more appropriate.
- [UX-15] The PRD specifies a 6th step "Sign test transaction with new account" that is missing from the current implementation. The wizard only has 5 steps.
- [UX-16] No option to generate a keypair directly from the deploy flow without first using the Playground. If the user goes straight to Deploy without generating a keypair in the Playground first, the flow generates one automatically, but this isn't clearly communicated.

---

### 7. Footer

**Status:** Working
**Renders:** Server-side (RSC)

**What works:**
- Horizontal layout with description left, links right (`sm:flex-row`)
- "Built for the Falcon-512 Starknet demo" tagline
- GitHub link to `feltroidprime/s2morrow` (opens new tab, `rel="noopener noreferrer"`)
- Starknet Docs link to `docs.starknet.io`
- ARIA label on footer nav

**Issues:**
- [UX-17] No additional links (e.g., Falcon NIST spec, Starknet AA docs)

---

### 8. Theme Toggle

**Status:** NOT WIRED — component exists but unused

**What exists:**
- `ThemeToggle.tsx` component with dark/light toggle button (sun/moon emoji)
- `THEME_TOKENS` and `BRAND_TOKENS` exported and unit-tested
- `globals.css` has both `.dark` and `.light` class-based theming with correct color tokens

**Issues:**
- [BUG-05] **ThemeToggle is never imported or rendered.** It's not in `page.tsx`, `layout.tsx`, or any other component. The toggle button should be in `layout.tsx` to be visible on the page. The dark theme is hardcoded via `<html className="dark">` in `layout.tsx`.

---

## Cross-Cutting Issues

### Accessibility
- All interactive elements have ARIA labels
- `role="status"` and `role="alert"` used correctly for result displays
- `aria-live="polite"` on deploy status for screen readers
- Focus styles use `focus-visible:ring-2` consistently
- `prefers-reduced-motion` media query disables smooth scrolling
- **Missing:** Skip-to-content link for keyboard navigation [A11Y-01]
- **Missing:** `<nav>` landmark for section navigation [A11Y-02]

### Performance
- First load JS: 104 kB (acceptable for a demo)
- WASM loaded lazily via dynamic import — good
- Landing sections are RSCs — no client JS for static content
- Effect library adds significant JS weight (Effect + Schema + fast-check chunks). Acceptable for a demo.

### CSS/Theming
- `falcon-secondary` color (`#8b5cf6`) is defined in `ThemeToggle.tsx` BRAND_TOKENS but NOT in `globals.css` `@theme` block — any Tailwind class using `falcon-secondary` would silently fail
- All other color tokens work correctly via `@theme` inline in `globals.css`

### Security
- Private key input in Account Deploy is `type="text"` — visible in plaintext [SEC-01]

---

## PRD Comparison

Comparing against `docs/plans/2026-02-23-falcon-demo-website-impl.md` and design doc:

| PRD Requirement | Status | Notes |
|----------------|--------|-------|
| Hero with stats + CTAs | DONE | Minor heading size difference vs spec |
| Why Post-Quantum educational cards | DONE | No diagrams/visuals per spec |
| Performance stats table | DONE | No USD cost estimate |
| Verification Playground (keygen + sign + verify) | PARTIAL | Missing hint creation + packing display |
| Pipeline Visualizer (6-step animation) | DONE | Static animation, not connected to WASM |
| Account Deploy (6-step wizard) | PARTIAL | Only 5 steps, missing step 6 (test tx), placeholder class hash |
| Dark/Light theme toggle | NOT WIRED | Component exists but not rendered |
| Footer with links | DONE | |
| Effect Atoms state management | DONE | All atoms defined and used |
| Effect Services (Falcon + Starknet + WASM) | DONE | Full service layer with error types |
| WASM bindings (7 functions) | DONE | All present in WASM binary |
| Responsive mobile-first layout | DONE | Not visually verified (no Chrome extension) |
| Accessibility (ARIA, focus, live regions) | MOSTLY | Missing skip-to-content, nav landmark |
| 70+ tests passing | DONE | 471 tests (exceeded target) |
| Production build | DONE | Clean static build |

---

## Actionable Tickets (Priority Order)

### P0 — Bugs / Broken Functionality

1. **[BUG-05] Wire ThemeToggle into layout.tsx**
   - File: `apps/demo/src/app/layout.tsx`
   - Import and render `<ThemeToggle />` inside `<body>`
   - Est: 5 min

2. **[BUG-01] Complete the Sign & Verify pipeline to include hint + packing**
   - File: `apps/demo/src/components/interactive/VerificationPlayground.tsx`
   - Update `handleSignAndVerify` to call `FalconService.createHint()` and `FalconService.packPublicKey()` after signing
   - Display packed calldata (29 felt252 slots) via HexDisplay
   - Show signature hex preview
   - Update step progression: sign -> creating-hint -> packing -> verify -> complete
   - Est: 1-2 hours

3. **[BUG-02] Replace placeholder FALCON_ACCOUNT_CLASS_HASH**
   - File: `apps/demo/src/services/StarknetService.ts:11`
   - Blocked on: declaring Cairo contract on Starknet
   - Interim: add user-facing notice that deploy is not yet available
   - Est: 30 min (notice) / blocked (actual fix)

4. **[BUG-03] Add balance polling loop for Fund Account step**
   - File: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
   - Add polling interval (every 5s) calling `StarknetService.getBalance`
   - Auto-advance to deploy step when balance >= required
   - Show balance progress to user
   - Est: 30 min

5. **[BUG-04] Fix computing-address state being immediately overwritten**
   - File: `apps/demo/src/components/interactive/AccountDeployFlow.tsx:80-81`
   - Remove the transient `computing-address` state or add visual transition
   - Est: 15 min

### P1 — UX Polish

6. **[UX-07+08] Add packed calldata + signature hex displays**
   - File: `apps/demo/src/components/interactive/VerificationPlayground.tsx`
   - After sign & verify, show 29 packed felt252 slots and signature preview
   - Est: 30 min

7. **[UX-14] Mask private key input**
   - File: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
   - Change `type="text"` to `type="password"` with reveal toggle
   - Est: 15 min

8. **[UX-10] Add copy-to-clipboard on hex displays**
   - File: `apps/demo/src/components/interactive/HexDisplay.tsx`
   - Add copy icon button, use `navigator.clipboard.writeText()`
   - Est: 30 min

9. **[UX-15] Add Step 6: Sign test transaction**
   - File: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
   - After deploy, offer to sign test tx with new Falcon account
   - Est: 2-3 hours

10. **[UX-11] Add progress indicator to Pipeline Visualizer**
    - File: `apps/demo/src/components/interactive/PipelineVisualizer.tsx`
    - Show "3/6 steps complete" or progress bar
    - Est: 15 min

11. **[UX-02] Add navigation header**
    - New component or modify `layout.tsx`
    - Anchor links to each section
    - Est: 1 hour

### P2 — Nice to Have

12. **[UX-04] Add icons to Why Post-Quantum cards** — Est: 1-2 hours
13. **[UX-05] Add USD cost estimates to Performance Stats** — Est: 1 hour
14. **[A11Y-01] Add skip-to-content link** — Est: 15 min
15. **[A11Y-02] Add section navigation landmark** — Est: 30 min
16. **[UX-13] Connect Pipeline to real WASM operations** — Est: 3-4 hours
17. **[UX-01] Increase hero heading size** — Est: 5 min
18. **CSS: Add `falcon-secondary` to globals.css @theme** — Est: 5 min

---

## Stale Doc Note

The `docs/plans/2026-02-24-falcon-demo-remaining.md` document lists 6 tasks as incomplete, but all have actually been completed:
- WASM bindings: both `create_verification_hint` and `pack_public_key_wasm` are present in the JS glue
- Pipeline Visualizer: both `PipelineSection.tsx` and `PipelineVisualizer.tsx` exist in working tree
- Pipeline is wired into `page.tsx`
- Build verification passes

This doc should be updated or archived.
