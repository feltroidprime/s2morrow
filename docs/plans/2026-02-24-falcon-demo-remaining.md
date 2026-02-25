# Falcon Demo Website — Remaining Work

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the 3 remaining gaps between the current codebase and the PRD: 2 missing WASM bindings in falcon-rs, the Pipeline Visualizer component, and final build verification.

**Architecture:** The demo app (`apps/demo/`) is fully scaffolded with Effect services, atoms, landing sections, verification playground, and account deploy flow. The falcon-rs crate (`../falcon-rs/`) has all core crypto implemented but is missing 2 WASM export wrappers. The Pipeline Visualizer has atom state defined but no UI component.

**Tech Stack:** Rust + wasm-bindgen (WASM bindings), React 19 + Next.js 15 (Pipeline Visualizer), Effect Atoms (state), Tailwind CSS v4 (styling)

---

## Gap Analysis

| Area | Status | What's Missing |
|------|--------|---------------|
| WASM bindings | 5/7 done | `create_verification_hint()`, `pack_public_key_wasm()` wrappers in wasm.rs |
| Effect services | Complete | All 3 services + 9 error types + 70 tests |
| Atom state | Complete | falcon, pipeline, starknet atoms all defined |
| Landing sections | Complete | Hero, WhyPostQuantum, PerformanceStats, Footer |
| Verification Playground | Complete | Keygen, sign & verify, hex display, error states |
| Pipeline Visualizer | **Missing** | Atoms exist, no component, not in page.tsx |
| Account Deploy Flow | Complete | 5-step wizard with Starkscan links |
| Styling/Theme | Complete | Dark/light toggle, all color tokens |
| Build | Untested | Need to verify `bun run build` succeeds |

---

### Task 1: Add `create_verification_hint` WASM Binding

**Files:**
- Modify: `/home/felt/PycharmProjects/falcon-rs/src/wasm.rs` (after line 137, before tests)

**Context:** The core Rust function already exists at `falcon-rs/src/hints.rs:10`:
```rust
pub fn generate_mul_hint(s1: &[u16], pk_h_ntt: &[u16]) -> Vec<u16>
```
The WASM binding wraps this, accepting `Int32Array` (matches FalconService.createHint signature) and returning `Uint16Array`.

**Step 1: Add the WASM binding**

Add this to `wasm.rs` after the `salt_length()` function (line 137), before the `#[cfg(test)]` block:

```rust
use crate::hints::generate_mul_hint;

/// Create a verification hint for Cairo on-chain verification.
///
/// Computes `INTT(NTT(s1) * pk_ntt)` — the mul_hint that allows
/// Cairo to verify NTT products with 2 forward NTTs and 0 INTTs.
///
/// Parameters:
/// - `s1`: Int32Array of 512 signature coefficients (each in [0, 12289))
/// - `pk_ntt`: Int32Array of 512 public key NTT coefficients (each in [0, 12289))
///
/// Returns: Uint16Array of 512 hint coefficients.
#[wasm_bindgen]
pub fn create_verification_hint(s1: &[i32], pk_ntt: &[i32]) -> Result<Vec<u16>, JsError> {
    if s1.len() != 512 {
        return Err(JsError::new(&format!(
            "Invalid s1 length: expected 512, got {}",
            s1.len()
        )));
    }
    if pk_ntt.len() != 512 {
        return Err(JsError::new(&format!(
            "Invalid pk_ntt length: expected 512, got {}",
            pk_ntt.len()
        )));
    }

    let s1_u16: Vec<u16> = s1.iter().map(|&v| v as u16).collect();
    let pk_u16: Vec<u16> = pk_ntt.iter().map(|&v| v as u16).collect();

    Ok(generate_mul_hint(&s1_u16, &pk_u16))
}
```

**Step 2: Add the import**

The `use crate::hints::generate_mul_hint;` import goes at the top of `wasm.rs` with the other imports (after line 12).

**Step 3: Verify it compiles**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo check --features wasm`
Expected: compiles with no errors

**Step 4: Add wasm-bindgen test**

Add to the `wasm_tests` module at the bottom of `wasm.rs`:

```rust
#[wasm_bindgen_test]
fn wasm_create_verification_hint_rejects_wrong_length() {
    let short = vec![0i32; 10];
    let correct = vec![0i32; 512];
    assert!(create_verification_hint(&short, &correct).is_err());
    assert!(create_verification_hint(&correct, &short).is_err());
}
```

**Step 5: Run tests**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test --features wasm -- wasm_create`
Expected: PASS

**Step 6: Commit**

```bash
git add src/wasm.rs
git commit -m "feat(wasm): add create_verification_hint binding"
```

---

### Task 2: Add `pack_public_key_wasm` WASM Binding

**Files:**
- Modify: `/home/felt/PycharmProjects/falcon-rs/src/wasm.rs`

**Context:** The core Rust function exists at `falcon-rs/src/packing.rs:27`:
```rust
pub fn pack_public_key(h_ntt: &[u16]) -> Vec<Felt>
```
The WASM binding wraps this, accepting `Uint16Array` and returning an array of hex strings (each string is a felt252). This matches the JS API that `FalconService.packPublicKey` already expects.

**Step 1: Add the WASM binding**

Add this to `wasm.rs` after the `create_verification_hint` function:

```rust
use crate::packing::pack_public_key;

/// Pack a public key (512 Zq values) into 29 felt252 storage slots.
///
/// Uses base-Q Horner encoding: 18 values per felt252 (9 per u128 half).
/// This achieves a 17× calldata reduction (512 → 29 slots).
///
/// Parameters:
/// - `pk_ntt`: Uint16Array of 512 public key NTT coefficients (each in [0, 12289))
///
/// Returns: Array of 29 hex strings, each representing a felt252.
#[wasm_bindgen]
pub fn pack_public_key_wasm(pk_ntt: &[u16]) -> Result<Vec<String>, JsError> {
    if pk_ntt.len() != 512 {
        return Err(JsError::new(&format!(
            "Invalid pk_ntt length: expected 512, got {}",
            pk_ntt.len()
        )));
    }

    let packed = pack_public_key(pk_ntt);
    Ok(packed
        .iter()
        .map(|f| format!("0x{}", f.to_hex()))
        .collect())
}
```

**Step 2: Add the import**

Add `use crate::packing::pack_public_key;` with the other imports at the top of `wasm.rs`.

**Step 3: Check if `Felt::to_hex()` exists**

The `lambdaworks_math::field::element::FieldElement` type is used as `Felt`. Check the available formatting methods. If `to_hex()` doesn't exist, use:
```rust
// Alternative: use the Display/Debug trait or manual conversion
format!("0x{:064x}", f.representative())
```

Verify: `cd /home/felt/PycharmProjects/falcon-rs && cargo check --features wasm`

**Step 4: Add wasm-bindgen test**

```rust
#[wasm_bindgen_test]
fn wasm_pack_public_key_rejects_wrong_length() {
    let short = vec![0u16; 10];
    assert!(pack_public_key_wasm(&short).is_err());
}

#[wasm_bindgen_test]
fn wasm_pack_public_key_returns_29_slots() {
    let pk = vec![0u16; 512];
    let result = pack_public_key_wasm(&pk).expect("packing zeros must succeed");
    assert_eq!(result.len(), 29, "must produce exactly 29 felt252 slots");
    for slot in &result {
        assert!(slot.starts_with("0x"), "each slot must be 0x-prefixed hex");
    }
}
```

**Step 5: Run tests**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test --features wasm -- wasm_pack`
Expected: PASS

**Step 6: Commit**

```bash
git add src/wasm.rs
git commit -m "feat(wasm): add pack_public_key_wasm binding"
```

---

### Task 3: Rebuild WASM and Update Demo App

**Files:**
- Overwrite: `apps/demo/public/wasm/falcon_rs.js`
- Overwrite: `apps/demo/public/wasm/falcon_rs_bg.wasm`

**Step 1: Build WASM**

Run: `cd /home/felt/PycharmProjects/falcon-rs && wasm-pack build --target web --features wasm`
Expected: Creates `pkg/` directory with `falcon_rs.js`, `falcon_rs_bg.wasm`, etc.

**Step 2: Copy artifacts to demo app**

```bash
cp /home/felt/PycharmProjects/falcon-rs/pkg/falcon_rs.js /home/felt/PycharmProjects/s2morrow/apps/demo/public/wasm/falcon_rs.js
cp /home/felt/PycharmProjects/falcon-rs/pkg/falcon_rs_bg.wasm /home/felt/PycharmProjects/s2morrow/apps/demo/public/wasm/falcon_rs_bg.wasm
```

**Step 3: Verify the JS glue exports the new functions**

Run: `grep -c 'create_verification_hint\|pack_public_key_wasm' apps/demo/public/wasm/falcon_rs.js`
Expected: At least 2 matches (one export per function)

**Step 4: Commit**

```bash
git add apps/demo/public/wasm/
git commit -m "build(wasm): rebuild with hint + packing bindings"
```

---

### Task 4: Build Pipeline Visualizer Component

**Files:**
- Create: `apps/demo/src/components/interactive/PipelineVisualizer.tsx`
- Create: `apps/demo/src/components/interactive/PipelineSection.tsx`

**Context:** The atom state is fully defined in `atoms/pipeline.ts`:
- `pipelineStepsAtom`: `PipelineStep[]` (6 steps with id, name, description, input, output, stepCount, status)
- `pipelineActiveStepAtom`: `number` (-1 = idle)
- `pipelinePlayingAtom`: `boolean`

The component follows the same patterns as `VerificationPlayground.tsx`:
- `"use client"` directive
- `useAtomValue` / `useAtomSet` from `@effect-atom/atom-react`
- Tailwind classes using `falcon-*` color tokens
- No `useState` — all state in atoms

**Step 1: Create PipelineSection.tsx (dynamic import wrapper)**

```tsx
"use client"

import dynamic from "next/dynamic"

const PipelineVisualizer = dynamic(
  () =>
    import("./PipelineVisualizer").then((mod) => ({
      default: mod.PipelineVisualizer,
    })),
  {
    ssr: false,
    loading: () => (
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-falcon-surface" />
          <div className="h-4 w-96 rounded bg-falcon-surface" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-32 rounded-xl bg-falcon-surface" />
            ))}
          </div>
        </div>
      </section>
    ),
  },
)

export function PipelineSection(): React.JSX.Element {
  return <PipelineVisualizer />
}
```

**Step 2: Create PipelineVisualizer.tsx**

```tsx
"use client"

import React, { useCallback, useEffect, useRef } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import {
  pipelineStepsAtom,
  pipelineActiveStepAtom,
  pipelinePlayingAtom,
  INITIAL_PIPELINE_STEPS,
} from "@/atoms/pipeline"
import type { PipelineStep } from "@/services/types"

const TOTAL_STEPS = INITIAL_PIPELINE_STEPS.reduce(
  (sum, s) => sum + s.stepCount,
  0,
)

export function PipelineVisualizer(): React.JSX.Element {
  const steps = useAtomValue(pipelineStepsAtom)
  const activeStep = useAtomValue(pipelineActiveStepAtom)
  const playing = useAtomValue(pipelinePlayingAtom)

  const setSteps = useAtomSet(pipelineStepsAtom)
  const setActiveStep = useAtomSet(pipelineActiveStepAtom)
  const setPlaying = useAtomSet(pipelinePlayingAtom)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Auto-advance logic ──────────────────────────────────────────────
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setActiveStep((prev) => {
        const next = prev + 1
        if (next >= steps.length) {
          setPlaying(false)
          // Mark last step complete
          setSteps((s) =>
            s.map((step, i) =>
              i === prev ? { ...step, status: "complete" as const } : step,
            ),
          )
          return prev
        }
        // Complete current, activate next
        setSteps((s) =>
          s.map((step, i) => {
            if (i === prev) return { ...step, status: "complete" as const }
            if (i === next) return { ...step, status: "active" as const }
            return step
          }),
        )
        return next
      })
    }, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playing, steps.length, setActiveStep, setSteps, setPlaying])

  // ── Handlers ────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (activeStep === -1) {
      // Start from beginning
      setSteps((s) =>
        s.map((step, i) =>
          i === 0
            ? { ...step, status: "active" as const }
            : { ...step, status: "pending" as const },
        ),
      )
      setActiveStep(0)
    }
    setPlaying(true)
  }, [activeStep, setSteps, setActiveStep, setPlaying])

  const handlePause = useCallback(() => {
    setPlaying(false)
  }, [setPlaying])

  const handleStep = useCallback(() => {
    setPlaying(false)
    setActiveStep((prev) => {
      const next = prev + 1
      if (next >= steps.length) {
        // Complete last step
        setSteps((s) =>
          s.map((step, i) =>
            i === prev ? { ...step, status: "complete" as const } : step,
          ),
        )
        return prev
      }
      if (prev === -1) {
        // First step
        setSteps((s) =>
          s.map((step, i) =>
            i === 0
              ? { ...step, status: "active" as const }
              : { ...step, status: "pending" as const },
          ),
        )
        return 0
      }
      // Advance
      setSteps((s) =>
        s.map((step, i) => {
          if (i === prev) return { ...step, status: "complete" as const }
          if (i === next) return { ...step, status: "active" as const }
          return step
        }),
      )
      return next
    })
  }, [steps.length, setActiveStep, setSteps, setPlaying])

  const handleReset = useCallback(() => {
    setPlaying(false)
    setActiveStep(-1)
    setSteps(INITIAL_PIPELINE_STEPS)
  }, [setPlaying, setActiveStep, setSteps])

  const allComplete = steps.every((s) => s.status === "complete")

  return (
    <section id="pipeline" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-falcon-text">
              Verification Pipeline
            </h2>
            <p className="mt-2 text-falcon-muted">
              Step-through of the 6-stage Falcon-512 on-chain verification
            </p>
          </div>
          <span className="font-mono text-sm text-falcon-accent">
            ~{TOTAL_STEPS.toLocaleString()} total steps
          </span>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap gap-3">
          {!playing ? (
            <button
              onClick={handlePlay}
              disabled={allComplete}
              aria-label="Play pipeline animation"
              className="rounded-lg bg-falcon-primary px-4 py-2 text-sm font-semibold text-falcon-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Play
            </button>
          ) : (
            <button
              onClick={handlePause}
              aria-label="Pause pipeline animation"
              className="rounded-lg bg-falcon-primary px-4 py-2 text-sm font-semibold text-falcon-text transition-opacity hover:opacity-90"
            >
              Pause
            </button>
          )}
          <button
            onClick={handleStep}
            disabled={playing || allComplete}
            aria-label="Advance one pipeline step"
            className="rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 text-sm font-medium text-falcon-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Step
          </button>
          <button
            onClick={handleReset}
            aria-label="Reset pipeline to beginning"
            className="rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 text-sm font-medium text-falcon-text transition-opacity hover:opacity-90"
          >
            Reset
          </button>
        </div>

        {/* Pipeline step cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <PipelineStepCard key={step.id} step={step} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function PipelineStepCard({ step }: { step: PipelineStep }): React.JSX.Element {
  const isActive = step.status === "active"
  const isComplete = step.status === "complete"

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        isActive
          ? "border-falcon-primary/50 bg-falcon-primary/10 ring-2 ring-falcon-primary/30"
          : isComplete
            ? "border-falcon-success/30 bg-falcon-surface"
            : "border-falcon-muted/20 bg-falcon-surface"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="text-base">
          {isComplete ? (
            <span className="text-falcon-success">&#10003;</span>
          ) : isActive ? (
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-falcon-primary" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-falcon-muted/40" />
          )}
        </span>
        <h3 className="font-mono text-sm font-semibold text-falcon-text">
          {step.name}
        </h3>
        <span className="ml-auto font-mono text-xs text-falcon-muted">
          ~{step.stepCount.toLocaleString()}
        </span>
      </div>

      {/* Description */}
      <p className="mt-2 text-xs text-falcon-muted">{step.description}</p>

      {/* Expanded details for active step */}
      {isActive && (
        <div className="mt-3 space-y-1 border-t border-falcon-muted/20 pt-3">
          <div className="text-xs">
            <span className="font-medium text-falcon-muted">Input: </span>
            <span className="font-mono text-falcon-text">{step.input}</span>
          </div>
          <div className="text-xs">
            <span className="font-medium text-falcon-muted">Output: </span>
            <span className="font-mono text-falcon-text">{step.output}</span>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Verify it compiles**

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/interactive/PipelineSection.tsx src/components/interactive/PipelineVisualizer.tsx
git commit -m "feat: add Pipeline Visualizer component with play/pause/step/reset"
```

---

### Task 5: Wire Pipeline Visualizer into Page

**Files:**
- Modify: `apps/demo/src/app/page.tsx`

**Step 1: Add PipelineSection import and render**

Current page.tsx renders sections in order: Hero → WhyPostQuantum → PerformanceStats → PlaygroundSection → AccountDeploySection → Footer.

Per the PRD, Pipeline Visualizer (section 5) goes between Playground (section 4) and Account Deploy (section 6).

Update `page.tsx`:

```tsx
import { Footer } from "@/components/landing/Footer"
import { Hero } from "@/components/landing/Hero"
import { PerformanceStats } from "@/components/landing/PerformanceStats"
import { WhyPostQuantum } from "@/components/landing/WhyPostQuantum"
import { PlaygroundSection } from "@/components/interactive/PlaygroundSection"
import { PipelineSection } from "@/components/interactive/PipelineSection"
import { AccountDeploySection } from "@/components/interactive/AccountDeploySection"

export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen">
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

**Step 2: Verify typecheck**

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire Pipeline Visualizer into page layout"
```

---

### Task 6: Final Build Verification

**Files:** None (verification only)

**Step 1: Run typecheck**

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run typecheck`
Expected: No errors

**Step 2: Run tests**

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun test`
Expected: 70+ tests passing, 0 failing

**Step 3: Run production build**

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run build`
Expected: Build succeeds with no errors. May show warnings about WASM loading (expected in SSG).

**Step 4: Run dev server smoke test**

Run: `cd /home/felt/PycharmProjects/s2morrow/apps/demo && bun run dev`
Then manually verify at `http://localhost:3000`:
- All 6 sections render
- Pipeline Visualizer shows 6 cards
- Play/Pause/Step/Reset buttons work
- Theme toggle works

**Step 5: Final commit if any fixes needed**

```bash
git commit -m "chore: fix build issues from final verification"
```
