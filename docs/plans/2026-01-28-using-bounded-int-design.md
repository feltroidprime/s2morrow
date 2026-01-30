# Using Bounded Int Skill Design

**Date:** 2026-01-28
**Status:** Approved

## Summary

A skill for optimizing Cairo arithmetic operations using bounded integers (`BoundedInt<MIN, MAX>`), which eliminates runtime overflow checks by encoding value constraints in the type system.

## Decisions Made

| Question | Decision |
|----------|----------|
| Scope | General bounded int optimization (not just modular arithmetic) |
| Trigger | Explicit "using bounded int" only |
| Automation | Worked examples + patterns (not lookup tables) |
| Trade-offs section | No - assume user has decided to use bounded ints |
| Helper coverage | Core four (Add, Sub, Mul, DivRem) + upcast/downcast |
| Dependency setup | Separate prerequisites section |
| Worked examples | Both zq.cairo concrete AND generic example |
| Methodology | Interval arithmetic + type-driven inference combined |
| Signed/unsigned | Both patterns documented, unsigned recommended |
| Quick reference | Yes, compact table for common cases |
| Boundary calculation | Python CLI tool to eliminate calculation errors |
| felt252 validation | Yes, warn if bounds exceed P |

## Skill Structure

```
using-bounded-int/
├── SKILL.md              # Main skill document
└── bounded_int_calc.py   # CLI tool for computing impls
```

## Sections

1. Overview & Prerequisites
2. Boundary Calculation Methodology
3. Boundary Calculator CLI
4. Helper Trait Patterns
5. Worked Example: zq.cairo
6. Generic Example: Division Pipeline
7. Quick Reference Tables
8. Common Mistakes

## Verification Plan

- Common mistakes section needs validation during RED phase testing
- Test that "wrong" patterns fail to compile
- Test that "correct" patterns compile and run
