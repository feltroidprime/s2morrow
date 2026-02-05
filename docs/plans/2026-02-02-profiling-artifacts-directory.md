# Profiling Artifacts Directory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize all profiling artifacts (`.pb.gz` profiles, PNG call graphs, logs) into a dedicated `profiles/` directory at the project root.

**Architecture:** Create a `profiles/` directory convention, document it in CLAUDE.md, update the benchmarking-cairo skill to use this location, and clean up existing scattered artifacts.

**Tech Stack:** Shell commands, Markdown documentation

---

## Task 1: Create the profiles directory structure

**Files:**
- Create: `profiles/.gitkeep`

**Step 1: Create the profiles directory with .gitkeep**

```bash
mkdir -p profiles && touch profiles/.gitkeep
```

**Step 2: Verify directory exists**

Run: `ls -la profiles/`
Expected: Shows `.gitkeep` file

**Step 3: Commit**

```bash
git add profiles/.gitkeep
git commit -m "feat: add dedicated profiles directory for profiling artifacts"
```

---

## Task 2: Update .gitignore for profiles directory

**Files:**
- Modify: `.gitignore`

**Step 1: Read current .gitignore**

Verify the current state (already done in planning, but verify before edit).

**Step 2: Update .gitignore to be explicit about profiles directory**

Replace the generic `*.pb.gz` and `*.png` with directory-specific rules:

```gitignore
# Profiling
profiles/*.pb.gz
profiles/*.png
profiles/*.log
# Keep legacy ignores for any stragglers
*.pb.gz
*.png
```

**Step 3: Verify change**

Run: `cat .gitignore | grep -A4 "# Profiling"`
Expected: Shows the new profiling section

**Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for profiles directory"
```

---

## Task 3: Update CLAUDE.md with profiling conventions

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Read current CLAUDE.md**

Verify current content before editing.

**Step 2: Add profiling artifacts section**

Add the following section after the existing "Profiling" line:

```markdown
**Profiling artifacts:** All profiles (`.pb.gz`), PNG call graphs, and logs go in `profiles/` at the project root. Name files descriptively:
- `profiles/<package>_<function>_<metric>.pb.gz` (e.g., `falcon_ntt512_steps.pb.gz`)
- `profiles/<package>_<function>_<metric>.png` (e.g., `falcon_ntt512_steps.png`)
```

**Step 3: Verify change**

Run: `cat CLAUDE.md`
Expected: Shows the new profiling artifacts section

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add profiling artifacts directory convention to CLAUDE.md"
```

---

## Task 4: Update benchmarking-cairo skill

**Files:**
- Modify: `.claude/skills/benchmarking-cairo/skill.md`

**Step 1: Read current skill file**

Read the skill file to find where output paths are mentioned.

**Step 2: Update skill to use profiles/ directory**

Add a new section after "## Quick Reference" or update existing commands to specify output paths:

```markdown
## Output Location

**All profiling artifacts go in `profiles/` at the project root:**

```bash
# Build profile to profiles/ directory
cairo-profiler build-profile <trace.json> --show-libfuncs --output-path profiles/<name>.pb.gz

# Export PNG to profiles/ directory
pprof -png -sample_index=steps -output profiles/<name>_steps.png profiles/<name>.pb.gz
```

Naming convention: `<package>_<function>_<metric>.<ext>`
- Example: `falcon_ntt512_steps.pb.gz`, `falcon_ntt512_steps.png`
```

Also update the "Common Patterns" section examples to use `profiles/` directory.

**Step 3: Verify change**

Run: `grep -n "profiles/" .claude/skills/benchmarking-cairo/skill.md`
Expected: Shows multiple lines with profiles/ path

**Step 4: Commit**

```bash
git add .claude/skills/benchmarking-cairo/skill.md
git commit -m "docs: update benchmarking-cairo skill to use profiles/ directory"
```

---

## Task 5: Clean up existing scattered profile artifacts

**Files:**
- Move/Delete: Various `.pb.gz` and `.png` files in root and package directories

**Step 1: List all existing profile artifacts**

```bash
find . -name "*.pb.gz" -o -name "*_steps.png" -o -name "*_l2gas.png" | grep -v profiles/
```

**Step 2: Move useful artifacts to profiles/ with proper naming**

```bash
# Move root-level artifacts
mv profile.pb.gz profiles/misc_profile.pb.gz 2>/dev/null || true
mv falcon_512_profile.pb.gz profiles/falcon_512.pb.gz 2>/dev/null || true
mv falcon_512_steps.png profiles/falcon_512_steps.png 2>/dev/null || true
mv secp256r1_recover_l2gas.png profiles/secp256r1_recover_l2gas.png 2>/dev/null || true
mv secp256k1_recover_l2gas.png profiles/secp256k1_recover_l2gas.png 2>/dev/null || true
mv secp256k1_verify_l2gas.png profiles/secp256k1_verify_l2gas.png 2>/dev/null || true

# Move package-level artifacts
mv packages/falcon/ntt_optimized_profile.pb.gz profiles/falcon_ntt_optimized.pb.gz 2>/dev/null || true
mv packages/falcon/ntt_optimized_steps.png profiles/falcon_ntt_optimized_steps.png 2>/dev/null || true
mv packages/falcon/profiles/*.pb.gz profiles/ 2>/dev/null || true
mv packages/falcon/profiles/*.png profiles/ 2>/dev/null || true
```

**Step 3: Remove empty package profile directories**

```bash
rmdir packages/falcon/profiles 2>/dev/null || true
```

**Step 4: Verify cleanup**

Run: `find . -name "*.pb.gz" -o -name "*_steps.png" -o -name "*_l2gas.png" | grep -v profiles/ | grep -v ".git"`
Expected: No output (all artifacts moved)

Run: `ls profiles/`
Expected: Shows all moved artifacts

**Step 5: Commit cleanup**

Note: Since these files are gitignored, this is just for local cleanliness. No git commit needed for the move itself.

---

## Summary

After completing all tasks:

1. `profiles/` directory exists with `.gitkeep`
2. `.gitignore` explicitly handles `profiles/*.pb.gz`, `profiles/*.png`, `profiles/*.log`
3. `CLAUDE.md` documents the convention
4. `benchmarking-cairo` skill guides users to use `profiles/`
5. Existing artifacts are consolidated in `profiles/`
