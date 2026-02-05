# Profile Git Commit Naming Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic git commit hash suffix to profile artifact filenames, with a helper script embedded in the benchmarking-cairo skill.

**Architecture:** Update the benchmarking-cairo skill to include an "Output Location" section with naming conventions and a helper script. Update CLAUDE.md to reference the skill for naming. Clean up the inline echo command.

**Tech Stack:** Bash, Git, Markdown

---

## Task 1: Add Output Location section and helper script to benchmarking-cairo skill

**Files:**
- Modify: `/home/felt/PycharmProjects/cairo-skills/skills/benchmarking-cairo/SKILL.md`

**Step 1: Read current SKILL.md**

Verify current state before editing.

**Step 2: Add new section after "## Quick Reference" (after line 23)**

Insert this new section:

```markdown
## Output Location

**All profiling artifacts go in `profiles/` at the project root.** Name files with git commit suffix for version tracking:

```
profiles/<package>_<function>_<metric>_<commit>.<ext>
```

Examples:
- `profiles/falcon_ntt512_steps_abc1234.pb.gz`
- `profiles/falcon_ntt512_steps_abc1234.png`

### Helper Script

Use this script to generate compliant filenames:

```bash
#!/usr/bin/env bash
# Usage: profile-name <package> <function> <metric> [extension]
# Example: profile-name falcon ntt512 steps pb.gz
profile-name() {
    local pkg="$1" fn="$2" metric="$3" ext="${4:-pb.gz}"
    local commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    echo "profiles/${pkg}_${fn}_${metric}_${commit}.${ext}"
}
```

**Quick usage (copy-paste):**
```bash
# Generate filename
OUT=$(profile-name falcon ntt512 steps pb.gz)

# Use with cairo-profiler
cairo-profiler build-profile <trace.json> --show-libfuncs --output-path "$OUT"

# Use with pprof
pprof -png -sample_index=steps -output "$(profile-name falcon ntt512 steps png)" "$OUT"
```
```

**Step 3: Update "Common Patterns" section to use profiles/ directory**

Find the "Common Patterns" section (around line 181) and update the examples to output to `profiles/` with commit suffix. Update:

1. In "Full benchmark pipeline (scarb execute)" - change step 4:
```bash
# 4. Export PNG to profiles/
OUT=$(profile-name <pkg> <func> steps pb.gz)
cairo-profiler build-profile ... --output-path "$OUT"
pprof -png -sample_index=steps -output "$(profile-name <pkg> <func> steps png)" "$OUT"
```

2. Similar updates for the other two pipeline sections.

**Step 4: Verify changes**

Run: `grep -n "profiles/" /home/felt/PycharmProjects/cairo-skills/skills/benchmarking-cairo/SKILL.md`
Expected: Multiple lines showing profiles/ usage

**Step 5: Commit in cairo-skills repo**

```bash
cd /home/felt/PycharmProjects/cairo-skills
git add skills/benchmarking-cairo/SKILL.md
git commit -m "feat(benchmarking-cairo): add output location section with git commit naming"
```

---

## Task 2: Simplify CLAUDE.md to reference the skill

**Files:**
- Modify: `/home/felt/PycharmProjects/s2morrow/CLAUDE.md:17-21`

**Step 1: Read current CLAUDE.md**

Verify current state.

**Step 2: Simplify profiling artifacts section**

Replace lines 17-21 with:

```markdown
**Profiling artifacts:** Store in `profiles/` with git commit suffix. See `/benchmarking-cairo` skill for naming convention and helper script.
```

This removes the inline examples and echo command, deferring to the skill for details.

**Step 3: Verify change**

Run: `grep "Profiling artifacts" /home/felt/PycharmProjects/s2morrow/CLAUDE.md`
Expected: Shows simplified one-liner referencing the skill

**Step 4: Commit**

```bash
cd /home/felt/PycharmProjects/s2morrow
git add CLAUDE.md
git commit -m "docs: simplify profiling artifacts section, reference skill for details"
```

---

## Task 3: Rename existing profile artifacts with legacy suffix

**Files:**
- Rename: Files in `/home/felt/PycharmProjects/s2morrow/profiles/`

**Step 1: List current files**

```bash
ls /home/felt/PycharmProjects/s2morrow/profiles/
```

**Step 2: Rename files without commit suffix to have `_legacy` suffix**

```bash
cd /home/felt/PycharmProjects/s2morrow/profiles
for f in *.pb.gz *.png; do
    [[ "$f" == ".gitkeep" ]] && continue
    [[ "$f" =~ _[a-f0-9]{7}\. ]] && continue  # Skip if already has 7-char hex suffix
    [[ "$f" =~ _legacy\. ]] && continue       # Skip if already has _legacy
    base="${f%.*}"
    ext="${f##*.}"
    mv "$f" "${base}_legacy.${ext}"
done
```

**Step 3: Verify rename**

Run: `ls /home/felt/PycharmProjects/s2morrow/profiles/`
Expected: All files have either `_legacy` or `_<7-char-hash>` suffix

**Step 4: No git commit needed**

Files are gitignored.

---

## Summary

After completing all tasks:

1. `benchmarking-cairo` skill has "Output Location" section with:
   - `profiles/` directory convention
   - Git commit suffix naming pattern
   - `profile-name` helper function
   - Updated "Common Patterns" examples
2. `CLAUDE.md` simplified to one-liner referencing the skill
3. Existing profile artifacts renamed with `_legacy` suffix
