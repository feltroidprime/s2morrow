# Demo Site Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Falcon-512 demo site with persuasive narrative copy, visual upgrades, and new sections that pitch Starknet's unique advantage for post-quantum wallets.

**Architecture:** All changes are in `apps/demo/src/`. New landing components replace the existing "Why Post-Quantum" section with a three-part narrative (Problem → Starknet Advantage → Performance Proof). A credibility bar adds social proof. CSS-only visual upgrades (lattice animation, comparison bars, text contrast fixes) require no new dependencies.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, existing glass design system in globals.css

---

### Task 1: Add CSS styles for new visual elements

**Files:**
- Modify: `apps/demo/src/app/globals.css`

**Step 1: Add lattice grid animation keyframes**

Add after the existing `@keyframes slide-up` block (around line 285):

```css
/* ─── Lattice grid animation (hero background) ────────────────────── */
@keyframes lattice-drift {
  0% { transform: translate(0, 0); }
  50% { transform: translate(-8px, 6px); }
  100% { transform: translate(0, 0); }
}

.lattice-grid {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0.15;
}

.lattice-grid::before {
  content: "";
  position: absolute;
  inset: -20px;
  background-image:
    radial-gradient(circle, var(--color-falcon-accent) 1px, transparent 1px),
    radial-gradient(circle, var(--color-falcon-primary) 0.5px, transparent 0.5px);
  background-size: 60px 60px, 60px 60px;
  background-position: 0 0, 30px 30px;
  animation: lattice-drift 20s ease-in-out infinite;
}

.lattice-grid::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 30%, var(--color-falcon-bg) 70%);
}

@media (prefers-reduced-motion: reduce) {
  .lattice-grid::before {
    animation: none;
  }
}
```

**Step 2: Add comparison bar styles**

Add after the lattice grid block:

```css
/* ─── Comparison bar chart ─────────────────────────────────────────── */
.comparison-bar {
  height: 2.5rem;
  border-radius: 0.75rem;
  transition: width 1.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.comparison-bar[data-visible="false"] {
  width: 0 !important;
}
```

**Step 3: Add Starknet section background**

Add after the comparison bar block:

```css
/* ─── Starknet pitch section ──────────────────────────────────────── */
.starknet-section {
  background:
    radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.08) 0%, transparent 60%),
    var(--glass-bg);
  border-top: 1px solid rgba(99, 102, 241, 0.1);
  border-bottom: 1px solid rgba(99, 102, 241, 0.1);
}

.light .starknet-section {
  background:
    radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.06) 0%, transparent 60%),
    var(--glass-bg);
}
```

**Step 4: Fix text opacity for readability**

This is done per-component in later tasks — bump `/40` to `/50` or `/60` where appropriate. No global CSS change needed.

**Step 5: Verify**

Run: `cd apps/demo && npx next dev`
Expected: Dev server starts, no CSS errors. Existing pages render unchanged (new classes not yet used).

**Step 6: Commit**

```bash
git add apps/demo/src/app/globals.css
git commit -m "style: add lattice grid, comparison bar, and starknet section CSS"
```

---

### Task 2: Rewrite Hero component

**Files:**
- Modify: `apps/demo/src/components/landing/Hero.tsx`

**Step 1: Replace entire file content**

```tsx
const HERO_STATS = [
  { value: "132K", label: "Cheaper than secp256r1" },
  { value: "62", label: "17x calldata compression" },
  { value: "29", label: "Fits one contract" },
] as const

export function Hero(): React.JSX.Element {
  return (
    <section id="hero" aria-labelledby="hero-heading" className="relative px-8 py-32 sm:py-40 lg:px-8">
      <div className="lattice-grid" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl text-center">
        <p className="text-xs font-semibold tracking-[0.25em] text-falcon-success/80 uppercase">
          Live on Starknet Sepolia
        </p>
        <h1
          id="hero-heading"
          className="mt-6 text-4xl font-semibold tracking-[-0.02em] text-falcon-text sm:text-6xl"
        >
          Quantum-proof wallets.{" "}
          <span className="text-falcon-accent">No hard fork required.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-falcon-text/60 sm:text-lg">
          Starknet&apos;s account abstraction lets you upgrade to post-quantum signatures today.
          This is a working demo &mdash; generate keys, sign, verify, and deploy. All in your browser.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#verify"
            className="inline-flex rounded-xl bg-gradient-to-b from-falcon-primary to-falcon-primary/80 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-falcon-primary/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-falcon-primary/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-falcon-bg"
          >
            Try It Live
          </a>
          <a
            href="#pipeline"
            className="glass-card-static inline-flex rounded-xl px-7 py-3.5 text-sm font-semibold text-falcon-text/80 transition-all duration-200 hover:scale-[1.02] hover:text-falcon-text active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-falcon-bg"
          >
            How It Works
          </a>
        </div>

        <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl px-6 py-6">
              <dd className="tabular-nums text-3xl font-semibold tracking-tight text-falcon-accent/80">
                {stat.value}
              </dd>
              <dt className="mt-2 text-xs text-falcon-text/50">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
```

**Step 2: Verify in browser**

Expected: Hero shows "LIVE ON STARKNET SEPOLIA" pre-heading in green, headline with cyan accent on "No hard fork required.", lattice grid animating behind text, updated CTAs and contextual stat labels.

**Step 3: Commit**

```bash
git add apps/demo/src/components/landing/Hero.tsx
git commit -m "feat: rewrite hero with persuasive copy and lattice background"
```

---

### Task 3: Create TheProblem component

**Files:**
- Create: `apps/demo/src/components/landing/TheProblem.tsx`

**Step 1: Create the component**

```tsx
const CARDS = [
  {
    title: "Every wallet is a ticking clock",
    description:
      "Shor\u2019s algorithm breaks ECDSA. Not if \u2014 when. Every wallet on Ethereum and every L2 using ECDSA becomes vulnerable. The keys you use today will be exposed.",
  },
  {
    title: "Other chains can\u2019t fix this without breaking everything",
    description:
      "Switching signature schemes requires a hard fork, new address formats, wallet migrations. Ethereum\u2019s roadmap has no timeline for this. L2s that inherit Ethereum\u2019s signature scheme inherit the problem.",
  },
] as const

export function TheProblem(): React.JSX.Element {
  return (
    <section id="the-problem" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          The Problem
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {CARDS.map((card) => (
            <div key={card.title} className="glass-card stagger-child rounded-2xl p-8">
              <h3 className="text-lg font-semibold tracking-tight text-falcon-text/90">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-falcon-text/50">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Verify** — file created, no imports needed yet (added in page.tsx task).

**Step 3: Commit**

```bash
git add apps/demo/src/components/landing/TheProblem.tsx
git commit -m "feat: add TheProblem section with quantum threat cards"
```

---

### Task 4: Create WhyStarknet component

**Files:**
- Create: `apps/demo/src/components/landing/WhyStarknet.tsx`

**Step 1: Create the component**

```tsx
const POINTS = [
  {
    number: "01",
    title: "Native Account Abstraction",
    description:
      "Signature logic lives in the contract, not the protocol. Every wallet chooses its own verification.",
  },
  {
    number: "02",
    title: "Falcon-512",
    description:
      "NIST-standardized lattice-based signatures. Battle-tested math with tight security proofs.",
  },
  {
    number: "03",
    title: "Cheaper than ECDSA",
    description:
      "132K Cairo steps. The post-quantum future costs less than the signature scheme you use today.",
  },
] as const

export function WhyStarknet(): React.JSX.Element {
  return (
    <section id="why-starknet" className="starknet-section px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          Starknet already solved this.
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-falcon-text/60 sm:text-lg">
          Account abstraction means every wallet chooses its own signature verification.
          No protocol change. No hard fork. No migration. Deploy a new account contract,
          and your wallet is quantum-safe.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {POINTS.map((point) => (
            <div key={point.number} className="glass-card stagger-child rounded-2xl p-8">
              <span className="font-mono text-xs font-semibold text-falcon-primary/60">
                {point.number}
              </span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-falcon-text/90">
                {point.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-falcon-text/50">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Verify** — file created.

**Step 3: Commit**

```bash
git add apps/demo/src/components/landing/WhyStarknet.tsx
git commit -m "feat: add WhyStarknet centerpiece pitch section"
```

---

### Task 5: Create ComparisonChart component

**Files:**
- Create: `apps/demo/src/components/landing/ComparisonChart.tsx`

**Step 1: Create the component**

This is a client component because it uses IntersectionObserver to animate bars on scroll.

```tsx
"use client"

import React, { useEffect, useRef, useState } from "react"

export function ComparisonChart(): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="mt-10 space-y-4">
      {/* secp256r1 bar */}
      <div className="flex items-center gap-4">
        <span className="w-36 shrink-0 text-right text-xs text-falcon-text/40 sm:w-44">
          secp256r1 (ECDSA)
        </span>
        <div className="flex-1">
          <div
            className="comparison-bar bg-falcon-text/10"
            data-visible={visible}
            style={{ width: visible ? "100%" : undefined }}
          />
        </div>
        <span className="w-20 shrink-0 tabular-nums text-sm font-semibold text-falcon-text/50">
          ~230K
        </span>
      </div>
      {/* Falcon bar */}
      <div className="flex items-center gap-4">
        <span className="w-36 shrink-0 text-right text-xs font-semibold text-falcon-accent/70 sm:w-44">
          Falcon-512
        </span>
        <div className="flex-1">
          <div
            className="comparison-bar bg-gradient-to-r from-falcon-primary to-falcon-accent"
            data-visible={visible}
            style={{ width: visible ? "57%" : undefined }}
          />
        </div>
        <span className="w-20 shrink-0 tabular-nums text-sm font-semibold text-falcon-accent">
          132K
        </span>
      </div>
      <p className="pt-2 text-center text-xs text-falcon-text/30">Cairo steps (lower is better)</p>
    </div>
  )
}
```

**Step 2: Verify** — file created.

**Step 3: Commit**

```bash
git add apps/demo/src/components/landing/ComparisonChart.tsx
git commit -m "feat: add animated comparison bar chart component"
```

---

### Task 6: Rewrite PerformanceStats with comparison-led layout

**Files:**
- Modify: `apps/demo/src/components/landing/PerformanceStats.tsx`

**Step 1: Replace file content**

```tsx
"use client"

import React, { useState } from "react"
import { ComparisonChart } from "./ComparisonChart"

type PerformanceRow = { operation: string; steps: string; gas: string }

const PERFORMANCE_ROWS: readonly PerformanceRow[] = [
  { operation: "verify", steps: "63,177", gas: "~13.2M L2" },
  { operation: "verify_with_msg_point", steps: "26,301", gas: "~5.5M L2" },
  { operation: "hash_to_point", steps: "5,988", gas: "~1.3M L2" },
  { operation: "NTT-512", steps: "~15,000", gas: "~3.1M L2" },
]

export function PerformanceStats(): React.JSX.Element {
  const [showBreakdown, setShowBreakdown] = useState(false)

  return (
    <section id="performance-stats" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          Faster than the signature scheme you use today
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-falcon-text/50 sm:text-lg">
          Falcon-512 verification:{" "}
          <span className="font-semibold text-falcon-accent">132K</span> Cairo steps.
          secp256r1 (the standard): ~230K steps.
          Post-quantum security at{" "}
          <span className="font-semibold text-falcon-accent">43% less cost</span>.
        </p>

        <ComparisonChart />

        <div className="mt-10">
          <button
            onClick={() => setShowBreakdown((prev) => !prev)}
            className="glass-btn rounded-lg px-4 py-2 text-xs font-medium text-falcon-text/50 transition-colors hover:text-falcon-text/70"
          >
            {showBreakdown ? "Hide breakdown" : "See the full breakdown"} &#x25BE;
          </button>

          {showBreakdown && (
            <div className="glass-card-static mt-4 overflow-hidden rounded-2xl animate-fade-in">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th scope="col" className="px-8 py-4 text-xs font-medium tracking-wide text-falcon-text/40 uppercase">
                      Operation
                    </th>
                    <th scope="col" className="px-8 py-4 text-right text-xs font-medium tracking-wide text-falcon-text/40 uppercase">
                      Steps
                    </th>
                    <th scope="col" className="px-8 py-4 text-right text-xs font-medium tracking-wide text-falcon-text/40 uppercase">
                      L2 Gas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PERFORMANCE_ROWS.map((row, i) => (
                    <tr
                      key={row.operation}
                      className={i < PERFORMANCE_ROWS.length - 1 ? "border-b border-[var(--glass-border)]" : undefined}
                    >
                      <td className="px-8 py-5 font-mono text-xs text-falcon-accent/70">{row.operation}</td>
                      <td className="px-8 py-5 text-right tabular-nums text-falcon-text/80">{row.steps}</td>
                      <td className="px-8 py-5 text-right tabular-nums text-falcon-text/40">{row.gas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-card mt-8 rounded-2xl p-8">
          <h3 className="text-base font-semibold tracking-tight text-falcon-text/90">
            17x calldata compression
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-falcon-text/50">
            512 Zq coefficients packed into{" "}
            <span className="font-semibold text-falcon-accent/70">29 felt252</span> storage slots.{" "}
            <span className="font-mono text-xs text-falcon-text/60">1,030 felts</span> reduced to{" "}
            <span className="font-mono text-xs text-falcon-text/60">62 felts</span> on-chain.
          </p>
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Verify** — dev server shows comparison bars, collapsible table, rewritten copy.

**Step 3: Commit**

```bash
git add apps/demo/src/components/landing/PerformanceStats.tsx
git commit -m "feat: rewrite performance stats with comparison chart and collapsible detail"
```

---

### Task 7: Create CredibilityBar component

**Files:**
- Create: `apps/demo/src/components/landing/CredibilityBar.tsx`

**Step 1: Create the component**

```tsx
const ITEMS = [
  {
    label: "NIST Standardized",
    href: "https://csrc.nist.gov/pubs/fips/206/final",
  },
  {
    label: "Built in Public",
    href: "https://x.com/feltroidPrime/status/2016231328065454142",
  },
  {
    label: "zknox Collaboration",
    href: "https://github.com/ZKNoxHQ/falzkon",
  },
  {
    label: "Open Source",
    href: "https://github.com/feltroidprime/s2morrow",
  },
] as const

export function CredibilityBar(): React.JSX.Element {
  return (
    <section aria-label="Credibility" className="border-y border-[var(--glass-border)] px-8 py-8 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {ITEMS.map((item, i) => (
          <span key={item.label} className="flex items-center gap-3">
            {i > 0 && (
              <span className="hidden text-falcon-text/15 sm:inline" aria-hidden="true">
                &middot;
              </span>
            )}
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium tracking-wide text-falcon-text/40 uppercase transition-colors duration-200 hover:text-falcon-accent"
            >
              {item.label}
            </a>
          </span>
        ))}
      </div>
    </section>
  )
}
```

**Step 2: Verify** — file created.

**Step 3: Commit**

```bash
git add apps/demo/src/components/landing/CredibilityBar.tsx
git commit -m "feat: add credibility bar with trust markers"
```

---

### Task 8: Update interactive section copy and Footer

**Files:**
- Modify: `apps/demo/src/components/interactive/PlaygroundSection.tsx`
- Modify: `apps/demo/src/components/interactive/VerificationPlayground.tsx`
- Modify: `apps/demo/src/components/interactive/PipelineSection.tsx`
- Modify: `apps/demo/src/components/interactive/PipelineVisualizer.tsx`
- Modify: `apps/demo/src/components/interactive/AccountDeploySection.tsx`
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
- Modify: `apps/demo/src/components/landing/Footer.tsx`

**Step 1: Update PlaygroundSection loading state heading**

In `PlaygroundSection.tsx`, change line 14 from:
```tsx
            Verification Playground
```
to:
```tsx
            Try it yourself
```

**Step 2: Update VerificationPlayground heading and subhead**

In `VerificationPlayground.tsx`, change lines 12-17 from:
```tsx
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          Verification Playground
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-falcon-text/40">
          Generate a Falcon-512 keypair in-browser via WASM, sign a message,
          and verify the signature. All crypto runs locally.
        </p>
```
to:
```tsx
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          Try it yourself
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-falcon-text/50">
          Generate a Falcon-512 keypair, sign any message, and verify &mdash;
          all running locally in your browser via WebAssembly.
        </p>
```

**Step 3: Update PipelineSection loading state heading**

In `PipelineSection.tsx`, change line 14 from:
```tsx
            Verification Pipeline
```
to:
```tsx
            What happens on-chain
```

**Step 4: Update PipelineVisualizer heading and subhead**

In `PipelineVisualizer.tsx`, change lines 127-133 from:
```tsx
            <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
              Verification Pipeline
            </h2>
            <p className="mt-3 text-sm text-falcon-text/40">
              Step through the 6-stage Falcon-512 on-chain verification
            </p>
```
to:
```tsx
            <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
              What happens on-chain
            </h2>
            <p className="mt-3 text-sm text-falcon-text/50">
              Step through the 6 stages of Falcon-512 verification on Starknet
            </p>
```

**Step 5: Update AccountDeploySection loading state heading**

In `AccountDeploySection.tsx`, change line 12 from:
```tsx
          <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">Account Deploy Flow</h2>
```
to:
```tsx
          <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">Deploy your own quantum-safe account</h2>
```

**Step 6: Update AccountDeployFlow heading, subhead, and text opacity**

In `AccountDeployFlow.tsx`, change line 283 from:
```tsx
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">Account Deploy Flow</h2>
```
to:
```tsx
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">Deploy your own quantum-safe account</h2>
```

Change lines 284-287 from:
```tsx
        <p className="mt-4 text-sm leading-relaxed text-falcon-text/40">
          Deploy a Falcon-powered account to Starknet {networkConfig.name} with the same keypair used in
          the verification playground.
        </p>
```
to:
```tsx
        <p className="mt-4 text-sm leading-relaxed text-falcon-text/50">
          Deploy a Falcon-powered account to Starknet {networkConfig.name} &mdash; takes about 60 seconds.
          Uses the same keypair from the playground above.
        </p>
```

**Step 7: Update Footer**

Replace `apps/demo/src/components/landing/Footer.tsx` with:

```tsx
export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-[var(--glass-border)] px-8 py-12 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm sm:flex-row">
        <p className="text-falcon-text/30">
          Built by{" "}
          <a
            href="https://x.com/feltroidPrime"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            @feltroidPrime
          </a>
        </p>
        <nav aria-label="Footer links" className="flex items-center gap-6">
          <a
            href="https://github.com/feltroidprime/s2morrow"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            GitHub
          </a>
          <a
            href="https://docs.starknet.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            Starknet Docs
          </a>
          <a
            href="https://csrc.nist.gov/pubs/fips/206/final"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            Falcon Spec
          </a>
        </nav>
      </div>
    </footer>
  )
}
```

**Step 8: Verify** — all sections render with updated copy.

**Step 9: Commit**

```bash
git add apps/demo/src/components/interactive/PlaygroundSection.tsx apps/demo/src/components/interactive/VerificationPlayground.tsx apps/demo/src/components/interactive/PipelineSection.tsx apps/demo/src/components/interactive/PipelineVisualizer.tsx apps/demo/src/components/interactive/AccountDeploySection.tsx apps/demo/src/components/interactive/AccountDeployFlow.tsx apps/demo/src/components/landing/Footer.tsx
git commit -m "feat: update interactive section headings and footer with persuasive copy"
```

---

### Task 9: Restructure page.tsx with new section order

**Files:**
- Modify: `apps/demo/src/app/page.tsx`

**Step 1: Replace page.tsx content**

```tsx
import { Footer } from "@/components/landing/Footer"
import { Hero } from "@/components/landing/Hero"
import { NavHeader } from "@/components/landing/NavHeader"
import { TheProblem } from "@/components/landing/TheProblem"
import { WhyStarknet } from "@/components/landing/WhyStarknet"
import { PerformanceStats } from "@/components/landing/PerformanceStats"
import { CredibilityBar } from "@/components/landing/CredibilityBar"
import { PlaygroundSection } from "@/components/interactive/PlaygroundSection"
import { PipelineSection } from "@/components/interactive/PipelineSection"
import { AccountDeploySection } from "@/components/interactive/AccountDeploySection"
import { ScrollReveal } from "@/components/ScrollReveal"

export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen">
      <NavHeader />
      <Hero />
      <ScrollReveal>
        <TheProblem />
      </ScrollReveal>
      <ScrollReveal>
        <WhyStarknet />
      </ScrollReveal>
      <ScrollReveal>
        <PerformanceStats />
      </ScrollReveal>
      <CredibilityBar />
      <ScrollReveal>
        <PlaygroundSection />
      </ScrollReveal>
      <ScrollReveal>
        <PipelineSection />
      </ScrollReveal>
      <ScrollReveal>
        <AccountDeploySection />
      </ScrollReveal>
      <Footer />
    </main>
  )
}
```

**Step 2: Update NavHeader links**

In `apps/demo/src/components/landing/NavHeader.tsx`, change lines 10-15 from:
```tsx
const NAV_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#verify", label: "Verify" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#deploy", label: "Deploy" },
] as const
```
to:
```tsx
const NAV_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#why-starknet", label: "Why Starknet" },
  { href: "#verify", label: "Try It" },
  { href: "#deploy", label: "Deploy" },
] as const
```

**Step 3: Delete WhyPostQuantum.tsx**

```bash
rm apps/demo/src/components/landing/WhyPostQuantum.tsx
```

**Step 4: Verify** — full page renders with new section order: Hero → Problem → Starknet → Performance → Credibility → Playground → Pipeline → Deploy → Footer. No import errors.

**Step 5: Commit**

```bash
git add apps/demo/src/app/page.tsx apps/demo/src/components/landing/NavHeader.tsx
git rm apps/demo/src/components/landing/WhyPostQuantum.tsx
git commit -m "feat: restructure page with narrative arc and remove WhyPostQuantum"
```

---

### Task 10: Final visual polish pass

**Files:**
- Modify: various files as needed

**Step 1: Visual review in browser**

Open `http://localhost:3000` and scroll through the entire page. Check:
- Lattice grid renders and animates in hero
- "No hard fork required." renders in cyan accent
- TheProblem cards have readable text (not too faint)
- WhyStarknet section has distinct background (indigo gradient wash)
- Comparison bars animate on scroll
- Collapsible breakdown table works
- Credibility bar renders centered with dot separators
- All interactive sections have updated headings
- Footer shows @feltroidPrime and all 3 links
- Light mode works (toggle theme)
- Mobile layout stacks correctly (resize to 375px width)

**Step 2: Fix any visual issues found**

Adjust spacing, opacity values, or breakpoints as needed based on the review.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual polish adjustments from review"
```

---

## Parallelism Map

Tasks that can run in parallel (no dependencies between them):

```
Task 1 (CSS)  ─┐
Task 2 (Hero)  ─┤
Task 3 (TheProblem)  ─┤
Task 4 (WhyStarknet)  ─┼── all independent ──→ Task 9 (page.tsx assembly)
Task 5 (ComparisonChart) ─┤                           │
Task 7 (CredibilityBar)  ─┤                           ▼
Task 8 (copy updates)  ─┘                     Task 10 (visual review)

Task 6 (PerformanceStats) depends on Task 5 (imports ComparisonChart)
Task 9 depends on Tasks 1-8 (assembles all sections)
Task 10 depends on Task 9 (visual review of assembled page)
```

Maximum parallel batch: Tasks 1, 2, 3, 4, 5, 7, 8 can all run simultaneously.
