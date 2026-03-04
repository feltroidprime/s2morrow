# LANDING-006: Compose Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compose `apps/demo/src/app/page.tsx` with all RSC landing sections (Hero, WhyPostQuantum, PerformanceStats, Footer) and three dynamic interactive placeholders (verify, pipeline, deploy), each loaded via `next/dynamic` with `ssr: false` and `SectionSkeleton` loading states.

**Architecture:** The page is a React Server Component that statically renders four landing sections (zero client JS) and lazy-loads three interactive client sections via `next/dynamic({ ssr: false })`. Interactive components don't exist yet — minimal placeholder stubs are created so the dynamic imports resolve. A `SectionSkeleton` component provides the loading fallback. A `next/dynamic` mock ensures existing `renderToStaticMarkup`-based tests keep passing.

**Tech Stack:** Next.js 15 App Router, React 19, Bun test runner, Tailwind CSS v4, `next/dynamic`

---

## Current State

| What | Status |
|------|--------|
| `page.tsx` | Exists — renders `<WhyPostQuantum />` + `<PerformanceStats />` in `<main>` |
| `WhyPostQuantum.tsx` | Exists — fully implemented RSC |
| `PerformanceStats.tsx` | Exists — fully implemented RSC |
| `Hero.tsx` | **Does NOT exist** — test skeleton has `.todo` tests |
| `Footer.tsx` | **Does NOT exist** — test skeleton has `.todo` tests |
| `SectionSkeleton` | **Does NOT exist** |
| Interactive components | **None exist** at `components/interactive/` |
| `next/dynamic` usage | **None** in codebase yet |
| Test baseline | 25 pass, 11 todo, 0 fail across 5 test files |

## Critical Constraint: Test Compatibility

Two existing test files import and render `<Home />` via `renderToStaticMarkup`:
- `why-post-quantum.test.tsx` line 3: `import Home from "../../app/page"`
- `performance-stats.page.integration.test.ts` line 8: `import Home from "../../app/page"`

When `page.tsx` uses `next/dynamic`, these tests will break because `next/dynamic` depends on the Next.js runtime which isn't available in Bun's test environment. **Solution:** Create a Bun preload mock for `next/dynamic` that returns the `loading` fallback component.

---

## Task 1: Create Hero Component

### Files
- Modify: `apps/demo/src/tests/landing/hero.test.ts` → rename to `.tsx`, replace `.todo` tests with real tests
- Create: `apps/demo/src/components/landing/Hero.tsx`

### Step 1: Write the failing Hero tests

Replace the `.todo` skeleton in `hero.test.ts`. Rename to `.tsx` for JSX support. Tests use `renderToStaticMarkup` (same pattern as WhyPostQuantum tests).

**File: `apps/demo/src/tests/landing/hero.test.tsx`** (replaces `hero.test.ts`)

```tsx
import { describe, test, expect } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Hero } from "../../components/landing/Hero"

function renderHero(): string {
  return renderToStaticMarkup(React.createElement(Hero))
}

describe("Hero (RSC)", () => {
  test("renders headline with 'Falcon-512 on Starknet'", () => {
    const html = renderHero()
    expect(html).toContain("Falcon-512")
    expect(html).toContain("Starknet")
    expect(html).toContain("<h1")
  })

  test("renders 'Post-Quantum Cryptography' label", () => {
    const html = renderHero()
    expect(html).toContain("Post-Quantum")
  })

  test("renders three stats: 63K steps, 62 calldata felts, 29 storage slots", () => {
    const html = renderHero()
    expect(html).toContain("63K")
    expect(html).toContain("Steps")
    expect(html).toContain("62")
    expect(html).toContain("Calldata felts")
    expect(html).toContain("29")
    expect(html).toContain("Storage slots")
  })

  test("renders 'Try Verification' CTA linking to #verify", () => {
    const html = renderHero()
    expect(html).toContain('href="#verify"')
    expect(html).toContain("Try Verification")
  })

  test("renders 'Deploy Account' CTA linking to #deploy", () => {
    const html = renderHero()
    expect(html).toContain('href="#deploy"')
    expect(html).toContain("Deploy Account")
  })

  test("contains no <script> tags (zero client JS as RSC)", () => {
    const html = renderHero()
    expect(html).not.toContain("<script")
  })
})

// Keep existing smoke test
import type { FalconKeypair } from "../../services/types"
test("FalconKeypair type is importable (types for landing section compile)", () => {
  const shape: Pick<FalconKeypair, "publicKeyNtt"> = {
    publicKeyNtt: new Int32Array(512),
  }
  expect(shape.publicKeyNtt.length).toBe(512)
})
```

### Step 2: Run test to verify it fails

```bash
cd apps/demo && bun test src/tests/landing/hero.test.tsx
```

Expected: FAIL — `Hero` not found at `../../components/landing/Hero`

### Step 3: Implement Hero component

**File: `apps/demo/src/components/landing/Hero.tsx`**

```tsx
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-falcon-accent">{value}</p>
      <p className="mt-1 text-sm text-falcon-muted">{label}</p>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-semibold tracking-widest text-falcon-accent uppercase">
          Post-Quantum Cryptography
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">
          Falcon-512 on <span className="text-falcon-primary">Starknet</span>
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
```

### Step 4: Run test to verify it passes

```bash
cd apps/demo && bun test src/tests/landing/hero.test.tsx
```

Expected: All 7 tests PASS

### Step 5: Run all landing tests (regression)

```bash
cd apps/demo && bun test src/tests/landing/
```

Expected: 25 pass (previous) + 7 new hero tests = 32 pass, 4 remaining todo (footer)

### Step 6: Commit

```bash
jj describe -m "feat(landing): add Hero RSC component with tests — LANDING-006"
```

---

## Task 2: Create Footer Component

### Files
- Modify: `apps/demo/src/tests/landing/footer.test.ts` → rename to `.tsx`, replace `.todo` tests
- Create: `apps/demo/src/components/landing/Footer.tsx`

### Step 1: Write the failing Footer tests

**File: `apps/demo/src/tests/landing/footer.test.tsx`** (replaces `footer.test.ts`)

```tsx
import { describe, test, expect } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Footer } from "../../components/landing/Footer"

function renderFooter(): string {
  return renderToStaticMarkup(React.createElement(Footer))
}

describe("Footer (RSC)", () => {
  test("renders GitHub link with target=_blank and rel=noopener noreferrer", () => {
    const html = renderFooter()
    expect(html).toContain("GitHub")
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  test("renders Starknet Docs link pointing to docs.starknet.io", () => {
    const html = renderFooter()
    expect(html).toContain("Starknet Docs")
    expect(html).toContain("https://docs.starknet.io")
  })

  test("GitHub link points to correct repository URL", () => {
    const html = renderFooter()
    expect(html).toContain("https://github.com")
  })

  test("renders a <footer> element", () => {
    const html = renderFooter()
    expect(html).toContain("<footer")
  })

  test("contains no <script> tags (zero client JS as RSC)", () => {
    const html = renderFooter()
    expect(html).not.toContain("<script")
  })
})

// Keep existing smoke test
test("expected footer link targets are valid URLs", () => {
  const GITHUB_URL = "https://github.com/s2morrow/s2morrow"
  const STARKNET_DOCS_URL = "https://docs.starknet.io"
  expect(GITHUB_URL).toStartWith("https://")
  expect(STARKNET_DOCS_URL).toStartWith("https://")
})
```

### Step 2: Run test to verify it fails

```bash
cd apps/demo && bun test src/tests/landing/footer.test.tsx
```

Expected: FAIL — `Footer` not found

### Step 3: Implement Footer component

**File: `apps/demo/src/components/landing/Footer.tsx`**

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
            href="https://github.com/s2morrow/s2morrow"
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

### Step 4: Run test to verify it passes

```bash
cd apps/demo && bun test src/tests/landing/footer.test.tsx
```

Expected: All 6 tests PASS

### Step 5: Regression

```bash
cd apps/demo && bun test src/tests/landing/
```

Expected: 38 pass, 0 todo, 0 fail

### Step 6: Commit

```bash
jj describe -m "feat(landing): add Footer RSC component with tests — LANDING-006"
```

---

## Task 3: Create SectionSkeleton + Interactive Placeholder Stubs

### Files
- Create: `apps/demo/src/tests/landing/section-skeleton.test.tsx`
- Create: `apps/demo/src/components/landing/SectionSkeleton.tsx`
- Create: `apps/demo/src/components/interactive/VerificationPlayground.tsx` (minimal stub)
- Create: `apps/demo/src/components/interactive/PipelineVisualizer.tsx` (minimal stub)
- Create: `apps/demo/src/components/interactive/AccountDeployFlow.tsx` (minimal stub)

### Step 1: Write SectionSkeleton tests

**File: `apps/demo/src/tests/landing/section-skeleton.test.tsx`**

```tsx
import { describe, test, expect } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { SectionSkeleton } from "../../components/landing/SectionSkeleton"

function renderSkeleton(title: string): string {
  return renderToStaticMarkup(React.createElement(SectionSkeleton, { title }))
}

describe("SectionSkeleton", () => {
  test("renders the provided title as an h2 heading", () => {
    const html = renderSkeleton("Verification Playground")
    expect(html).toContain("<h2")
    expect(html).toContain("Verification Playground")
  })

  test("renders animated pulse placeholder", () => {
    const html = renderSkeleton("Test Section")
    expect(html).toContain("animate-pulse")
  })

  test("renders different titles correctly", () => {
    expect(renderSkeleton("Pipeline Deep-Dive")).toContain("Pipeline Deep-Dive")
    expect(renderSkeleton("Deploy Account")).toContain("Deploy Account")
  })

  test("contains no <script> tags", () => {
    const html = renderSkeleton("Any Section")
    expect(html).not.toContain("<script")
  })
})
```

### Step 2: Run test to verify it fails

```bash
cd apps/demo && bun test src/tests/landing/section-skeleton.test.tsx
```

Expected: FAIL — `SectionSkeleton` not found

### Step 3: Implement SectionSkeleton

**File: `apps/demo/src/components/landing/SectionSkeleton.tsx`**

```tsx
export function SectionSkeleton({ title }: { title: string }) {
  return (
    <div className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <div className="mt-8 h-48 rounded-xl bg-falcon-surface animate-pulse" />
      </div>
    </div>
  )
}
```

### Step 4: Run test to verify it passes

```bash
cd apps/demo && bun test src/tests/landing/section-skeleton.test.tsx
```

Expected: 4 tests PASS

### Step 5: Create interactive placeholder stubs

These are minimal `"use client"` components so `next/dynamic` imports resolve at runtime. They'll be replaced by real implementations in later tickets.

**File: `apps/demo/src/components/interactive/VerificationPlayground.tsx`**

```tsx
"use client"

export function VerificationPlayground() {
  return (
    <section id="verify" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">Verification Playground</h2>
        <p className="mt-4 text-falcon-muted">Coming soon — WASM loading required.</p>
      </div>
    </section>
  )
}
```

**File: `apps/demo/src/components/interactive/PipelineVisualizer.tsx`**

```tsx
"use client"

export function PipelineVisualizer() {
  return (
    <section id="pipeline" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">Pipeline Deep-Dive</h2>
        <p className="mt-4 text-falcon-muted">Coming soon — WASM loading required.</p>
      </div>
    </section>
  )
}
```

**File: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`**

```tsx
"use client"

export function AccountDeployFlow() {
  return (
    <section id="deploy" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">Deploy Account</h2>
        <p className="mt-4 text-falcon-muted">Coming soon — Starknet mainnet integration required.</p>
      </div>
    </section>
  )
}
```

### Step 6: Run all tests (regression)

```bash
cd apps/demo && bun test src/tests/landing/
```

Expected: 42 pass, 0 todo, 0 fail

### Step 7: Commit

```bash
jj describe -m "feat(landing): add SectionSkeleton and interactive placeholder stubs — LANDING-006"
```

---

## Task 4: Mock next/dynamic + Write Page Composition Tests

### Files
- Create: `apps/demo/src/tests/__mocks__/next-dynamic.ts`
- Create: `apps/demo/src/tests/landing/page-composition.test.tsx`
- Modify: `apps/demo/src/tests/landing/why-post-quantum.test.tsx` (add mock preload)
- Modify: `apps/demo/src/tests/landing/performance-stats.page.integration.test.ts` (add mock preload)

### Step 1: Create the next/dynamic mock

`next/dynamic` is called with a loader function and an options object. In test context, we want it to return the `loading` component (since `ssr: false` means we render loading during SSR). If no loading is provided, render nothing.

**File: `apps/demo/src/tests/__mocks__/next-dynamic.ts`**

```ts
import React from "react"

/**
 * Mock for next/dynamic used by bun test.
 *
 * When ssr: false, the real next/dynamic renders the loading fallback during SSR.
 * This mock does the same: it ignores the async loader and returns a component
 * that renders the loading fallback (or null if none provided).
 */
export default function dynamic(
  _loader: () => Promise<any>,
  options?: { ssr?: boolean; loading?: () => React.ReactElement | null },
): React.ComponentType<any> {
  const LoadingComponent = options?.loading
  // Return a named component for better debug output
  function DynamicMock(props: Record<string, unknown>) {
    return LoadingComponent ? React.createElement(LoadingComponent as any) : null
  }
  DynamicMock.displayName = "DynamicMock"
  return DynamicMock
}
```

### Step 2: Register the mock via bunfig.toml preload

**File: `apps/demo/bunfig.toml`**

```toml
[test]

[test.moduleNameMapper]
# Cannot use moduleNameMapper in bunfig — use preload instead
```

Actually, Bun doesn't support `moduleNameMapper` in `bunfig.toml`. Instead, we'll use the `--preload` approach. But the cleanest Bun approach is to use the `mock.module` API in each test file or via a preload script.

**Revised approach — preload script:**

**File: `apps/demo/src/tests/setup.ts`**

```ts
import { mock } from "bun:test"
import React from "react"

// Mock next/dynamic for all test files that import page.tsx
// The real next/dynamic requires Next.js runtime context.
// Our mock renders the loading fallback (matching SSR behavior with ssr: false).
mock.module("next/dynamic", () => ({
  default: (
    _loader: () => Promise<any>,
    options?: { ssr?: boolean; loading?: () => React.ReactElement | null },
  ) => {
    function DynamicMock() {
      const Loading = options?.loading
      return Loading ? Loading() : null
    }
    DynamicMock.displayName = "DynamicMock"
    return DynamicMock
  },
}))
```

**File: `apps/demo/bunfig.toml`**

```toml
[test]
preload = ["./src/tests/setup.ts"]
```

### Step 3: Write page composition integration tests

These tests verify the full page composition: section order, dynamic section IDs, SectionSkeleton rendering, and all RSC content.

**File: `apps/demo/src/tests/landing/page-composition.test.tsx`**

```tsx
import { describe, test, expect } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Home from "../../app/page"

function renderHome(): string {
  return renderToStaticMarkup(React.createElement(Home))
}

describe("Page composition (page.tsx)", () => {
  test("renders inside a <main> element", () => {
    const html = renderHome()
    expect(html).toContain("<main")
  })

  // --- RSC sections render their content ---

  test("renders Hero section with headline", () => {
    const html = renderHome()
    expect(html).toContain("Falcon-512")
    expect(html).toContain("<h1")
  })

  test("renders Hero stats: 63K, 62, 29", () => {
    const html = renderHome()
    expect(html).toContain("63K")
    expect(html).toContain("62")
    expect(html).toContain("29")
  })

  test("renders WhyPostQuantum section", () => {
    const html = renderHome()
    expect(html).toContain("Why Post-Quantum?")
    expect(html).toContain("Quantum Threat")
  })

  test("renders PerformanceStats section", () => {
    const html = renderHome()
    expect(html).toContain("Performance Stats")
    expect(html).toContain("63,177")
  })

  test("renders Footer with links", () => {
    const html = renderHome()
    expect(html).toContain("<footer")
    expect(html).toContain("GitHub")
    expect(html).toContain("Starknet Docs")
  })

  // --- Dynamic sections render SectionSkeleton loading fallbacks ---

  test("renders Verification Playground skeleton", () => {
    const html = renderHome()
    expect(html).toContain("Verification Playground")
    expect(html).toContain("animate-pulse")
  })

  test("renders Pipeline Deep-Dive skeleton", () => {
    const html = renderHome()
    expect(html).toContain("Pipeline Deep-Dive")
  })

  test("renders Deploy Account skeleton", () => {
    const html = renderHome()
    expect(html).toContain("Deploy Account")
  })

  // --- Section ordering ---

  test("sections appear in correct order: Hero → WhyPostQuantum → PerformanceStats → interactive skeletons → Footer", () => {
    const html = renderHome()

    const heroIdx = html.indexOf("Falcon-512")
    const whyIdx = html.indexOf("Why Post-Quantum?")
    const perfIdx = html.indexOf("Performance Stats")
    const verifyIdx = html.indexOf("Verification Playground")
    const pipelineIdx = html.indexOf("Pipeline Deep-Dive")
    const footerIdx = html.indexOf("<footer")

    expect(heroIdx).toBeLessThan(whyIdx)
    expect(whyIdx).toBeLessThan(perfIdx)
    expect(perfIdx).toBeLessThan(verifyIdx)
    expect(verifyIdx).toBeLessThan(pipelineIdx)
    expect(pipelineIdx).toBeLessThan(footerIdx)
  })

  // --- No client JS from RSC sections ---

  test("renders no inline <script> tags from RSC sections", () => {
    const html = renderHome()
    expect(html).not.toContain("<script")
  })
})
```

### Step 4: Run tests to verify they fail (page.tsx not updated yet)

```bash
cd apps/demo && bun test src/tests/landing/page-composition.test.tsx
```

Expected: FAIL — Hero, Footer, SectionSkeleton content missing from Home output (page.tsx still only renders WhyPostQuantum + PerformanceStats)

### Step 5: Commit test infrastructure

```bash
jj describe -m "test(landing): add next/dynamic mock, preload setup, and page composition tests — LANDING-006"
```

---

## Task 5: Compose page.tsx with All Sections + Dynamic Imports

### Files
- Modify: `apps/demo/src/app/page.tsx`

### Step 1: Update page.tsx with full composition

**File: `apps/demo/src/app/page.tsx`**

```tsx
import dynamic from "next/dynamic"
import { Hero } from "@/components/landing/Hero"
import { WhyPostQuantum } from "@/components/landing/WhyPostQuantum"
import { PerformanceStats } from "@/components/landing/PerformanceStats"
import { Footer } from "@/components/landing/Footer"
import { SectionSkeleton } from "@/components/landing/SectionSkeleton"

const VerificationPlayground = dynamic(
  () =>
    import("@/components/interactive/VerificationPlayground").then(
      (m) => m.VerificationPlayground,
    ),
  { ssr: false, loading: () => <SectionSkeleton title="Verification Playground" /> },
)

const PipelineVisualizer = dynamic(
  () =>
    import("@/components/interactive/PipelineVisualizer").then(
      (m) => m.PipelineVisualizer,
    ),
  { ssr: false, loading: () => <SectionSkeleton title="Pipeline Deep-Dive" /> },
)

const AccountDeployFlow = dynamic(
  () =>
    import("@/components/interactive/AccountDeployFlow").then(
      (m) => m.AccountDeployFlow,
    ),
  { ssr: false, loading: () => <SectionSkeleton title="Deploy Account" /> },
)

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <WhyPostQuantum />
      <PerformanceStats />
      <VerificationPlayground />
      <PipelineVisualizer />
      <AccountDeployFlow />
      <Footer />
    </main>
  )
}
```

### Step 2: Run ALL landing tests

```bash
cd apps/demo && bun test src/tests/landing/
```

Expected: ALL tests PASS including:
- page-composition tests (new) ✓
- why-post-quantum tests (existing, `renderToStaticMarkup(<Home />)`) ✓
- performance-stats page integration tests (existing) ✓
- hero tests ✓
- footer tests ✓
- section-skeleton tests ✓

The `next/dynamic` mock from `setup.ts` preload ensures that `renderToStaticMarkup(<Home />)` works — dynamic components render their SectionSkeleton loading fallbacks.

### Step 3: Commit

```bash
jj describe -m "feat(landing): compose page.tsx with RSC sections and dynamic interactive placeholders — LANDING-006"
```

---

## Task 6: Verify Zero Client JS for RSC Sections

### Files
- No files created — verification step only

### Step 1: Run Next.js build

```bash
cd apps/demo && bun run build 2>&1
```

Look at the build output. It shows a route table like:

```
Route (app)                   Size     First Load JS
┌ ○ /                         X.XX kB  YY kB
└ ...
```

### Step 2: Verify RSC-only bundle

Check that Hero, WhyPostQuantum, PerformanceStats, Footer do NOT appear in client chunks:

```bash
# Look for client-side JS references to landing components
grep -r "Hero\|WhyPostQuantum\|PerformanceStats\|Footer" apps/demo/.next/static/chunks/ 2>/dev/null || echo "No landing components in client chunks - GOOD"
```

The RSC sections should only appear in server output (`.next/server/`), not in client chunks (`.next/static/chunks/`).

### Step 3: Verify dynamic imports have client chunks

```bash
# Interactive components should have client-side chunks
grep -rl "VerificationPlayground\|PipelineVisualizer\|AccountDeployFlow" apps/demo/.next/static/chunks/ 2>/dev/null && echo "Interactive components have client chunks - GOOD"
```

### Step 4: Record results

If the build passes and the checks confirm RSC-only sections have no client JS, the acceptance criteria is met. If any RSC component appears in client chunks, investigate whether a `"use client"` boundary was accidentally introduced.

### Step 5: Final regression

```bash
cd apps/demo && bun test
```

Expected: ALL tests pass, 0 todo, 0 fail.

### Step 6: Commit (if any fixes needed)

```bash
jj describe -m "verify(landing): confirm zero client JS for RSC sections — LANDING-006"
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `next/dynamic` mock doesn't work with Bun's `mock.module` | Bun 1.3.6 supports `mock.module` — verified in Bun docs. Fallback: use `bunfig.toml` `[test.moduleAliases]` if needed |
| Existing `why-post-quantum.test.tsx` and `performance-stats.page.integration.test.ts` break after page.tsx changes | The `setup.ts` preload mocks `next/dynamic` globally for all test files, so `renderToStaticMarkup(<Home />)` renders loading fallbacks for dynamic sections |
| `SectionSkeleton` "Deploy Account" text in skeleton collides with Footer text or CTA button text | Tests check section ordering via `indexOf` — SectionSkeleton's "Deploy Account" appears between Pipeline and Footer which is distinct from the CTA anchor text. The CTA says "Deploy Account" in a `<a>` tag while the skeleton has it in an `<h2>` |
| Next.js build fails because interactive stubs import nothing from Effect/WASM | Stubs are minimal — just `"use client"` + static JSX. No external dependencies needed |
| `bun run build` requires env vars or WASM files | Build should succeed since interactive components are code-split and don't import WASM at build time. If needed, add `NEXT_PUBLIC_STARKNET_RPC_URL=""` to `.env` |

## Acceptance Criteria Verification

| Criterion | How to verify |
|-----------|--------------|
| Page composes Hero → WhyPostQuantum → PerformanceStats → interactive skeletons → Footer | `page-composition.test.tsx` "sections appear in correct order" test |
| Interactive sections use `next/dynamic` with `ssr: false` | Source inspection of `page.tsx` — three `dynamic()` calls with `{ ssr: false }` |
| `SectionSkeleton` loading components | `section-skeleton.test.tsx` tests + page-composition tests verify skeleton titles render |
| Section IDs: `id="verify"`, `id="pipeline"`, `id="deploy"` | Interactive placeholder stubs have these IDs (rendered at runtime, not in SSR tests); SectionSkeleton skeletons render during SSR |
| Landing sections ship zero client-side JavaScript | Task 6 `bun run build` verification — RSC components not in client chunks |
| All existing tests still pass | `bun test src/tests/landing/` — 0 failures |
