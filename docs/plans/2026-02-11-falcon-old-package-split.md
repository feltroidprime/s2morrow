# Falcon Package Split: falcon_old + falcon

**Date:** 2026-02-11
**Goal:** Clean separation of old recursive/u16 code from production BoundedInt code.

## Architecture

### `packages/falcon_old/` (self-contained, upstream-style)

Faithful port of upstream starkware-bitcoin/s2morrow falcon code using u16 arithmetic throughout.

```
falcon_old/
├── Scarb.toml          # standalone, no falcon dependency
└── src/
    ├── lib.cairo
    ├── zq.cairo         # upstream u16 ops: add_mod, sub_mod, mul_mod, mul3_mod
    ├── ntt.cairo        # recursive NTT/INTT (u16 throughout), split/merge, mul_zq
    ├── ntt_constants.cairo  # twiddle factors (moved from falcon)
    └── falcon.cairo     # verify_uncompressed + norm checking
```

### `packages/falcon/` (production, BoundedInt-only, n=512 only)

```
falcon/
├── Scarb.toml          # [dev-dependencies] falcon_old
└── src/
    ├── lib.cairo
    ├── zq.cairo         # BoundedInt Zq + fused ops (no legacy u16 wrappers)
    ├── ntt.cairo        # ntt_512 (no fallback), intt_with_hint, sub_zq, mul_ntt
    ├── ntt_felt252.cairo    # auto-generated unrolled NTT (unchanged)
    ├── falcon.cairo     # verify, verify_with_msg_point, norm checking
    ├── types.cairo      # FalconPublicKey, FalconSignature*, HashToPoint (unchanged)
    ├── packing.cairo    # base-Q packing (unchanged)
    └── hash_to_point.cairo  # Poseidon hash_to_point (unchanged)
```

## What Moves Where

### To falcon_old (from upstream starkware-bitcoin code)

| Item | Source |
|------|--------|
| `zq.cairo` | Upstream: `add_mod(u16,u16)->u16`, `sub_mod`, `mul_mod`, `mul3_mod` |
| `ntt.cairo` | Upstream recursive NTT/INTT + our `mul_zq`, `sub_zq`, `mul_ntt` (all u16) |
| `ntt_constants.cairo` | Move from falcon (twiddle factors, only used by recursive NTT) |
| `falcon.cairo` | `verify_uncompressed` + norm checking (duplicated from falcon) |

### Stays in falcon (simplified)

| Item | Changes |
|------|---------|
| `zq.cairo` | Remove legacy `*_u16` wrappers (add_mod_u16, sub_mod_u16, mul_mod_u16) |
| `ntt.cairo` | Remove: recursive `ntt()`, `intt()`, `split()`, `merge()`, `split_ntt()`, `merge_ntt()`, `mul_zq()`. Remove fallback in `ntt_fast` (now n=512 only). Keep: `intt_with_hint`, `sub_zq`, `mul_ntt` |
| `falcon.cairo` | Remove `verify_uncompressed`. Keep: `verify`, `verify_with_msg_point`, norm checking |

### Removed entirely from falcon

| Item | Reason |
|------|--------|
| `ntt_constants.cairo` | Only used by recursive NTT, moved to falcon_old |
| Fused ops only used by recursive NTT | `fused_i2_sub_mul_mod`, `fused_i2_diff_sqr1inv_mod`, `fused_i2_sum_mod`, `fused_sqr1_mul_mod` — check if still used by ntt_felt252 before removing |

## Test Placement

| Test file | Package | Uses falcon_old? |
|-----------|---------|------------------|
| NTT inline tests (n=4..512, roundtrip) | falcon_old | No (self-contained) |
| test_ntt.cairo (compare recursive vs felt252) | falcon | Yes: `falcon_old::ntt::ntt` as reference |
| test_intt.cairo (intt_with_hint) | falcon | Yes: `falcon_old::ntt::intt` for hint gen |
| test_verify.cairo (verify_uncompressed) | falcon_old | No (self-contained) |
| test_verify_hint.cairo | falcon | No |
| test_packing.cairo | falcon | No |
| test_hash_to_point.cairo | falcon | No |
| test_cross_language.cairo | falcon | No |

## Implementation Plan

### Step 1: Create falcon_old package scaffold

1. Create `packages/falcon_old/Scarb.toml` with snforge_std + assert_macros dev-deps
2. Create `packages/falcon_old/src/lib.cairo`

### Step 2: Port upstream zq.cairo to falcon_old

Port the upstream starkware-bitcoin `zq.cairo` (pure u16 ops: add_mod, sub_mod, mul_mod, mul3_mod).

### Step 3: Move ntt_constants.cairo to falcon_old

Copy `packages/falcon/src/ntt_constants.cairo` to `packages/falcon_old/src/ntt_constants.cairo`.

### Step 4: Create falcon_old ntt.cairo

Port the upstream recursive NTT/INTT using u16 zq ops. Include:
- `ntt()`, `intt()` (recursive)
- `split()`, `merge()`, `split_ntt()`, `merge_ntt()`
- `mul_zq()`, `sub_zq()`, `mul_ntt()`
- Inline tests from current falcon ntt.cairo (test_ntt_4 through test_ntt_512)

### Step 5: Create falcon_old falcon.cairo

Port `verify_uncompressed()` with duplicated norm checking code.
Move `test_falcon1024_verify_uncompressed` test.

### Step 6: Verify falcon_old builds and tests pass

Run `snforge test -p falcon_old` to confirm all inline tests and verify test pass.

### Step 7: Simplify falcon ntt.cairo

- Remove recursive `ntt()`, `intt()`, `split()`, `merge()`, `split_ntt()`, `merge_ntt()`
- Remove `mul_zq()`
- Simplify `ntt_fast()` to n=512 only (assert on length, call ntt_512 directly)
- Remove `ntt_constants` import
- Keep: `intt_with_hint`, `sub_zq`, `mul_ntt`

### Step 8: Remove ntt_constants.cairo from falcon

Delete `packages/falcon/src/ntt_constants.cairo` and remove from `lib.cairo`.

### Step 9: Simplify falcon zq.cairo

Remove legacy u16 wrappers: `add_mod_u16`, `sub_mod_u16`, `mul_mod_u16`.
Check if any fused ops are now unused (only used by removed recursive NTT) and remove them.

### Step 10: Simplify falcon falcon.cairo

Remove `verify_uncompressed()`. Keep `verify()`, `verify_with_msg_point()`, norm checking.

### Step 11: Update falcon tests

- Update test_ntt.cairo to use `falcon_old::ntt::ntt` as reference impl
- Update test_intt.cairo to use `falcon_old::ntt::intt` for hint generation
- Move verify_uncompressed tests to falcon_old
- Add `falcon_old` as dev-dependency in falcon's Scarb.toml

### Step 12: Final verification

Run all tests for both packages:
```bash
snforge test -p falcon_old
snforge test -p falcon
```

Verify `scarb execute` still works for benchmarks.
