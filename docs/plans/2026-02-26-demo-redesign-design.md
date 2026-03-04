# Demo Site Redesign — Full Polish

**Date:** 2026-02-26
**Status:** Approved
**Scope:** Narrative restructure, persuasive copy, visual upgrades, new sections

## Core Thesis

**"Starknet can do post-quantum wallets today — no hard fork required."**

Every piece of copy, every section order, every visual choice serves this thesis.

## Target Audiences

1. **Starknet ecosystem** — devs, community, stakeholders
2. **Broader crypto** — Ethereum devs, security researchers, crypto-native users
3. **Investors / grants** — Starknet Foundation, VCs, grant committees

The site works at two levels: a compelling narrative surface anyone in crypto can follow, with technical depth underneath for builders.

## Narrative Arc

```
Hook (hero)
  → Problem (quantum threat)
    → Solution (Starknet AA — THE pitch)
      → Proof (performance comparison)
        → Trust (credibility bar)
          → Experience (verification playground)
            → Understand (pipeline visualizer)
              → Act (deploy account)
                → Connect (footer)
```

---

## Section 1: Hero

**Current:** "Post-Quantum Signatures on Starknet" — descriptive, not persuasive.

**New:**

| Element | Content |
|---------|---------|
| Pre-heading | `LIVE ON STARKNET SEPOLIA` |
| Headline | `Quantum-proof wallets. No hard fork required.` |
| Subhead | `Starknet's account abstraction lets you upgrade to post-quantum signatures today. This is a working demo — generate keys, sign, verify, and deploy. All in your browser.` |
| CTA primary | `Try It Live` → #verify |
| CTA secondary | `How It Works` → #pipeline |

**Stats bar (reframed with context):**

| Value | Label |
|-------|-------|
| 132K steps | Cheaper than secp256r1 |
| 62 felts | 17x calldata compression |
| 29 slots | Fits one contract |

**Visual:** Subtle animated lattice grid behind hero text. CSS-only: dots connected by faint lines, slowly drifting. Evokes lattice math behind Falcon without adding JS weight.

---

## Section 2a: The Problem

**Current:** "Why Post-Quantum?" with 4 equal-weight cards.

**New:** 2 cards, punchy, creating urgency.

**Card 1: "Every wallet is a ticking clock"**
> Shor's algorithm breaks ECDSA. Not if — when. Every wallet on Ethereum and every L2 using ECDSA becomes vulnerable. The keys you use today will be exposed.

**Card 2: "Other chains can't fix this without breaking everything"**
> Switching signature schemes requires a hard fork, new address formats, wallet migrations. Ethereum's roadmap has no timeline for this. L2s that inherit Ethereum's signature scheme inherit the problem.

---

## Section 2b: Why Starknet (NEW — the centerpiece)

Visually distinct from surrounding sections. Slightly elevated glass or subtle gradient shift to signal importance.

| Element | Content |
|---------|---------|
| Headline | `Starknet already solved this.` |
| Subhead | `Account abstraction means every wallet chooses its own signature verification. No protocol change. No hard fork. No migration. Deploy a new account contract, and your wallet is quantum-safe.` |

**3 supporting points (horizontal cards):**

| Point | Title | Description |
|-------|-------|-------------|
| 1 | Native AA | Signature logic lives in the contract, not the protocol. |
| 2 | Falcon-512 | NIST-standardized lattice signatures. Battle-tested math. |
| 3 | Cheaper than ECDSA | 132K steps. The post-quantum future costs less than the present. |

---

## Section 3: Performance Proof

**Current:** Raw table with steps + gas. No context for non-technical visitors.

**New:** Lead with comparison, detail underneath.

| Element | Content |
|---------|---------|
| Headline | `Faster than the signature scheme you use today` |
| Subhead | `Falcon-512 verification: 132K Cairo steps. secp256r1 (the standard): ~230K steps. Post-quantum security at 43% less cost.` |

**Visual: Horizontal bar comparison (CSS-only, animated on scroll-reveal)**

```
secp256r1 (ECDSA)   ████████████████████████   230K steps
Falcon-512          ██████████████             132K steps
```

**Collapsible detail:** "See the full breakdown" expands to show the existing operation table (hash_to_point, NTT-512, verify, etc.).

**Calldata card (rewritten):**
> **17x calldata compression.** 512 Zq coefficients packed into 29 felt252 slots. 1,030 felts reduced to 62 on-chain.

---

## Section 4: Credibility Bar (NEW)

Slim horizontal trust strip between the pitch sections and interactive sections.

```
NIST Standardized  ·  Built in Public (5 episodes)  ·  zknox Collaboration  ·  Open Source
```

Each item links out:
- NIST → Falcon standard page
- Built in Public → Day 1 tweet thread
- zknox → their Falcon Cairo repo
- Open Source → this repo on GitHub

No cards, no heavy design. Just a trust line with subtle hover effects.

---

## Section 5: Verification Playground (existing, copy updates)

| Element | Current | New |
|---------|---------|-----|
| Heading | Verification Playground | Try it yourself |
| Subhead | "Generate a Falcon-512 keypair in-browser via WASM..." | "Generate a Falcon-512 keypair, sign any message, and verify — all running locally in your browser via WebAssembly." |

No structural changes to KeyManagementPanel or SignVerifyPanel.

---

## Section 6: Pipeline Visualizer (existing, copy update)

| Element | Current | New |
|---------|---------|-----|
| Heading | (section heading) | What happens on-chain |

No structural changes.

---

## Section 7: Account Deploy (existing, copy updates)

| Element | Current | New |
|---------|---------|-----|
| Heading | (section heading) | Deploy your own quantum-safe account |
| Subhead | (none or minimal) | On Starknet Sepolia testnet — takes about 60 seconds. |

No structural changes to AccountDeployFlow or SendTransaction.

---

## Section 8: Footer (enhanced)

```
Left:   Built by @feltroidPrime  ·  [Twitter]
Right:  [GitHub]  ·  [Starknet Docs]  ·  [Falcon Spec]
```

---

## Visual Upgrades

### 1. Animated lattice grid (hero background)
CSS-only. Small dots (`radial-gradient`) connected by faint lines, positioned absolutely behind hero text. Subtle `@keyframes` drift animation. No JS, no canvas, no libraries.

### 2. "Why Starknet" visual distinction
Different background treatment — slightly stronger glass, or a subtle indigo gradient wash — to make it feel like THE section. Consider a faint border-left accent or a background that's distinct from the alternating section pattern.

### 3. Comparison bar chart
CSS `width` transitions animated on scroll-reveal. Two bars, labeled, with the Falcon bar highlighted in accent color and the secp256r1 bar in muted.

### 4. Typography contrast
Body text currently uses `text-falcon-text/40` (40% opacity) — too faint. Bump to `text-falcon-text/50` for descriptions, `text-falcon-text/60` for important copy. Keep `/40` only for tertiary labels.

### 5. Accent on key numbers
Performance numbers (132K, 62, 29, 17x, 43%) get `text-falcon-accent` treatment throughout, not just in the stats bar.

---

## Files Affected

### New files
- `src/components/landing/TheProblem.tsx` — 2-card threat section
- `src/components/landing/WhyStarknet.tsx` — the centerpiece pitch section
- `src/components/landing/CredibilityBar.tsx` — trust strip
- `src/components/landing/ComparisonChart.tsx` — bar comparison visualization

### Modified files
- `src/app/page.tsx` — new section order, new imports
- `src/components/landing/Hero.tsx` — rewritten copy, lattice background, updated stats
- `src/components/landing/PerformanceStats.tsx` — comparison-led layout, collapsible detail
- `src/components/landing/Footer.tsx` — enhanced links
- `src/components/interactive/VerificationPlayground.tsx` — copy updates
- `src/components/interactive/PipelineSection.tsx` — heading update (if heading is here)
- `src/components/interactive/AccountDeploySection.tsx` — copy updates
- `src/app/globals.css` — lattice animation keyframes, comparison bar styles, Starknet section background

### Deleted files
- `src/components/landing/WhyPostQuantum.tsx` — replaced by TheProblem + WhyStarknet

---

## Out of Scope

- No routing changes (stays single-page)
- No new dependencies (all CSS-only visual upgrades)
- No changes to interactive component logic (atoms, services, WASM)
- No changes to network config or deployment flow
- Mobile responsiveness maintained via existing Tailwind breakpoints
