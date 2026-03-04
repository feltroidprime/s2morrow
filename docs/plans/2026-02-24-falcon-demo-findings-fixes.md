# Falcon Demo Website — Findings Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all P0 bugs and P1 UX issues identified in `apps/demo/findings.md`.

**Architecture:** All changes are in the Next.js demo app (`apps/demo/`). Components use Effect atoms for state, Effect services for WASM/Starknet operations, and Tailwind v4 for styling. Tests use `bun:test` with `renderToStaticMarkup` for component tests and direct function calls for unit tests.

**Tech Stack:** Next.js 15, React 19, Effect 3.13, @effect-atom, Tailwind v4, bun test

---

## Task 1: Wire ThemeToggle into layout.tsx [BUG-05]

**Files:**
- Modify: `apps/demo/src/app/layout.tsx:12-19`
- Test: `apps/demo/src/__tests__/theme-toggle.test.tsx` (create)

**Step 1: Write the failing test**

Create `apps/demo/src/__tests__/theme-toggle.test.tsx`:

```tsx
import { describe, it, expect } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import RootLayout from "../app/layout"

describe("RootLayout", () => {
  it("includes ThemeToggle in the rendered output", () => {
    const html = renderToStaticMarkup(
      React.createElement(RootLayout, { children: React.createElement("div") }),
    )
    expect(html).toContain('data-testid="theme-toggle"')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/theme-toggle.test.tsx`
Expected: FAIL — "theme-toggle" not found in output.

**Step 3: Wire ThemeToggle into layout.tsx**

In `apps/demo/src/app/layout.tsx`, add the import and render ThemeToggle inside the body:

```tsx
import type { Metadata } from "next"
import type { ReactNode } from "react"
import { ThemeToggle } from "@/components/ThemeToggle"
import Providers from "./providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "Falcon-512 | Post-Quantum Signatures on Starknet",
  description:
    "Demo of Falcon-512 post-quantum signature verification for Starknet account abstraction. 63K steps, 62 calldata felts.",
}

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-falcon-bg text-falcon-text antialiased">
        <Providers>
          <ThemeToggle />
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

Note: `ThemeToggle` is a `"use client"` component, and we're rendering it inside `Providers` (also `"use client"`), so this is safe. The `Providers` component wraps children in a `RegistryProvider`.

**Step 4: Run test to verify it passes**

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/theme-toggle.test.tsx`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/`
Expected: All tests pass (471+ tests)

**Step 6: Commit**

```bash
git add apps/demo/src/app/layout.tsx apps/demo/src/__tests__/theme-toggle.test.tsx
git commit -m "fix(demo): wire ThemeToggle into RootLayout [BUG-05]"
```

---

## Task 2: Add falcon-secondary to globals.css @theme block [CSS-01]

**Files:**
- Modify: `apps/demo/src/app/globals.css:3-15`

**Step 1: Write the failing test**

No test needed — this is a CSS token addition. We'll verify via typecheck + build.

**Step 2: Add the missing color token**

In `apps/demo/src/app/globals.css`, add `--color-falcon-secondary` to the `@theme` block after `--color-falcon-primary`:

```css
@theme {
  /* Brand colors — shared across light/dark */
  --color-falcon-primary: #6366f1;
  --color-falcon-secondary: #8b5cf6;
  --color-falcon-accent: #06b6d4;
  --color-falcon-success: #10b981;
  --color-falcon-error: #ef4444;

  /* Dark theme defaults (applied via .dark class on <html>) */
  --color-falcon-bg: #0f172a;
  --color-falcon-surface: #1e293b;
  --color-falcon-text: #f8fafc;
  --color-falcon-muted: #94a3b8;
}
```

**Step 3: Verify build still passes**

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run build`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/demo/src/app/globals.css
git commit -m "fix(demo): add falcon-secondary color token to globals.css @theme"
```

---

## Task 3: Complete Sign & Verify pipeline with hint + packing [BUG-01]

This is the largest task. The current `handleSignAndVerify` in `VerificationPlayground.tsx` goes: sign → verify. The PRD requires: sign → create hint → pack calldata → verify → display packed data.

**Files:**
- Modify: `apps/demo/src/components/interactive/VerificationPlayground.tsx:88-137`
- Modify: `apps/demo/src/atoms/falcon.ts` (add `hintAtom`, `packedCalldataAtom`)
- Test: `apps/demo/src/__tests__/verify-playground/atoms.test.ts` (add tests for new atoms)
- Test: `apps/demo/src/__tests__/verify-playground/verification-playground.test.tsx` (add test for packed calldata display)

### Step 1: Write failing tests for new atoms

Add to the end of `apps/demo/src/__tests__/verify-playground/atoms.test.ts`:

```ts
// Import the new atoms at the top of the file:
// import { hintAtom, packedCalldataAtom } from "../../atoms/falcon"

describe("hintAtom", () => {
  it("starts as Option.none()", () => {
    const registry = Registry.make()
    const value = Registry.get(registry, hintAtom)
    expect(Option.isNone(value)).toBe(true)
  })
})

describe("packedCalldataAtom", () => {
  it("starts as Option.none()", () => {
    const registry = Registry.make()
    const value = Registry.get(registry, packedCalldataAtom)
    expect(Option.isNone(value)).toBe(true)
  })
})
```

### Step 2: Run test to verify it fails

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/verify-playground/atoms.test.ts`
Expected: FAIL — `hintAtom` and `packedCalldataAtom` not exported.

### Step 3: Add the new atoms

In `apps/demo/src/atoms/falcon.ts`, add after the `messageAtom`:

```ts
export const hintAtom = Atom.make<Option.Option<Uint16Array>>(Option.none())

export const packedCalldataAtom = Atom.make<Option.Option<ReadonlyArray<string>>>(Option.none())
```

### Step 4: Run atom tests to verify they pass

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/verify-playground/atoms.test.ts`
Expected: PASS

### Step 5: Write failing test for packed calldata display

Add to `apps/demo/src/__tests__/verify-playground/verification-playground.test.tsx`:

```tsx
// Import packedCalldataAtom at the top:
// import { packedCalldataAtom } from "../../atoms/falcon"

it("renders packed calldata display when complete with packed data", () => {
  const html = renderPlayground({
    message: "test",
    keypair: Option.some(mockKeypair),
    step: { step: "complete", valid: true, durationMs: 42 },
    packedCalldata: Option.some(["0xabc", "0xdef"]),
  })

  expect(html).toContain("Packed Calldata")
  expect(html).toContain("0xabc")
})
```

The `renderPlayground` helper needs a new optional `packedCalldata` param:

```tsx
function renderPlayground(options?: {
  readonly message?: string
  readonly keypair?: Option.Option<FalconKeypair>
  readonly step?: VerificationStep
  readonly packedCalldata?: Option.Option<ReadonlyArray<string>>
}): string {
  const message = options?.message ?? ""
  const keypair = options?.keypair ?? Option.none()
  const step = options?.step ?? { step: "idle" }
  const packedCalldata = options?.packedCalldata ?? Option.none()

  return renderToStaticMarkup(
    React.createElement(
      RegistryProvider,
      {
        initialValues: [
          [messageAtom, message],
          [keypairAtom, keypair],
          [verificationStepAtom, step],
          [packedCalldataAtom, packedCalldata],
        ],
      },
      React.createElement(VerificationPlayground),
    ),
  )
}
```

### Step 6: Run test to verify it fails

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/verify-playground/verification-playground.test.tsx`
Expected: FAIL — "Packed Calldata" not in output.

### Step 7: Update VerificationPlayground.tsx with full pipeline

Replace the `handleSignAndVerify` callback and add UI elements. The key changes:

**7a. Add imports and atom reads/writes for new atoms:**

At top of `VerificationPlayground.tsx`, add to imports from `@/atoms/falcon`:
```ts
import {
  keypairAtom,
  messageAtom,
  signatureAtom,
  verificationStepAtom,
  wasmStatusAtom,
  hintAtom,
  packedCalldataAtom,
} from "@/atoms/falcon"
```

Add to imports from `./accountDeployPipeline`:
```ts
import { toUint16PublicKeyNtt } from "./accountDeployPipeline"
```

In the component body, add atom reads/writes:
```ts
const packedCalldata = useAtomValue(packedCalldataAtom)
const setHint = useAtomSet(hintAtom)
const setPackedCalldata = useAtomSet(packedCalldataAtom)
```

**7b. Replace handleSignAndVerify with the full pipeline:**

```ts
const handleSignAndVerify = useCallback(async () => {
  const kp = Option.match(keypair, {
    onNone: () => null,
    onSome: (k) => k,
  })
  if (!kp) return

  const startTime = Date.now()
  const messageBytes = new TextEncoder().encode(message)

  // ── Sign ────────────────────────────────────────────────────────────
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

  // ── Create Hint ─────────────────────────────────────────────────────
  setStep({ step: "creating-hint" })
  const hintExit = await appRuntime.runPromiseExit(
    FalconService.createHint(
      new Int32Array(sigResult.signature),
      kp.publicKeyNtt,
    ),
  )

  if (Exit.isFailure(hintExit)) {
    const errOpt = Cause.failureOption(hintExit.cause)
    const msg = Option.match(errOpt, {
      onNone: () => "Hint generation failed",
      onSome: (e) => e.message,
    })
    setStep({ step: "error", message: msg })
    return
  }

  setHint(Option.some(hintExit.value))

  // ── Pack Calldata ───────────────────────────────────────────────────
  setStep({ step: "packing" })
  const uint16Exit = await appRuntime.runPromiseExit(
    toUint16PublicKeyNtt(kp.publicKeyNtt),
  )

  if (Exit.isFailure(uint16Exit)) {
    setStep({ step: "error", message: "Failed to convert public key" })
    return
  }

  const packExit = await appRuntime.runPromiseExit(
    FalconService.packPublicKey(uint16Exit.value),
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

  setPackedCalldata(Option.some(packExit.value.slots))

  // ── Verify ──────────────────────────────────────────────────────────
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
}, [keypair, message, setSignature, setStep, setHint, setPackedCalldata])
```

**7c. Add UI for signature preview and packed calldata display:**

After the keypair hex preview section (`{keypairHexPreview !== null && ...}`), add:

```tsx
{/* Signature preview */}
{Option.isSome(signatureAtom_value) && (
  <HexDisplay
    label="Signature (preview)"
    value={"0x" + bytesToHex(Option.getOrThrow(signatureAtom_value).signature)}
    truncate={{ head: 18, tail: 8 }}
  />
)}

{/* Packed calldata (29 felt252 slots) */}
{Option.isSome(packedCalldata) && (
  <HexDisplay
    label="Packed Calldata (29 felt252 slots)"
    value={Option.getOrThrow(packedCalldata) as string[]}
    maxRows={5}
    truncate={{ head: 18, tail: 8 }}
  />
)}
```

For the signature display, read the signature atom:
```ts
const signatureValue = useAtomValue(signatureAtom)
```

And derive the display:
```ts
const signatureHexPreview = Option.match(signatureValue, {
  onNone: () => null,
  onSome: (sig) => "0x" + bytesToHex(sig.signature),
})
```

Then render:
```tsx
{signatureHexPreview !== null && (
  <HexDisplay
    label="Signature (preview)"
    value={signatureHexPreview}
    truncate={{ head: 18, tail: 8 }}
  />
)}

{Option.isSome(packedCalldata) && (
  <HexDisplay
    label={`Packed Calldata (${Option.getOrThrow(packedCalldata).length} felt252 slots)`}
    value={Array.from(Option.getOrThrow(packedCalldata))}
    maxRows={5}
    truncate={{ head: 18, tail: 8 }}
  />
)}
```

**7d. Update the button text to reflect multi-step pipeline:**

Change the Sign & Verify button text logic:

```tsx
{step.step === "signing"
  ? "Signing..."
  : step.step === "creating-hint"
    ? "Creating hint..."
    : step.step === "packing"
      ? "Packing..."
      : step.step === "verifying"
        ? "Verifying..."
        : "Sign & Verify"}
```

### Step 8: Run tests to verify they pass

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/verify-playground/`
Expected: PASS

### Step 9: Run typecheck

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck`
Expected: PASS (clean)

### Step 10: Commit

```bash
git add apps/demo/src/atoms/falcon.ts \
  apps/demo/src/components/interactive/VerificationPlayground.tsx \
  apps/demo/src/__tests__/verify-playground/atoms.test.ts \
  apps/demo/src/__tests__/verify-playground/verification-playground.test.tsx
git commit -m "feat(demo): complete Sign & Verify pipeline with hint + packing [BUG-01]

Add hint generation and calldata packing steps to the verification flow.
Display signature preview and packed calldata (29 felt252 slots) in HexDisplay."
```

---

## Task 4: Fix computing-address state immediately overwritten [BUG-04]

**Files:**
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx:80-81`

### Step 1: Write the failing test

No separate test needed — the fix is removing a dead `setDeployStep` call. Existing tests still pass.

### Step 2: Fix the immediate overwrite

In `AccountDeployFlow.tsx`, lines 80-81 currently are:

```ts
setDeployStep({ step: "computing-address" })
setDeployStep({ step: "awaiting-funds", address: prepared.address })
```

Remove the `computing-address` line since it's immediately overwritten and never visible:

```ts
setDeployStep({ step: "awaiting-funds", address: prepared.address })
```

### Step 3: Run existing tests

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/account-deploy/`
Expected: PASS

### Step 4: Commit

```bash
git add apps/demo/src/components/interactive/AccountDeployFlow.tsx
git commit -m "fix(demo): remove immediately-overwritten computing-address state [BUG-04]"
```

---

## Task 5: Add interim notice for placeholder class hash [BUG-02]

**Files:**
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`

### Step 1: Write the failing test

Add to `apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx`:

```tsx
it("shows a notice that deploy is not yet available when idle", () => {
  // Render with idle state and check for notice
  const html = renderDeploy({ step: { step: "idle" } })
  expect(html).toContain("not yet available")
})
```

(Adapt to the existing render helper pattern in that file.)

### Step 2: Run test to verify it fails

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx`
Expected: FAIL

### Step 3: Add the notice banner

In `AccountDeployFlow.tsx`, after the section description (`<p className="mt-4 text-falcon-muted">...`), add:

```tsx
<div className="mt-4 rounded-lg border border-falcon-accent/30 bg-falcon-accent/5 p-3">
  <p className="text-sm text-falcon-accent">
    Deploy is not yet available — the Falcon account contract has not been declared on Starknet mainnet.
  </p>
</div>
```

### Step 4: Run test to verify it passes

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add apps/demo/src/components/interactive/AccountDeployFlow.tsx \
  apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx
git commit -m "fix(demo): add notice that deploy is not yet available [BUG-02]"
```

---

## Task 6: Mask private key input with reveal toggle [UX-14, SEC-01]

**Files:**
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx:262-268`
- Test: `apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx`

### Step 1: Write the failing test

Add to the deploy view test file:

```tsx
it("renders private key input as password type by default", () => {
  const html = renderDeploy({ step: { step: "idle" } })
  expect(html).toContain('type="password"')
})
```

### Step 2: Run test to verify it fails

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx`
Expected: FAIL — currently `type="text"` (or no explicit type).

### Step 3: Add password input with reveal toggle

In `AccountDeployFlow.tsx`, add `showKey` state:

```ts
const [showKey, setShowKey] = useState(false)
```

Replace the private key input with:

```tsx
<div className="relative">
  <input
    id="deploy-private-key"
    type={showKey ? "text" : "password"}
    value={privateKey}
    onChange={(event) => setPrivateKey(event.target.value)}
    placeholder="0x..."
    className="w-full rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 pr-16 font-mono text-sm text-falcon-text placeholder-falcon-muted focus:outline-none focus:ring-2 focus:ring-falcon-primary"
  />
  <button
    type="button"
    onClick={() => setShowKey((prev) => !prev)}
    aria-label={showKey ? "Hide private key" : "Show private key"}
    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-falcon-muted hover:text-falcon-text"
  >
    {showKey ? "Hide" : "Show"}
  </button>
</div>
```

### Step 4: Run test to verify it passes

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add apps/demo/src/components/interactive/AccountDeployFlow.tsx \
  apps/demo/src/__tests__/account-deploy/account-deploy-view.test.tsx
git commit -m "fix(demo): mask private key input with reveal toggle [UX-14, SEC-01]"
```

---

## Task 7: Add copy-to-clipboard on HexDisplay [UX-10]

**Files:**
- Modify: `apps/demo/src/components/interactive/HexDisplay.tsx`
- Test: `apps/demo/src/__tests__/verify-playground/hex-display.test.tsx`

### Step 1: Write the failing test

Add to `hex-display.test.tsx`:

```tsx
describe("HexDisplay — copy button", () => {
  it("renders a copy button with aria-label", () => {
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, {
        label: "Key",
        value: "0xdeadbeef",
      }),
    )
    expect(html).toContain('aria-label="Copy to clipboard"')
  })
})
```

### Step 2: Run test to verify it fails

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/verify-playground/hex-display.test.tsx`
Expected: FAIL

### Step 3: Add copy button to HexDisplay

In `HexDisplay.tsx`, add a copy button. For the single-string variant, add a button next to the code element. For array mode, add a single copy button that copies all values joined by newlines.

Update the component to add a copy button in a flex container:

```tsx
"use client"

import React, { useCallback, useState } from "react"
import { truncateHex } from "./verification-utils"

// ... keep existing HexDisplayProps ...

export function HexDisplay(props: HexDisplayProps): React.JSX.Element {
  const { label, value, maxRows, truncate } = props
  const [copied, setCopied] = useState(false)

  const rawText = typeof value === "string" ? value : Array.from(value).join("\n")

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(rawText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [rawText])

  const display = (v: string): string =>
    truncate ? truncateHex(v, truncate.head, truncate.tail) : v

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      className="ml-auto shrink-0 rounded px-2 py-0.5 text-xs text-falcon-muted hover:text-falcon-text transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  )

  if (typeof value === "string") {
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className="block text-sm font-medium text-falcon-muted">
            {label}
          </span>
          {copyButton}
        </div>
        <code className="mt-1 block break-all font-mono text-sm text-falcon-accent">
          {display(value)}
        </code>
      </div>
    )
  }

  // ... array rendering with copyButton in header ...
}
```

Note: `HexDisplay` must become `"use client"` since it now uses `useState` and `useCallback`. It's already only used inside client-component wrappers (`VerificationPlayground`, `AccountDeployFlow`), so this is safe.

### Step 4: Run test to verify it passes

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/verify-playground/hex-display.test.tsx`
Expected: PASS

### Step 5: Run full test suite

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/`
Expected: All pass

### Step 6: Commit

```bash
git add apps/demo/src/components/interactive/HexDisplay.tsx \
  apps/demo/src/__tests__/verify-playground/hex-display.test.tsx
git commit -m "feat(demo): add copy-to-clipboard button on HexDisplay [UX-10]"
```

---

## Task 8: Add progress indicator to Pipeline Visualizer [UX-11]

**Files:**
- Modify: `apps/demo/src/components/interactive/PipelineVisualizer.tsx:139-151`

### Step 1: Write the failing test

Create `apps/demo/src/__tests__/pipeline-visualizer.test.tsx`:

```tsx
import { describe, it, expect } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { RegistryProvider } from "@effect-atom/atom-react"
import { pipelineStepsAtom, INITIAL_PIPELINE_STEPS } from "../../atoms/pipeline"
import { PipelineVisualizer } from "../../components/interactive/PipelineVisualizer"
import type { PipelineStep } from "../../services/types"

function renderPipeline(stepsOverride?: PipelineStep[]): string {
  const steps = stepsOverride ?? INITIAL_PIPELINE_STEPS
  return renderToStaticMarkup(
    React.createElement(
      RegistryProvider,
      {
        initialValues: [[pipelineStepsAtom, steps]],
      },
      React.createElement(PipelineVisualizer),
    ),
  )
}

describe("PipelineVisualizer", () => {
  it("shows progress indicator with 0/6 initially", () => {
    const html = renderPipeline()
    expect(html).toContain("0/6")
  })

  it("shows progress when some steps are complete", () => {
    const steps = INITIAL_PIPELINE_STEPS.map((s, i) =>
      i < 3 ? { ...s, status: "complete" as const } : s,
    )
    const html = renderPipeline(steps)
    expect(html).toContain("3/6")
  })
})
```

### Step 2: Run test to verify it fails

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/pipeline-visualizer.test.tsx`
Expected: FAIL — "0/6" not found

### Step 3: Add progress indicator

In `PipelineVisualizer.tsx`, add a progress counter. Compute completed count:

```ts
const completedCount = steps.filter((s) => s.status === "complete").length
```

Add between the controls section and the pipeline step cards:

```tsx
{/* Progress indicator */}
<div className="mt-4 flex items-center gap-3">
  <div className="h-1.5 flex-1 rounded-full bg-falcon-muted/20">
    <div
      className="h-1.5 rounded-full bg-falcon-primary transition-all"
      style={{ width: `${(completedCount / steps.length) * 100}%` }}
    />
  </div>
  <span className="text-sm font-medium text-falcon-muted">
    {completedCount}/{steps.length} complete
  </span>
</div>
```

### Step 4: Run test to verify it passes

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/pipeline-visualizer.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add apps/demo/src/components/interactive/PipelineVisualizer.tsx \
  apps/demo/src/__tests__/pipeline-visualizer.test.tsx
git commit -m "feat(demo): add progress indicator to Pipeline Visualizer [UX-11]"
```

---

## Task 9: Add navigation header [UX-02, A11Y-02]

**Files:**
- Create: `apps/demo/src/components/landing/Header.tsx`
- Modify: `apps/demo/src/app/page.tsx:9-20`
- Test: `apps/demo/src/__tests__/header.test.tsx`

### Step 1: Write the failing test

Create `apps/demo/src/__tests__/header.test.tsx`:

```tsx
import { describe, it, expect } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Header } from "../components/landing/Header"

describe("Header", () => {
  it("renders a nav element with aria-label", () => {
    const html = renderToStaticMarkup(React.createElement(Header))
    expect(html).toContain("<nav")
    expect(html).toContain('aria-label="Main navigation"')
  })

  it("renders anchor links to all major sections", () => {
    const html = renderToStaticMarkup(React.createElement(Header))
    expect(html).toContain('href="#verify"')
    expect(html).toContain('href="#pipeline"')
    expect(html).toContain('href="#deploy"')
  })

  it("includes the Falcon-512 brand name", () => {
    const html = renderToStaticMarkup(React.createElement(Header))
    expect(html).toContain("Falcon-512")
  })
})
```

### Step 2: Run test to verify it fails

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/header.test.tsx`
Expected: FAIL — module not found

### Step 3: Create the Header component

Create `apps/demo/src/components/landing/Header.tsx`:

```tsx
const NAV_LINKS = [
  { href: "#verify", label: "Verify" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#deploy", label: "Deploy" },
] as const

export function Header(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-falcon-muted/10 bg-falcon-bg/80 backdrop-blur-sm">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3"
      >
        <a href="#hero" className="font-mono text-sm font-bold text-falcon-accent">
          Falcon-512
        </a>
        <ul className="flex gap-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-falcon-muted transition-colors hover:text-falcon-text"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
```

### Step 4: Run test to verify it passes

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/header.test.tsx`
Expected: PASS

### Step 5: Wire Header into page.tsx

In `apps/demo/src/app/page.tsx`, add the import and render before `<Hero />`:

```tsx
import { Header } from "@/components/landing/Header"
```

```tsx
export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <WhyPostQuantum />
      <PerformanceStats />
      <PlaygroundSection />
      <PipelineSection />
      <AccountDeploySection />
      <Footer />
    </main>
  )
}
```

### Step 6: Run full test suite + typecheck

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck && bun test`
Expected: PASS

### Step 7: Commit

```bash
git add apps/demo/src/components/landing/Header.tsx \
  apps/demo/src/app/page.tsx \
  apps/demo/src/__tests__/header.test.tsx
git commit -m "feat(demo): add sticky navigation header with section links [UX-02, A11Y-02]"
```

---

## Task 10: Add skip-to-content link [A11Y-01]

**Files:**
- Modify: `apps/demo/src/app/layout.tsx`
- Test: `apps/demo/src/__tests__/theme-toggle.test.tsx` (extend the layout test)

### Step 1: Write the failing test

Add to `apps/demo/src/__tests__/theme-toggle.test.tsx` (rename file to `layout.test.tsx` if desired):

```tsx
it("includes a skip-to-content link for keyboard navigation", () => {
  const html = renderToStaticMarkup(
    React.createElement(RootLayout, {
      children: React.createElement("div"),
    }),
  )
  expect(html).toContain("Skip to content")
  expect(html).toContain('href="#verify"')
})
```

### Step 2: Run test to verify it fails

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/theme-toggle.test.tsx`
Expected: FAIL

### Step 3: Add skip-to-content link

In `layout.tsx`, add as the first child inside `<body>`:

```tsx
<a
  href="#verify"
  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-falcon-primary focus:px-4 focus:py-2 focus:text-falcon-text"
>
  Skip to content
</a>
```

### Step 4: Run test to verify it passes

Run: `cd /home/felt/PycharmProjects/s2morrow && bun test apps/demo/src/__tests__/theme-toggle.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add apps/demo/src/app/layout.tsx apps/demo/src/__tests__/theme-toggle.test.tsx
git commit -m "feat(demo): add skip-to-content link for keyboard navigation [A11Y-01]"
```

---

## Task 11: Final verification

### Step 1: Run full test suite

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test`
Expected: All tests pass (480+ tests)

### Step 2: Run typecheck

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck`
Expected: Clean

### Step 3: Run production build

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run build`
Expected: PASS

---

## Summary of What's Fixed

| Finding | Status | Task |
|---------|--------|------|
| BUG-05: ThemeToggle not wired | FIXED | Task 1 |
| CSS: falcon-secondary missing | FIXED | Task 2 |
| BUG-01: Incomplete Sign & Verify pipeline | FIXED | Task 3 |
| BUG-04: computing-address overwritten | FIXED | Task 4 |
| BUG-02: Placeholder class hash (interim notice) | FIXED | Task 5 |
| UX-14/SEC-01: Private key visible | FIXED | Task 6 |
| UX-10: No copy-to-clipboard | FIXED | Task 7 |
| UX-11: No progress indicator | FIXED | Task 8 |
| UX-02/A11Y-02: No navigation header | FIXED | Task 9 |
| A11Y-01: No skip-to-content | FIXED | Task 10 |

## What's NOT in this plan (deferred)

| Finding | Reason |
|---------|--------|
| BUG-03: Balance polling loop | Blocked on class hash — polling a placeholder address is meaningless |
| UX-15: Step 6 sign test tx | Blocked on deployed contract |
| UX-13: Pipeline connected to WASM | 3-4 hour effort, cosmetic only |
| UX-04: Icons on cards | Design decision needed |
| UX-05: USD cost estimates | Requires external data source |
| UX-09: Textarea for message | Minor UX preference |
