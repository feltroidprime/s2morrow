# Profile Git Commit Naming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic git commit hash suffix to profile artifact filenames for version tracking.

**Architecture:** Update the naming convention to include a 7-character git short hash suffix, and create a shell helper function to generate compliant filenames automatically.

**Tech Stack:** Bash, Git

---

## Task 1: Update CLAUDE.md naming convention

**Files:**
- Modify: `CLAUDE.md:17-19`

**Step 1: Update the profiling artifacts section**

Replace lines 17-19 with:

```markdown
**Profiling artifacts:** All profiles (`.pb.gz`), PNG call graphs, and logs go in `profiles/` at the project root. Name files with git commit suffix:
- `profiles/<package>_<function>_<metric>_<commit>.pb.gz` (e.g., `falcon_ntt512_steps_abc1234.pb.gz`)
- `profiles/<package>_<function>_<metric>_<commit>.png` (e.g., `falcon_ntt512_steps_abc1234.png`)

Generate filenames with: `echo "profiles/${NAME}_$(git rev-parse --short HEAD).pb.gz"`
```

**Step 2: Verify change**

Run: `grep -A3 "Profiling artifacts" CLAUDE.md`
Expected: Shows updated convention with `_<commit>` suffix and helper command

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add git commit suffix to profile naming convention"
```

---

## Task 2: Create profile naming helper script

**Files:**
- Create: `scripts/profile-name.sh`

**Step 1: Create scripts directory if needed**

```bash
mkdir -p scripts
```

**Step 2: Create the helper script**

Create `scripts/profile-name.sh`:

```bash
#!/usr/bin/env bash
# Generate profile artifact filename with git commit suffix
# Usage: profile-name.sh <package> <function> <metric> [extension]
# Example: profile-name.sh falcon ntt512 steps pb.gz
#          -> profiles/falcon_ntt512_steps_abc1234.pb.gz

set -euo pipefail

if [[ $# -lt 3 ]]; then
    echo "Usage: $0 <package> <function> <metric> [extension]" >&2
    echo "Example: $0 falcon ntt512 steps pb.gz" >&2
    exit 1
fi

PACKAGE="$1"
FUNCTION="$2"
METRIC="$3"
EXT="${4:-pb.gz}"

COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "profiles/${PACKAGE}_${FUNCTION}_${METRIC}_${COMMIT}.${EXT}"
```

**Step 3: Make script executable**

```bash
chmod +x scripts/profile-name.sh
```

**Step 4: Test the script**

Run: `./scripts/profile-name.sh falcon ntt512 steps pb.gz`
Expected: `profiles/falcon_ntt512_steps_<current-commit>.pb.gz`

Run: `./scripts/profile-name.sh falcon ntt512 steps png`
Expected: `profiles/falcon_ntt512_steps_<current-commit>.png`

**Step 5: Commit**

```bash
git add scripts/profile-name.sh
git commit -m "feat: add profile naming helper script with git commit suffix"
```

---

## Task 3: Update CLAUDE.md to reference the helper script

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the profiling artifacts section to reference script**

Replace the inline echo command with reference to the script:

```markdown
**Profiling artifacts:** All profiles (`.pb.gz`), PNG call graphs, and logs go in `profiles/` at the project root. Name files with git commit suffix:
- `profiles/<package>_<function>_<metric>_<commit>.pb.gz` (e.g., `falcon_ntt512_steps_abc1234.pb.gz`)
- `profiles/<package>_<function>_<metric>_<commit>.png` (e.g., `falcon_ntt512_steps_abc1234.png`)

Use the helper script: `./scripts/profile-name.sh <package> <function> <metric> [ext]`
```

**Step 2: Verify change**

Run: `grep "profile-name.sh" CLAUDE.md`
Expected: Shows reference to helper script

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: reference profile naming helper script in CLAUDE.md"
```

---

## Task 4: Rename existing profile artifacts with commit suffix

**Files:**
- Rename: Files in `profiles/`

**Step 1: Check current git commit**

```bash
git rev-parse --short HEAD
```

Note the output (e.g., `9e92f90`)

**Step 2: Rename existing profile files**

Since we don't know the original commit for existing files, we'll use "legacy" as the suffix:

```bash
cd profiles
for f in *.pb.gz *.png; do
    [[ "$f" == ".gitkeep" ]] && continue
    [[ "$f" == *_???????.* ]] && continue  # Skip if already has 7-char suffix
    base="${f%.*}"
    ext="${f##*.}"
    mv "$f" "${base}_legacy.${ext}"
done
```

**Step 3: Verify rename**

Run: `ls profiles/`
Expected: All files now have `_legacy` suffix (e.g., `falcon_512_steps_legacy.pb.gz`)

**Step 4: No git commit needed**

These files are gitignored, so no commit is necessary.

---

## Summary

After completing all tasks:

1. `CLAUDE.md` documents the new naming convention with git commit suffix
2. `scripts/profile-name.sh` helper generates compliant filenames
3. Existing profile artifacts renamed with `_legacy` suffix
4. Future profiles will include actual git commit hash (e.g., `_abc1234`)
