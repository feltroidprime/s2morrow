# Update snforge-cycle-repro with Smaller Reproduction

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the minimal reproduction repo to use `ntt_felt252.cairo` (12K lines) instead of `ntt_bounded_int.cairo` (27K lines) for faster compilation while still reproducing the "cycle during cost computation" bug.

**Architecture:** Replace the BoundedInt-based NTT with the felt252-based NTT which uses simpler types. Update test and executable to use `Array<felt252>` interface. The `zq.cairo` module can be removed as it's no longer needed.

**Tech Stack:** Cairo, snforge, scarb

---

### Task 1: Clone and Setup the Reproduction Repo

**Files:**
- Work in: `/tmp/snforge-cycle-repro/`

**Step 1: Clone the repo fresh**

```bash
cd /tmp && rm -rf snforge-cycle-repro && git clone https://github.com/feltroidprime/snforge-cycle-repro
cd /tmp/snforge-cycle-repro
```

**Step 2: Verify current state reproduces bug**

Run: `snforge test`
Expected: Eventually fails with "found an unexpected cycle during cost computation" (takes a while to compile)

---

### Task 2: Replace ntt.cairo with ntt_felt252.cairo

**Files:**
- Replace: `src/ntt.cairo`

**Step 1: Copy the new NTT file**

```bash
cp /home/felt/PycharmProjects/s2morrow/packages/falcon/src/ntt_felt252.cairo /tmp/snforge-cycle-repro/src/ntt.cairo
```

**Step 2: Verify file is smaller**

Run: `wc -l src/ntt.cairo`
Expected: ~12109 lines (down from ~26550)

---

### Task 3: Update lib.cairo to Remove zq Dependency

**Files:**
- Modify: `src/lib.cairo`

**Step 1: Update lib.cairo**

```cairo
// Minimal reproduction of "unexpected cycle during cost computation" bug
//
// To reproduce:
//   cd /path/to/cycle_repro && snforge test
//
// Expected: Tests pass
// Actual: [ERROR] found an unexpected cycle during cost computation

pub mod ntt;
pub mod programs;

#[cfg(test)]
mod tests {
    mod test_ntt;
}
```

**Step 2: Delete the unused zq.cairo**

```bash
rm src/zq.cairo
```

---

### Task 4: Update the Test to Use felt252

**Files:**
- Modify: `src/tests/test_ntt.cairo`

**Step 1: Update test_ntt.cairo**

```cairo
use crate::ntt::ntt_512;

#[test]
fn test_ntt_512_zeros() {
    let mut f: Array<felt252> = array![];
    let mut i: usize = 0;
    while i < 512 {
        f.append(0);
        i += 1;
    }
    let result = ntt_512(f);
    assert_eq!(result.len(), 512);
}
```

---

### Task 5: Update the Executable to Use felt252

**Files:**
- Modify: `src/programs/bench_ntt.cairo`

**Step 1: Update bench_ntt.cairo**

```cairo
use crate::ntt::ntt_512;

#[executable]
pub fn main(input: Array<felt252>) -> Array<felt252> {
    ntt_512(input)
}
```

---

### Task 6: Verify Bug Still Reproduces

**Step 1: Run snforge test**

Run: `snforge test`
Expected:
- Compilation succeeds (faster than before, ~10 seconds vs ~30+ seconds)
- Then fails with: `[ERROR] found an unexpected cycle during cost computation`

**Step 2: Verify scarb build works**

Run: `scarb build`
Expected: Build succeeds (proves the code itself is valid)

---

### Task 7: Update README.md

**Files:**
- Modify: `README.md`

**Step 1: Update README**

```markdown
# snforge Cycle Detection Bug Reproduction

Minimal reproduction of the "found an unexpected cycle during cost computation" error in snforge.

## Setup

```bash
git clone https://github.com/feltroidprime/snforge-cycle-repro
cd snforge-cycle-repro
```

## Reproduce the Bug

```bash
snforge test
```

Expected output:
```
   Compiling test(cycle_repro_unittest) ...
    Finished `dev` profile target(s) in ~10 seconds
[ERROR] found an unexpected cycle during cost computation
[ERROR] Error while compiling Sierra...
```

## Verify Code is Valid

```bash
scarb build
```

This succeeds, showing the Cairo code itself is valid.

## Analysis

The issue occurs when:
1. A package has an `#[executable]` function
2. The package uses BoundedInt types with DivRemHelper implementations
3. `snforge test` compiles with the universal-sierra-compiler

The root cause appears to be that `scarb build` uses `enable_gas = false` for executables, while universal-sierra-compiler performs full gas cost computation, triggering false cycle detection in the type hierarchy.

## Environment

- scarb 2.15.1
- snforge 0.55.0
- Cairo 2.15.1
```

---

### Task 8: Commit and Push

**Step 1: Stage all changes**

```bash
git add -A
git status
```

**Step 2: Commit**

```bash
git commit -m "refactor: use smaller ntt_felt252 for faster reproduction

- Replace 27K line BoundedInt NTT with 12K line felt252 NTT
- Remove zq.cairo dependency (no longer needed)
- Update test and executable to use Array<felt252>
- Compilation is now ~3x faster while still reproducing the bug"
```

**Step 3: Push**

```bash
git push origin main
```

---

### Task 9: Update the GitHub Issue

**Step 1: Add comment to issue #4138**

Add a comment explaining:
- The reproduction has been updated to use a smaller file (12K vs 27K lines)
- Compilation is much faster now
- The bug still reproduces with the same error
