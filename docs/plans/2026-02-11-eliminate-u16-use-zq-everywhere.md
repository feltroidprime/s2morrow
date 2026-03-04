# Eliminate u16 — Use Zq Everywhere

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all `u16` usage in the falcon package with `Zq = BoundedInt<0, 12288>`, eliminating redundant `from_u16`/`to_u16` conversions at every function boundary.

**Architecture:** Currently, all internal arithmetic uses `Zq` but every function boundary converts `Span<u16> → Zq` at entry and `Zq → u16` at exit. Each `from_u16` is a range-check downcast. By using `Zq` as the canonical type in structs, function signatures, and return values, we eliminate ~1000+ redundant range checks per verify call. Where data enters as `felt252` (JSON deserialization, NTT bridge), downcast directly to `Zq`.

**Tech Stack:** Cairo (Scarb), BoundedInt, snforge for testing.

**Key constraints:**
- `ntt_constants.cairo`: Keep const arrays as `[u16; N]` — BoundedInt likely can't appear in const fixed-size arrays. Convert in `get_even_roots`/`get_even_roots_inv` accessors.
- `ntt_felt252.cairo`: Auto-generated, operates on `felt252`. Don't touch. Bridge conversion changes in `ntt_fast()`.
- Serde for `Zq` must be implemented so `#[derive(Serde)]` on structs with `Array<Zq>` fields still works.
- Inline test data (large `[u16; N]` arrays) stays as `[u16; N]` — convert at test boundary with a helper.

---

### Task 1: Foundation — Add Serde and felt252 utilities to zq.cairo

**Files:**
- Modify: `packages/falcon/src/zq.cairo`

**Step 1: Add `to_felt252` and `from_felt252` conversion utilities**

Below the existing `to_u16` function (~line 46), add:

```cairo
/// Convert Zq to felt252 (free upcast chain, no range check)
#[inline(always)]
pub fn to_felt252(x: Zq) -> felt252 {
    let wide: u32 = upcast(x);
    wide.into()
}

/// Convert felt252 to Zq (range check — use at deserialization boundaries)
#[inline(always)]
pub fn from_felt252(x: felt252) -> Zq {
    let u: u16 = x.try_into().expect('felt252 > u16');
    downcast(u).expect('value exceeds Q-1')
}
```

Note: Zq → u32 upcast avoids touching u16. The `from_felt252` goes felt252 → u16 → Zq internally. If a direct felt252 → Zq downcast path exists in the compiler, prefer that instead.

**Step 2: Add Serde implementation for Zq**

Add after the conversion utilities section:

```cairo
// =============================================================================
// Serde implementation for Zq (enables #[derive(Serde)] on structs with Array<Zq>)
// =============================================================================

impl ZqSerde of Serde<Zq> {
    fn serialize(self: @Zq, ref output: Array<felt252>) {
        output.append(to_felt252(*self));
    }
    fn deserialize(ref serialized: Span<felt252>) -> Option<Zq> {
        let felt_val: felt252 = Serde::deserialize(ref serialized)?;
        let u: u16 = felt_val.try_into()?;
        downcast(u)
    }
}
```

**Step 3: Run `snforge test -p falcon` to verify existing tests still pass (non-breaking additions)**

Expected: all tests pass unchanged.

**Step 4: Commit**

```bash
git add packages/falcon/src/zq.cairo
git commit -m "feat(falcon/zq): add Serde impl and felt252 conversion utilities for Zq"
```

---

### Task 2: Change types.cairo — All struct fields from u16 to Zq

**Files:**
- Modify: `packages/falcon/src/types.cairo`

**Step 1: Update types.cairo**

```cairo
use falcon::zq::Zq;

#[derive(Drop, Serde)]
pub struct FalconPublicKey {
    pub h_ntt: Array<Zq>, // 512 values, NTT domain
}

#[derive(Drop, Serde)]
pub struct FalconSignature {
    pub s1: Array<Zq>,
    pub salt: Array<felt252>,
}

#[derive(Drop, Serde)]
pub struct FalconVerificationHint {
    pub mul_hint: Array<Zq>, // INTT(s1_ntt * pk_ntt)
}

#[derive(Drop, Serde)]
pub struct FalconSignatureWithHint {
    pub signature: FalconSignature,
    pub hint: FalconVerificationHint,
}

pub trait HashToPoint<H> {
    fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<Zq>;
}
```

Note: `#[derive(Serde)]` still works because `Zq` now has a Serde impl (Task 1), and `Array<T: Serde>` automatically gets Serde.

**Step 2: Do NOT run tests yet** — compilation will fail until downstream modules are updated. Proceed to Task 3.

---

### Task 3: Change hash_to_point.cairo — Return Array<Zq> directly

**Files:**
- Modify: `packages/falcon/src/hash_to_point.cairo`

**Step 1: Change extraction functions to append Zq directly**

In all `extract_*` functions, change the output array type and remove `upcast::<Zq, u16>()`:

```cairo
fn extract_6_from_low(value: u128, ref coeffs: Array<Zq>) {
    let (q1, r0) = bounded_int_div_rem(value, nz_q());
    coeffs.append(r0);  // r0 is already Zq (RemT = Zq)
    let (q2, r1) = bounded_int_div_rem(q1, nz_q());
    coeffs.append(r1);
    let (q3, r2) = bounded_int_div_rem(q2, nz_q());
    coeffs.append(r2);
    let (q4, r3) = bounded_int_div_rem(q3, nz_q());
    coeffs.append(r3);
    let (q5, r4) = bounded_int_div_rem(q4, nz_q());
    coeffs.append(r4);
    let (_q6, r5) = bounded_int_div_rem(q5, nz_q());
    coeffs.append(r5);
}
```

Apply the same pattern to `extract_6_from_high`, `extract_2_from_high`, `extract_12_from_felt252`, `extract_8_from_felt252`.

**Step 2: Update hash_to_point return type**

```cairo
pub impl PoseidonHashToPointImpl of HashToPoint<PoseidonHashToPoint> {
    fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<Zq> {
        // ... (absorb logic unchanged) ...
        let mut coeffs: Array<Zq> = array![];
        // ... (squeeze logic unchanged, extraction functions now append Zq) ...
        coeffs
    }
}
```

**Step 3: Remove the `upcast` import** if no longer used (it was only imported for `upcast::<Zq, u16>`). Keep `downcast` for FeltHigh conversion.

---

### Task 4: Change packing.cairo — Accept/return Span<Zq> and Array<Zq>

**Files:**
- Modify: `packages/falcon/src/packing.cairo`

**Step 1: Replace the `v()` helper**

The `v()` helper currently downcasts u16 → Zq. With `Span<Zq>` input, it just dereferences:

```cairo
#[inline(always)]
fn v(vals: Span<Zq>, i: usize) -> Zq {
    *vals.at(i)
}
```

Or remove `v()` entirely and use `*vals.at(i)` directly in `pack_9`. (Removing is cleaner since it served no purpose beyond the downcast.)

**Step 2: Change `pack_9` signature**

```cairo
fn pack_9(vals: Span<Zq>) -> u128 {
    // Body stays the same — uses v(vals, i) which now returns Zq directly
    // Or if v() is removed, use *vals.at(i) everywhere
    ...
}
```

**Step 3: Change `unpack_9` to output Array<Zq>**

```cairo
fn unpack_9(packed: u128, count: usize, ref output: Array<Zq>) {
    // ... same DivRem chain, but change all:
    //   output.append(upcast::<Zq, u16>(r0));
    // to:
    //   output.append(r0);
    // And the final acc0 line:
    //   output.append(acc0);  // acc0 is already Zq (= Acc0 = Zq)
    ...
}
```

**Step 4: Change public API signatures**

```cairo
pub fn pack_public_key(values: Span<Zq>) -> Array<felt252> {
    // Body unchanged (uses pack_9 which now takes Span<Zq>)
    ...
}

pub fn unpack_public_key(packed: Span<felt252>) -> Array<Zq> {
    let mut output: Array<Zq> = array![];
    // Body unchanged (unpack_9 now appends Zq to output)
    ...
}
```

**Step 5: Remove unused imports** (`upcast` if no longer needed).

---

### Task 5: Change ntt_constants.cairo — Return Zq from accessors

**Files:**
- Modify: `packages/falcon/src/ntt_constants.cairo`

**Strategy:** Keep all const arrays as `[u16; N]` (BoundedInt can't appear in const fixed-size arrays). Change accessor functions to return `Array<Zq>` by converting at the boundary.

**Step 1: Add import and conversion helper**

```cairo
use falcon::zq::{Zq, from_u16};

fn convert_roots(roots: Span<u16>) -> Array<Zq> {
    let mut result: Array<Zq> = array![];
    for r in roots {
        result.append(from_u16(*r));
    };
    result
}
```

**Step 2: Change `get_even_roots` return type**

```cairo
pub fn get_even_roots(degree: u32) -> Array<Zq> {
    if degree == 2 {
        convert_roots(phi4_roots_zq.span())
    } else if degree == 4 {
        convert_roots(phi8_roots_zq.span())
    // ... same pattern for all degrees ...
    } else {
        panic!("not implemented");
        array![]
    }
}
```

**Step 3: Same change for `get_even_roots_inv`**

```cairo
pub fn get_even_roots_inv(degree: u32) -> Array<Zq> {
    // Same pattern as get_even_roots, using _inv const arrays
    ...
}
```

**Note:** This changes the return type from `Span<u16>` to `Array<Zq>`. Callers in ntt.cairo must update accordingly (call `.span()` on the result, and no longer need `from_u16` on each root).

---

### Task 6: Change ntt.cairo — All functions use Span<Zq>

**Files:**
- Modify: `packages/falcon/src/ntt.cairo`

This is the largest change. Every function signature changes from `Span<u16>` to `Span<Zq>`, and all `from_u16`/`to_u16` wrappers are removed.

**Step 1: Update imports**

Remove `from_u16`, `to_u16` from the zq import. Add `from_felt252` and `Zq`:

```cairo
use crate::zq::{
    Zq, add_mod, from_felt252, fused_add_mul_mod, fused_i2_add_mod,
    fused_i2_diff_sqr1inv_mod, fused_i2_sub_mul_mod, fused_i2_sum_mod,
    fused_sqr1_mul_mod, fused_sub_mul_mod, mul_mod, sub_mod, to_felt252,
};
```

**Step 2: Change `sub_zq`**

```cairo
pub fn sub_zq(mut f: Span<Zq>, mut g: Span<Zq>) -> Array<Zq> {
    assert(f.len() == g.len(), 'f.len() != g.len()');
    let mut res: Array<Zq> = array![];
    while let Some(f_coeff) = f.pop_front() {
        let g_coeff = g.pop_front().unwrap();
        res.append(sub_mod(*f_coeff, *g_coeff));
    };
    res
}
```

Note: return `Array<Zq>` instead of `Span<Zq>` for ownership. All callers use `.span()`.

**Step 3: Change `mul_ntt`**

```cairo
pub fn mul_ntt(mut f: Span<Zq>, mut g: Span<Zq>) -> Array<Zq> {
    assert(f.len() == g.len(), 'f.len() != g.len()');
    let mut res: Array<Zq> = array![];
    while let Some(f_coeff) = f.pop_front() {
        let g_coeff = g.pop_front().unwrap();
        res.append(mul_mod(*f_coeff, *g_coeff));
    };
    res
}
```

**Step 4: Change `ntt_fast` — the felt252 bridge**

```cairo
pub fn ntt_fast(f: Span<Zq>) -> Array<Zq> {
    if f.len() != 512 {
        return ntt(f);
    }
    // Convert Zq -> felt252
    let mut felt_input: Array<felt252> = array![];
    for val in f {
        felt_input.append(to_felt252(*val));
    };
    // Call fast unrolled NTT (operates on felt252)
    let result = ntt_512(felt_input.span());
    // Convert felt252 -> Zq directly
    let mut zq_result: Array<Zq> = array![];
    for val in result.span() {
        zq_result.append(from_felt252(*val));
    };
    zq_result
}
```

**Step 5: Change `intt_with_hint`**

```cairo
pub fn intt_with_hint(f_ntt: Span<Zq>, result_hint: Span<Zq>) -> Span<Zq> {
    assert(f_ntt.len() == result_hint.len(), 'length mismatch');
    let roundtrip = ntt_fast(result_hint);
    let mut f_iter = f_ntt;
    let mut r_iter = roundtrip.span();
    while let Some(f_val) = f_iter.pop_front() {
        assert(f_val == r_iter.pop_front().unwrap(), 'intt hint mismatch');
    };
    result_hint
}
```

**Step 6: Change `mul_zq`**

```cairo
pub fn mul_zq(f: Span<Zq>, g: Span<Zq>) -> Array<Zq> {
    let f_ntt = ntt_fast(f);
    let g_ntt = ntt_fast(g);
    let res_ntt = mul_ntt(f_ntt.span(), g_ntt.span());
    intt(res_ntt.span())
}
```

**Step 7: Change `split_ntt` — uses roots from constants**

```cairo
pub fn split_ntt(mut f_ntt: Span<Zq>) -> (Array<Zq>, Array<Zq>) {
    let n = f_ntt.len();
    let roots_inv_arr = get_even_roots_inv(n);
    let mut roots_inv = roots_inv_arr.span();
    let mut f0_ntt: Array<Zq> = array![];
    let mut f1_ntt: Array<Zq> = array![];

    while let Some(root_inv) = roots_inv.pop_front() {
        let even = *f_ntt.pop_front().unwrap();
        let odd = *f_ntt.pop_front().unwrap();
        f0_ntt.append(fused_i2_add_mod(even, odd));
        f1_ntt.append(fused_i2_sub_mul_mod(even, odd, *root_inv));
    };
    (f0_ntt, f1_ntt)
}
```

No `from_u16` calls — `even`, `odd`, and `root_inv` are all already `Zq`.

**Step 8: Change `merge_ntt`**

```cairo
pub fn merge_ntt(mut f0_ntt: Span<Zq>, mut f1_ntt: Span<Zq>) -> Array<Zq> {
    assert(f0_ntt.len() == f1_ntt.len(), 'f0_ntt.len() != f1_ntt.len()');
    let n = 2 * f0_ntt.len();
    let roots_arr = get_even_roots(n);
    let mut roots = roots_arr.span();
    let mut f_ntt: Array<Zq> = array![];

    while let Some(root) = roots.pop_front() {
        let f0 = *f0_ntt.pop_front().unwrap();
        let f1 = *f1_ntt.pop_front().unwrap();
        f_ntt.append(fused_add_mul_mod(f0, *root, f1));
        f_ntt.append(fused_sub_mul_mod(f0, *root, f1));
    };
    f_ntt
}
```

**Step 9: Change `split`, `merge`**

```cairo
pub fn split(mut f: Span<Zq>) -> (Array<Zq>, Array<Zq>) {
    let mut f0: Array<Zq> = array![];
    let mut f1: Array<Zq> = array![];
    while let Some(even) = f.pop_front() {
        let odd = f.pop_front().unwrap();
        f0.append(*even);
        f1.append(*odd);
    };
    (f0, f1)
}

pub fn merge(mut f0: Span<Zq>, mut f1: Span<Zq>) -> Array<Zq> {
    let mut f: Array<Zq> = array![];
    while let Some(f0_val) = f0.pop_front() {
        let f1_val = f1.pop_front().unwrap();
        f.append(*f0_val);
        f.append(*f1_val);
    };
    f
}
```

**Step 10: Change `ntt` (recursive)**

```cairo
pub fn ntt(mut f: Span<Zq>) -> Array<Zq> {
    let n = f.len();
    if n > 2 {
        let (f0, f1) = split(f);
        let f0_ntt = ntt(f0.span());
        let f1_ntt = ntt(f1.span());
        merge_ntt(f0_ntt.span(), f1_ntt.span())
    } else if n == 2 {
        let f0 = *f.pop_front().unwrap();
        let f1 = *f.pop_front().unwrap();
        let f1_j = fused_sqr1_mul_mod(f1);
        let even = add_mod(f0, f1_j);
        let odd = sub_mod(f0, f1_j);
        array![even, odd]
    } else {
        assert(false, 'n is not a power of 2');
        array![]
    }
}
```

**Step 11: Change `intt` (recursive)**

```cairo
pub fn intt(mut f_ntt: Span<Zq>) -> Array<Zq> {
    let n = f_ntt.len();
    if n > 2 {
        let (f0_ntt, f1_ntt) = split_ntt(f_ntt);
        let f0 = intt(f0_ntt.span());
        let f1 = intt(f1_ntt.span());
        merge(f0.span(), f1.span())
    } else if n == 2 {
        let a = *f_ntt.pop_front().unwrap();
        let b = *f_ntt.pop_front().unwrap();
        let even = fused_i2_sum_mod(a, b);
        let odd = fused_i2_diff_sqr1inv_mod(a, b);
        array![even, odd]
    } else {
        assert(false, 'n is not a power of 2');
        array![]
    }
}
```

**Ownership note:** Functions now return `Array<Zq>` (owned) instead of `Span<Zq>`. Callers that chain results must call `.span()`. This is the idiomatic Cairo pattern — avoids dangling references.

---

### Task 7: Change falcon.cairo — Verify functions use Zq

**Files:**
- Modify: `packages/falcon/src/falcon.cairo`

**Step 1: Update imports and constants**

```cairo
use crate::ntt::{mul_zq, sub_zq, ntt_fast, mul_ntt, intt_with_hint};
use crate::zq::Zq;
use falcon::types::{FalconPublicKey, FalconSignatureWithHint, HashToPoint};
use corelib_imports::bounded_int::upcast;

const HALF_Q: u32 = 6145;
const Q_U32: u32 = 12289;
```

**Step 2: Change `verify_uncompressed`**

```cairo
pub fn verify_uncompressed<const N: u32>(
    s1: Span<Zq>, pk: Span<Zq>, msg_point: Span<Zq>, n: u32,
) -> Result<(), FalconVerificationError> {
    assert(s1.len() == n, 'unexpected s1 length');
    assert(pk.len() == n, 'unexpected pk length');
    assert(msg_point.len() == n, 'unexpected msg length');

    let s1_x_h = mul_zq(s1, pk);
    let s0 = sub_zq(msg_point, s1_x_h.span());

    let norm = extend_euclidean_norm(extend_euclidean_norm(0, s0.span())?, s1)?;
    if norm > sig_bound(n) {
        return Result::Err(FalconVerificationError::NormOverflow);
    }
    Result::Ok(())
}
```

**Step 3: Change `extend_euclidean_norm`**

```cairo
fn extend_euclidean_norm(mut acc: u32, mut f: Span<Zq>) -> Result<u32, FalconVerificationError> {
    let mut res = Ok(0);
    while let Some(f_coeff) = f.pop_front() {
        match norm_square_and_add(acc, *f_coeff) {
            Some(res) => acc = res,
            None => {
                res = Result::Err(FalconVerificationError::NormOverflow);
                break;
            },
        }
    };
    match res {
        Ok(_) => Ok(acc),
        Err(e) => Err(e),
    }
}
```

**Step 4: Change `norm_square_and_add`**

```cairo
fn norm_square_and_add(acc: u32, x: Zq) -> Option<u32> {
    let x_u32: u32 = upcast(x);  // Zq → u32 (free upcast, no range check)
    let x_centered: u32 = if x_u32 < HALF_Q {
        x_u32
    } else {
        Q_U32 - x_u32
    };
    match x_centered.checked_mul(x_centered) {
        Some(x_sq) => acc.checked_add(x_sq),
        None => None,
    }
}
```

**Step 5: Update `verify_with_msg_point`**

```cairo
pub fn verify_with_msg_point(
    pk: @FalconPublicKey,
    sig_with_hint: FalconSignatureWithHint,
    msg_point: Span<Zq>,
) -> bool {
    let s1 = sig_with_hint.signature.s1.span();
    let pk_ntt = pk.h_ntt.span();
    let mul_hint = sig_with_hint.hint.mul_hint.span();
    // ... (assertions and logic same, but types are now Span<Zq>) ...
    let s1_ntt = ntt_fast(s1);
    let product_ntt = mul_ntt(s1_ntt.span(), pk_ntt);
    let product = intt_with_hint(product_ntt.span(), mul_hint);
    let s0 = sub_zq(msg_point, product);
    // ... norm check using extend_euclidean_norm(norm, s0.span()) ...
    // ... and extend_euclidean_norm(norm, s1) ...
    norm <= SIG_BOUND_512
}
```

**Step 6: Update inline test in falcon.cairo**

The `test_falcon1024_verify_uncompressed` test has inline `[u16; 1024]` arrays. Add a conversion helper and use it:

```cairo
#[cfg(test)]
mod tests {
    use super::*;
    use falcon::zq::from_u16;

    fn to_zq_span(s: Span<u16>) -> Array<Zq> {
        let mut result: Array<Zq> = array![];
        for v in s { result.append(from_u16(*v)); };
        result
    }

    #[test]
    fn test_falcon1024_verify_uncompressed() {
        let pk: [u16; 1024] = [ /* ... same data ... */ ];
        let s1: [u16; 1024] = [ /* ... same data ... */ ];
        let msg_point: [u16; 1024] = [ /* ... same data ... */ ];

        let pk_zq = to_zq_span(pk.span());
        let s1_zq = to_zq_span(s1.span());
        let mp_zq = to_zq_span(msg_point.span());

        if let Err(e) = verify_uncompressed::<1024>(s1_zq.span(), pk_zq.span(), mp_zq.span(), 1024) {
            println!("Error: {:?}", e);
            assert!(false);
        }
    }
}
```

---

### Task 8: Change ntt.cairo inline tests

**Files:**
- Modify: `packages/falcon/src/ntt.cairo` (the `#[cfg(test)]` module at bottom)

**Step 1: Add conversion helper to test module**

```cairo
#[cfg(test)]
mod tests {
    use super::*;
    use falcon::zq::from_u16;

    fn zq_arr(vals: Array<u16>) -> Array<Zq> {
        let mut result: Array<Zq> = array![];
        for v in vals.span() { result.append(from_u16(*v)); };
        result
    }
    // ...
}
```

**Step 2: Update each test**

For each test (test_ntt_4 through test_ntt_512, test_split_ntt), change:
- Input: `let f = zq_arr(array![1, 2, 3, 4]);`
- Expected: `let expected = zq_arr(array![4229, 4647, 1973, 1444]);`
- Assertions: `assert_eq!(f_ntt.span(), expected.span());`
- For tests using `[u16; N]` syntax: `let f_raw: [u16; N] = [...]; let f = zq_arr(f_raw.into());`

Example:
```cairo
#[test]
fn test_ntt_4() {
    let f = zq_arr(array![1, 2, 3, 4]);
    let f_ntt = ntt(f.span());
    let expected = zq_arr(array![4229, 4647, 1973, 1444]);
    assert_eq!(f_ntt.span(), expected.span());

    let f_intt = intt(f_ntt.span());
    assert_eq!(f_intt.span(), f.span());
}
```

---

### Task 9: Update integration test files

**Files:**
- Modify: `packages/falcon/tests/test_cross_language.cairo`
- Modify: `packages/falcon/tests/test_verify.cairo`
- Modify: `packages/falcon/tests/test_verify_hint.cairo`
- Modify: `packages/falcon/tests/test_packing.cairo`
- Modify: `packages/falcon/tests/test_hash_to_point.cairo`
- Modify: `packages/falcon/tests/test_ntt.cairo`
- Modify: `packages/falcon/tests/test_intt.cairo`

**General pattern for all test files:**

1. Change struct field types from `Array<u16>` to `Array<Zq>` in test-local structs
2. Change comparison assertions to use `Zq` spans
3. Where felt252 test data is converted to u16 (e.g., `(*val).try_into().unwrap()`), convert to Zq instead: `from_felt252(*val)`

**test_cross_language.cairo:**

```cairo
use falcon::zq::Zq;

#[derive(Drop, Serde)]
struct HashToPointTest {
    message: Array<felt252>,
    salt: Array<felt252>,
    expected: Array<Zq>,  // was Array<u16>
}

#[derive(Drop, Serde)]
struct PackingTest {
    values: Array<Zq>,    // was Array<u16>
    packed: Array<felt252>,
}

#[derive(Drop, Serde)]
struct VerifyTest {
    message: Array<felt252>,
    salt: Array<felt252>,
    pk_ntt: Array<Zq>,    // was Array<u16>
    s1: Array<Zq>,        // was Array<u16>
    mul_hint: Array<Zq>,  // was Array<u16>
}
```

Tests then work directly with Zq — no conversion needed since Serde handles deserialization.

**test_verify.cairo:**

Change the `Attestation` struct:
```cairo
struct Attestation {
    s1: Array<Zq>,
    pk: Array<Zq>,
    msg_point: Array<Zq>,
}
```

**test_packing.cairo:**

Inline u16 arrays → convert with helper:
```cairo
use falcon::zq::{Zq, from_u16};

fn to_zq(vals: Span<u16>) -> Array<Zq> {
    let mut r: Array<Zq> = array![];
    for v in vals { r.append(from_u16(*v)); };
    r
}
```

Then use `to_zq(values.span())` for pack input and compare unpack output against Zq arrays.

**test_ntt.cairo and test_intt.cairo:**

Currently converts `felt252 → u16`. Change to `felt252 → Zq` via `from_felt252`:
```cairo
use falcon::zq::{Zq, from_felt252};

// Instead of: let u16_val: u16 = (*val).try_into().unwrap();
// Use:        let zq_val: Zq = from_felt252(*val);
```

**test_hash_to_point.cairo:**

Hash output is now `Array<Zq>`. Update range checks:
```cairo
// Instead of: assert!(v < 12289, ...);
// Use:        // No check needed — Zq type guarantees [0, 12288]
```

---

### Task 10: Clean up zq.cairo — Remove legacy API

**Files:**
- Modify: `packages/falcon/src/zq.cairo`

**Step 1: Remove legacy u16 wrapper functions**

Delete `add_mod_u16`, `sub_mod_u16`, `mul_mod_u16` (lines ~340-353). These were marked "NOT for hot paths" and are now unused.

**Step 2: Audit `from_u16` and `to_u16` usage**

- `from_u16`: still needed for NTT constant conversion (Task 5) and test helpers. **Keep**.
- `to_u16`: check if any remaining usages exist. If not, remove. If still needed in tests or edge cases, keep.

**Step 3: Remove the `fused_i2_sub_mul_mod` use of `from_u16`**

Line 262: `let i2_diff = mul_mod(from_u16(6145), diff);`
Line 332: `fused_i2_sub_mul_mod(a, b, from_u16(10810))`

These use `from_u16` to create Zq from literal constants. Replace with the BoundedInt constant directly:

```cairo
// In fused_i2_sub_mul_mod:
let i2_diff = mul_mod(I2_CONST_ZQ, diff);  // where I2_CONST_ZQ: Zq = downcast(6145_u16).unwrap()

// Or simply keep from_u16 for these constants since it's compile-time evaluable
```

If the compiler can constant-fold `from_u16(6145)`, leave it. Otherwise, define typed constants.

**Step 4: Run full test suite**

```bash
snforge test -p falcon
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add packages/falcon/
git commit -m "refactor(falcon): eliminate u16 — use Zq (BoundedInt<0, 12288>) everywhere"
```

---

### Task 11: Profile and verify performance improvement

**Step 1: Profile verify with the benchmarking skill**

```bash
python3 .claude/skills/benchmarking-cairo/profile.py profile \
  --mode snforge \
  --package falcon \
  --test test_verify_matches_rust \
  --name verify-zq-everywhere \
  --metric steps
```

**Step 2: Compare against baseline**

Baseline (before this change): **215,279 steps**

Expected improvement:
- Eliminated ~1024+ `from_u16` range checks (in NTT, verify, sub_zq, mul_ntt)
- Eliminated ~1024+ `to_u16` upcasts (free but still generate instructions)
- Expect 5-15% step reduction from removed conversions

**Step 3: Read the PNG and compare hotspot distribution**

The `store_temp` percentage should decrease since we're storing fewer intermediate values. The `downcast` and `u16_try_from_felt252` costs should drop significantly — these were from `from_u16` calls.

---

## Compilation order

Changes span all source files. The recommended implementation order ensures minimal time in a broken state:

1. **Task 1** (zq.cairo additions) — compiles, tests pass
2. **Tasks 2-7** (types + all source modules) — apply as one batch, then compile
3. **Tasks 8-9** (all tests) — apply, then run full test suite
4. **Task 10** (cleanup) — remove dead code
5. **Task 11** (profile) — verify performance win

Tasks 2-7 must be applied together since types.cairo changes break all downstream modules simultaneously. Within this batch, the order doesn't matter — they all need to change before compilation succeeds.
