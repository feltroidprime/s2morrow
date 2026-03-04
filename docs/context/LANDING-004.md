# Context for LANDING-004: Implement PerformanceStats RSC section with table and calldata card

## Ticket Summary

Create `apps/demo/src/components/landing/PerformanceStats.tsx` as a React Server Component (zero client JS). Must include:
1. Section heading **"Performance Stats"** (exact text from PRD, not just "Performance")
2. Table with 4 rows: `verify` (63,177 steps, ~13.2M L2 gas), `verify_with_msg_point` (26,301, ~5.5M), `hash_to_point` (5,988, ~1.3M), `NTT-512` (~15,000, ~3.1M)
3. Table must have `scope="col"` on `<th>` elements and a `<caption>` for accessibility
4. Calldata efficiency card showing **17x reduction** (62 vs ~1,030 felts)
5. Operation names in **monospace font** (`font-mono`)

## Current State

### Files That EXIST

| File | Status | Notes |
|------|--------|-------|
| `apps/demo/src/app/page.tsx` | Exists | Placeholder only ("Coming soon"). Needs to import and render PerformanceStats. |
| `apps/demo/src/app/layout.tsx` | Exists | `className="dark"` on `<html>`, bg-falcon-bg |
| `apps/demo/src/app/globals.css` | Exists | Tailwind v4 CSS-first with `@theme` tokens: falcon-primary, falcon-accent, falcon-surface, falcon-muted, falcon-text, etc. Dark/light class strategy. |
| `apps/demo/src/components/ThemeToggle.tsx` | Exists | Reference for component patterns (client component, uses design tokens) |
| `apps/demo/src/tests/landing/performance-stats.test.ts` | Exists | Test skeleton with `.todo` tests + smoke tests for data constants. **Tests need updating after implementation.** |

### Files That DO NOT EXIST (must create)

| File | Notes |
|------|-------|
| `apps/demo/src/components/landing/PerformanceStats.tsx` | **PRIMARY DELIVERABLE** |
| `apps/demo/src/components/landing/Hero.tsx` | Sibling component, not this ticket's scope |
| `apps/demo/src/components/landing/WhyPostQuantum.tsx` | Sibling component, not this ticket's scope |
| `apps/demo/src/components/landing/Footer.tsx` | Sibling component, not this ticket's scope |

## Performance Data (from README.md and PRD)

Source: `README.md` lines 67-71, cross-referenced with PRD line 79 and impl plan Task 5 Step 3.

| Operation | Steps | L2 Gas | Source |
|-----------|-------|--------|--------|
| `verify` (e2e) | 63,177 | ~13.2M | README.md, PRD |
| `verify_with_msg_point` | 26,301 | ~5.5M | README.md, PRD |
| `hash_to_point` (Poseidon) | 5,988 | ~1.3M | README.md, PRD |
| `NTT-512` (unrolled) | ~15,000 | ~3.1M | PRD (not in README) |

### Calldata Efficiency Numbers

- **Packed calldata:** 62 felt252 (29 for s1 + 29 for mul_hint + salt felts)
- **Unpacked (raw):** ~1,030 felts (512 + 512 + ~6 salt felts)
- **Reduction factor:** ~17x
- **Storage packing:** 512 Zq values -> 29 felt252 slots (base-Q polynomial encoding: 9 values per u128, 18 per felt252)
- Source: README.md ("packs 512 Zq coefficients into 29 felt252 slots"), PRD line 79

## Implementation Reference (from impl plan Task 5, Step 3)

The implementation plan provides a starter template at `docs/plans/2026-02-23-falcon-demo-website-impl.md` (lines 1037-1085). Key differences from ticket requirements:

### Plan template vs ticket requirements

| Aspect | Plan Template | Ticket Requirement | Action |
|--------|--------------|-------------------|--------|
| Heading text | `"Performance"` | `"Performance Stats"` | **Change to "Performance Stats"** |
| `<th scope="col">` | Missing | Required for accessibility | **Add `scope="col"` to all `<th>` elements** |
| `<caption>` | Missing | Required for accessibility | **Add `<caption>` to table** |
| Operation name font | `font-mono text-falcon-accent` | Monospace font | Already correct in plan |
| Calldata card | Present | Present — must show "17x reduction (62 vs ~1,030 felts)" | Match wording to ticket |

### Template code from plan (needs modifications)

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
        {/* ... table ... */}
        {/* ... calldata card ... */}
      </div>
    </section>
  )
}
```

## Required Modifications to Plan Template

1. **Heading**: Change `"Performance"` to `"Performance Stats"`
2. **Table accessibility**: Add `scope="col"` to each `<th>`:
   ```tsx
   <th scope="col" className="px-6 py-3 font-semibold">Operation</th>
   <th scope="col" className="px-6 py-3 font-semibold text-right">Steps</th>
   <th scope="col" className="px-6 py-3 font-semibold text-right">Gas</th>
   ```
3. **Table caption**: Add a `<caption>` inside `<table>`:
   ```tsx
   <table className="w-full text-left text-sm">
     <caption className="...">Falcon-512 operation benchmarks on Starknet</caption>
     ...
   </table>
   ```
4. **Operation names**: Already use `font-mono` in the plan template - verify this is preserved
5. **Calldata card**: Ensure it explicitly states "17x reduction" and "62 vs ~1,030 felts"

## Design System Tokens (from globals.css)

```css
--color-falcon-primary: #6366f1;    /* Indigo - brand */
--color-falcon-accent: #06b6d4;     /* Cyan - highlights */
--color-falcon-success: #10b981;    /* Green */
--color-falcon-error: #ef4444;      /* Red */
--color-falcon-bg: #0f172a;         /* Dark background */
--color-falcon-surface: #1e293b;    /* Card background */
--color-falcon-text: #f8fafc;       /* Primary text */
--color-falcon-muted: #94a3b8;      /* Secondary text */
```

### Card styling pattern (from WhyPostQuantum plan)
```
rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6
```

## Existing Test File Analysis

`apps/demo/src/tests/landing/performance-stats.test.ts`:

- Uses `bun:test` (describe/test/expect)
- Has `.todo` tests for: 4 operation rows, step counts, gas costs, calldata card, zero client JS
- Has passing smoke tests for `PERFORMANCE_DATA` constants and calldata efficiency calculation
- **Note**: The existing test has `l2GasM: 56.6` for `verify_with_msg_point` which contradicts the PRD's `~5.5M`. The PRD value (~5.5M) is authoritative.
- Import path comment suggests `@/app/components/PerformanceStatsSection` but **the plan uses `@/components/landing/PerformanceStats`** - follow the plan path.

## Page Integration

When implemented, `page.tsx` must be updated to import and render the component:

```tsx
import { PerformanceStats } from "@/components/landing/PerformanceStats"
// ... in JSX:
<PerformanceStats />
```

Current `page.tsx` is a placeholder that will be updated when all landing sections land.

## Architecture Rules

1. **RSC only** - No `"use client"` directive, no useState/useEffect, no event handlers
2. **Zero client JS** - Pure server-rendered HTML
3. **Tailwind CSS v4** - Use design tokens from globals.css via `text-falcon-*`, `bg-falcon-*`, etc.
4. **Component location** - `apps/demo/src/components/landing/PerformanceStats.tsx`
5. **Export** - Named export `PerformanceStats` (not default export, matching plan pattern)

## Reference Files Summary

| File | Relevance |
|------|-----------|
| `docs/specs/falcon-demo-website.md` (line 79) | P0 requirement: table rows, step counts, calldata card |
| `docs/plans/2026-02-23-falcon-demo-website-impl.md` (lines 1037-1085) | Template code for PerformanceStats component |
| `docs/plans/2026-02-23-falcon-demo-website-design.md` (line 128) | Page structure: Performance Stats is RSC |
| `apps/demo/src/app/globals.css` | Design tokens for styling |
| `apps/demo/src/app/layout.tsx` | Dark class strategy, font setup |
| `apps/demo/src/app/page.tsx` | Will import PerformanceStats |
| `apps/demo/src/components/ThemeToggle.tsx` | Reference for component patterns |
| `apps/demo/src/tests/landing/performance-stats.test.ts` | Existing test skeleton to update |
| `README.md` (lines 63-75) | Authoritative step counts |
