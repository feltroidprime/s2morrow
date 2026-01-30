# Optimize using-bounded-int Skill

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken imports and reduce skill size to make subagents faster and cheaper.

**Architecture:** The skill has wrong import paths causing subagents to explore corelib caches. Fix imports, add working example, remove redundant documentation.

**Tech Stack:** Cairo, corelib_imports 0.1.2, Python CLI tool

---

## Analysis Results

### Session Metrics Comparison

| Metric | RED (no skill) | GREEN (with skill) | Delta |
|--------|----------------|-------------------|-------|
| Tool uses | 51 | 45 | -12% |
| Input tokens | 3,799,017 | 3,656,258 | -4% |
| Bash commands | 19 | 24 | +26% |
| Read commands | 13 | 8 | -38% |
| Build failures | ~4 | ~8 | +100% |

### Root Cause: Wrong Imports in Skill

The skill specifies:
```cairo
// WRONG - does not compile
use corelib_imports::bounded_int::{
    BoundedInt, upcast, downcast,
    add, sub, mul, div_rem,        // NOT exported at this level
    AddHelper, SubHelper,          // SubHelper NOT exported here
    MulHelper, DivRemHelper,
};
```

Actual corelib_imports exports:
```cairo
// lib.cairo of corelib_imports 0.1.2
pub use core::internal::bounded_int;  // Whole module
pub use core::internal::bounded_int::{
    AddHelper, BoundedInt, DivRemHelper, MulHelper, UnitInt,
    bounded_int_div_rem, downcast, upcast,
    // NOTE: SubHelper NOT here, add/sub/mul NOT here
};
```

Correct imports:
```cairo
use corelib_imports::bounded_int::{
    BoundedInt, upcast, downcast, bounded_int_div_rem,
    AddHelper, MulHelper, DivRemHelper, UnitInt,
};
use corelib_imports::bounded_int::bounded_int::{SubHelper, add, sub, mul};
```

### Why GREEN Had More Build Failures

1. Agent read skill with wrong imports
2. Tried skill's import → build failed
3. Had to explore ~/.cache/scarb to find correct paths
4. Multiple iterations to fix imports

### Skill Redundancy Analysis

Current skill is ~500 lines. Claude already knows:
- Interval arithmetic basics
- BoundedInt type system
- Helper trait pattern

Skill should focus on what Claude does NOT know:
- Correct import paths (CRITICAL)
- CLI tool usage
- Edge cases (UnitInt for constants)

---

## Tasks

### Task 1: Fix Import Section

**Files:**
- Modify: `.claude/skills/using-bounded-int/SKILL.md` (Prerequisites section)

**Step 1: Read current Prerequisites section**

Verify current broken imports.

**Step 2: Replace with tested correct imports**

```cairo
use corelib_imports::bounded_int::{
    BoundedInt, upcast, downcast, bounded_int_div_rem,
    AddHelper, MulHelper, DivRemHelper, UnitInt,
};
use corelib_imports::bounded_int::bounded_int::{SubHelper, add, sub, mul};
```

**Step 3: Verify skill file updated**

---

### Task 2: Add Minimal Working Example

**Files:**
- Modify: `.claude/skills/using-bounded-int/SKILL.md`

**Step 1: Add "Copy-Paste Template" section after Prerequisites**

This gives subagents a working starting point they can copy:

```cairo
/// Minimal working example - copy and adapt
use corelib_imports::bounded_int::{
    BoundedInt, upcast, downcast, bounded_int_div_rem,
    AddHelper, MulHelper, DivRemHelper, UnitInt,
};
use corelib_imports::bounded_int::bounded_int::{SubHelper, add, sub, mul};

// Type for values in [0, 99]
type Val = BoundedInt<0, 99>;
type ValSum = BoundedInt<0, 198>;
type ValConst = UnitInt<100>;

impl AddValImpl of AddHelper<Val, Val> {
    type Result = ValSum;
}

impl DivRemValImpl of DivRemHelper<ValSum, ValConst> {
    type DivT = BoundedInt<0, 1>;
    type RemT = Val;
}

fn add_mod_100(a: Val, b: Val) -> Val {
    let sum: ValSum = add(a, b);
    let nz_100: NonZero<ValConst> = 100;
    let (_q, rem) = bounded_int_div_rem(sum, nz_100);
    rem
}
```

---

### Task 3: Remove Redundant Documentation

**Files:**
- Modify: `.claude/skills/using-bounded-int/SKILL.md`

**Step 1: Remove "Boundary Calculation" section**

Claude knows interval arithmetic. Keep only the CLI tool reference.

**Step 2: Remove "Helper Trait Patterns" detail section**

The copy-paste template shows the pattern. No need for verbose examples.

**Step 3: Remove "Generic Example: Safe Division Pipeline"**

Redundant with copy-paste template and zq.cairo example.

**Step 4: Keep only essential sections:**

1. Overview (2 sentences)
2. Prerequisites (correct imports)
3. Copy-Paste Template (working example)
4. CLI Tool Usage (commands only)
5. Quick Reference (tables only)
6. Common Mistakes (keep - these are non-obvious)

---

### Task 4: Test Optimized Skill

**Files:**
- Test: Run subagent with optimized skill

**Step 1: Revert zq.cairo to original**

```bash
git checkout packages/falcon/src/zq.cairo packages/falcon/Scarb.toml
```

**Step 2: Run optimization task with new skill**

Use Task tool to test.

**Step 3: Compare metrics**

Target: <20 tool uses, <1.5M tokens

---

### Task 5: Commit Changes

**Step 1: Stage skill changes**

```bash
git add .claude/skills/using-bounded-int/SKILL.md
```

**Step 2: Commit**

```bash
git commit -m "fix(skill): correct imports and reduce size for using-bounded-int"
```

---

## Expected Outcome

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Skill size | ~500 lines | ~150 lines |
| Tool uses | 45 | <20 |
| Build failures | 8 | 0-1 |
| Import exploration | Yes | No |

The key insight: **correct imports eliminate exploration entirely**.
