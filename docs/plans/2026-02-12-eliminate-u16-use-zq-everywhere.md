# Eliminate u16 — Use Zq Everywhere

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all `u16` usage in the falcon package with `Zq = BoundedInt<0, 12288>`. The only place `u16 → Zq` conversion should exist is in test files for interop with `falcon_old`.

**Why:** Every function boundary currently converts `Span<u16> → Zq` at entry and `Zq → u16` at exit. Each `from_u16` is a range-check downcast. The generated `ntt_felt252.cairo` produces `Zq` internally then upcasts to `felt252`, and `ntt_fast` downcasts it back. This wastes ~1024 range checks per NTT call.

**Key design decisions:**
- `nz_q` becomes `pub const NZ_Q` (not a function)
- Generated `ntt_felt252.cairo` imports `Zq`/`QConst`/`NZ_Q` from `crate::zq` — no local `RemT` or `QConst` aliases
- Generated `ntt_512_inner` returns `(Zq, Zq, ...)` directly (no upcast to `felt252`)
- Generated wrapper `ntt_512` takes `Span<felt252>`, returns `Array<Zq>`
- `Serde<Zq>` downcasts `felt252 → Zq` directly (no `u16` intermediate)

---

### Task 1: Foundation — zq.cairo changes

**Files:** `packages/falcon/src/zq.cairo`

**Step 1: Change `nz_q` from function to const**

Replace:
```cairo
pub fn nz_q() -> NonZero<QConst> {
    12289
}
```
With:
```cairo
pub const NZ_Q: NonZero<QConst> = 12289;
```

Update all call sites in `zq.cairo` (`add_mod`, `sub_mod`, `mul_mod`): `nz_q()` → `NZ_Q`.

**Step 2: Add Serde<Zq>**

```cairo
impl ZqSerde of Serde<Zq> {
    fn serialize(self: @Zq, ref output: Array<felt252>) {
        let wide: u32 = upcast(*self);
        output.append(wide.into());
    }
    fn deserialize(ref serialized: Span<felt252>) -> Option<Zq> {
        let felt_val: felt252 = Serde::deserialize(ref serialized)?;
        let u: u16 = felt_val.try_into()?;
        downcast(u)
    }
}
```

Note: `deserialize` goes `felt252 → u16 → Zq`. If a direct `felt252 → BoundedInt` downcast path exists, prefer that.

**Step 3: Run `snforge test -p falcon`** — existing tests should pass (non-breaking additions).

---

### Task 2: Change types.cairo

**Files:** `packages/falcon/src/types.cairo`

```cairo
use falcon::zq::Zq;

#[derive(Drop, Serde)]
pub struct FalconPublicKey {
    pub h_ntt: Array<Zq>,
}

#[derive(Drop, Serde)]
pub struct FalconSignature {
    pub s1: Array<Zq>,
    pub salt: Array<felt252>,
}

#[derive(Drop, Serde)]
pub struct FalconVerificationHint {
    pub mul_hint: Array<Zq>,
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

Do NOT run tests yet — downstream modules must be updated first.

---

### Task 3: Change hash_to_point.cairo

**Files:** `packages/falcon/src/hash_to_point.cairo`

All extraction functions change output type from `Array<u16>` to `Array<Zq>` and drop `upcast::<Zq, u16>()`. The `bounded_int_div_rem` remainder is already `Zq` — just append it directly.

```cairo
fn extract_6_from_low(value: u128, ref coeffs: Array<Zq>) {
    let (q1, r0) = bounded_int_div_rem(value, NZ_Q);
    coeffs.append(r0);
    let (q2, r1) = bounded_int_div_rem(q1, NZ_Q);
    coeffs.append(r1);
    // ... same pattern, all append(rN) with no upcast
}
```

Same change for `extract_6_from_high`, `extract_2_from_high`, `extract_12_from_felt252`, `extract_8_from_felt252`.

Update `PoseidonHashToPointImpl`:
```cairo
fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<Zq> {
    // ... absorb unchanged ...
    let mut coeffs: Array<Zq> = array![];
    // ... squeeze unchanged, extraction functions now append Zq ...
    coeffs
}
```

Remove `upcast` from imports if no longer used.

---

### Task 4: Change packing.cairo

**Files:** `packages/falcon/src/packing.cairo`

**`v()` helper** — no longer needs downcast:
```cairo
fn v(vals: Span<Zq>, i: usize) -> Zq {
    *vals.at(i)
}
```
Or remove `v()` entirely and use `*vals.at(i)` inline.

**`pack_9`** — signature changes to `fn pack_9(vals: Span<Zq>) -> u128`. Body unchanged (already uses `v()` which returns `Zq`).

**`unpack_9`** — output changes to `Array<Zq>`, drop all `upcast::<Zq, u16>()`:
```cairo
fn unpack_9(packed: u128, count: usize, ref output: Array<Zq>) {
    // ... same DivRem chain, but:
    //   output.append(upcast::<Zq, u16>(r0))  →  output.append(r0)
    //   output.append(upcast::<Zq, u16>(acc0)) →  output.append(acc0)
}
```

**Public API:**
```cairo
pub fn pack_public_key(values: Span<Zq>) -> Array<felt252> { ... }
pub fn unpack_public_key(packed: Span<felt252>) -> Array<Zq> { ... }
```

---

### Task 5: Change cairo_gen and regenerate ntt_felt252.cairo

**Files:**
- Modify: `cairo_gen/circuit.py` (generator)
- Modify: `cairo_gen/circuits/ntt.py` (wrapper generator)
- Regenerate: `packages/falcon/src/ntt_felt252.cairo`

#### 5a: circuit.py — `_generate_felt252_imports`

Change from:
```python
return """// Auto-generated felt252 mode - DO NOT EDIT
use core::num::traits::Zero;
use corelib_imports::bounded_int::{
    BoundedInt, upcast, bounded_int_div_rem, DivRemHelper, UnitInt,
};"""
```

To emit:
```cairo
// Auto-generated felt252 mode - DO NOT EDIT
use corelib_imports::bounded_int::{BoundedInt, DivRemHelper, bounded_int_div_rem};
use crate::zq::{Zq, QConst, NZ_Q};
```

No `upcast`, no `UnitInt`.

#### 5b: circuit.py — `_generate_felt252_constants`

Remove generation of:
- `type QConst = UnitInt<12289>;`
- `const nz_q: NonZero<QConst> = 12289;`
- `type RemT = BoundedInt<0, 12288>;`

Keep only:
- `const SHIFT: felt252 = ...;`
- `type ShiftedT = BoundedInt<0, ...>;`
- `DivRemHelper` impl with `type RemT = Zq;` (not `RemT`)

#### 5c: circuit.py — `_generate_felt252_function`

**Return type:** Change from `felt252` to `Zq`:
```python
# Old: return_type = "(" + ", ".join("felt252" for _ in self.outputs) + ")"
# New: return_type = "(" + ", ".join("Zq" for _ in self.outputs) + ")"
```

**Output reduction** — drop the upcast line, use `NZ_Q` instead of `nz_q`:
```python
# Old (3 lines per output):
lines.append(f"    let {out_name}: ShiftedT = ({src_name} + SHIFT).try_into().unwrap();")
lines.append(f"    let (_, {out_name}_rem) = bounded_int_div_rem({out_name}, nz_q);")
lines.append(f"    let {out_name}: felt252 = upcast({out_name}_rem);")

# New (2 lines per output):
lines.append(f"    let {out_name}: ShiftedT = ({src_name} + SHIFT).try_into().unwrap();")
lines.append(f"    let (_, {out_name}) = bounded_int_div_rem({out_name}, NZ_Q);")
```

#### 5d: ntt.py — `_generate_wrapper`

Change wrapper to accept `Span<felt252>` input and return `Array<Zq>`:

```cairo
pub fn ntt_512(mut f: Span<felt252>) -> Array<Zq> {
    let boxed = f.multi_pop_front::<512>().expect('expected 512 elements');
    let [f0, f1, ..., f511] = boxed.unbox();
    let (r0, r1, ..., r511) = ntt_512_inner(f0, f1, ..., f511);
    array![r0, r1, ..., r511]
}
```

#### 5e: Regenerate

```bash
python -m cairo_gen.circuits.regenerate ntt --n 512
```

---

### Task 6: Change ntt.cairo

**Files:** `packages/falcon/src/ntt.cairo`

All four functions change to `Span<Zq>` / `Array<Zq>`. Remove all `from_u16`/`to_u16` imports.

```cairo
use crate::ntt_felt252::ntt_512;
use crate::zq::{Zq, mul_mod, sub_mod};
use corelib_imports::bounded_int::upcast;

pub fn sub_zq(mut f: Span<Zq>, mut g: Span<Zq>) -> Array<Zq> {
    assert(f.len() == g.len(), 'f.len() != g.len()');
    let mut res: Array<Zq> = array![];
    while let Some(f_coeff) = f.pop_front() {
        let g_coeff = g.pop_front().unwrap();
        res.append(sub_mod(*f_coeff, *g_coeff));
    };
    res
}

pub fn mul_ntt(mut f: Span<Zq>, mut g: Span<Zq>) -> Array<Zq> {
    assert(f.len() == g.len(), 'f.len() != g.len()');
    let mut res: Array<Zq> = array![];
    while let Some(f_coeff) = f.pop_front() {
        let g_coeff = g.pop_front().unwrap();
        res.append(mul_mod(*f_coeff, *g_coeff));
    };
    res
}

pub fn ntt_fast(f: Span<Zq>) -> Array<Zq> {
    assert(f.len() == 512, 'ntt_fast requires n=512');
    let mut felt_input: Array<felt252> = array![];
    for val in f {
        let wide: u32 = upcast(*val);
        felt_input.append(wide.into());
    };
    ntt_512(felt_input.span())  // returns Array<Zq> directly
}

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

---

### Task 7: Change falcon.cairo

**Files:** `packages/falcon/src/falcon.cairo`

```cairo
use crate::ntt::{sub_zq, ntt_fast, mul_ntt, intt_with_hint};
use crate::zq::Zq;
use falcon::types::{FalconPublicKey, FalconSignatureWithHint, HashToPoint};
use corelib_imports::bounded_int::upcast;

const HALF_Q: u32 = 6145;
const Q_U32: u32 = 12289;

fn norm_square_and_add(acc: u32, x: Zq) -> Option<u32> {
    let x_u32: u32 = upcast(x);
    let x_centered: u32 = if x_u32 < HALF_Q { x_u32 } else { Q_U32 - x_u32 };
    match x_centered.checked_mul(x_centered) {
        Some(x_sq) => acc.checked_add(x_sq),
        None => None,
    }
}

fn extend_euclidean_norm(mut acc: u32, mut f: Span<Zq>) -> Result<u32, FalconVerificationError> {
    // ... same logic, takes Span<Zq> instead of Span<u16> ...
}

pub fn verify_with_msg_point(
    pk: @FalconPublicKey,
    sig_with_hint: FalconSignatureWithHint,
    msg_point: Span<Zq>,
) -> bool {
    // ... same logic, all types are Zq ...
    let s1_ntt = ntt_fast(s1);
    let product_ntt = mul_ntt(s1_ntt.span(), pk_ntt);
    let product = intt_with_hint(product_ntt.span(), mul_hint);
    let s0 = sub_zq(msg_point, product);
    // norm check on s0.span() and s1 ...
}
```

---

### Task 8: Update test files (only place u16→Zq conversion lives)

**Files:** All files in `packages/falcon/tests/`

**Pattern:** Test structs with `Array<Zq>` fields work via `Serde<Zq>` — no manual conversion needed for JSON-loaded data. For interop with `falcon_old` (which uses `u16`), add a conversion helper:

```cairo
use falcon::zq::{Zq, from_u16};

fn to_zq_span(s: Span<u16>) -> Array<Zq> {
    let mut r: Array<Zq> = array![];
    for v in s { r.append(from_u16(*v)); };
    r
}
```

This is the ONLY place `from_u16` is called in the entire codebase (outside `zq.cairo` itself).

**Test-specific changes:**
- `test_cross_language.cairo`: Struct fields become `Array<Zq>`, Serde handles it
- `test_verify.cairo` / `test_verify_hint.cairo`: Same pattern
- `test_ntt.cairo`: Use `to_zq_span` for interop comparisons with `falcon_old::ntt`
- `test_packing.cairo`: Input/output arrays become `Zq`
- `test_hash_to_point.cairo`: Output is `Array<Zq>`, range check assertions are unnecessary (type guarantees `[0, 12288]`)

---

### Task 9: Clean up zq.cairo

Remove `to_u16` if unused. Keep `from_u16` (used by test helpers and ntt_constants conversion in `falcon_old`). Remove any other dead code.

Run full test suite:
```bash
snforge test -p falcon
```

---

### Task 10: Profile and verify

Profile verify to measure step reduction from eliminated conversions:
```bash
scarb execute --executable-name bench_ntt_bounded_int \
  --arguments-file packages/falcon/tests/data/ntt_input_512.json \
  --print-resource-usage
```

Expected: measurable step reduction from removing ~1024 upcasts + ~1024 downcasts per NTT call.

---

## Compilation order

Tasks 2–7 must be applied together (types.cairo change breaks everything until all modules update). Recommended batch:

1. **Task 1** — zq.cairo additions (compiles, tests pass)
2. **Tasks 2–7** — all source modules as one batch
3. **Task 8** — all test files
4. **Task 9** — cleanup
5. **Task 10** — profile

## Files changed summary

| File | Nature |
|------|--------|
| `packages/falcon/src/zq.cairo` | Add `NZ_Q` const, `Serde<Zq>`, update call sites |
| `packages/falcon/src/types.cairo` | `Array<u16>` → `Array<Zq>` |
| `packages/falcon/src/hash_to_point.cairo` | Drop `upcast` on extraction, return `Array<Zq>` |
| `packages/falcon/src/packing.cairo` | `Span<Zq>` / `Array<Zq>` API, drop upcast/downcast |
| `packages/falcon/src/ntt_felt252.cairo` | **Regenerated** — imports `Zq` from `crate::zq`, returns `Zq` directly |
| `packages/falcon/src/ntt.cairo` | `Span<Zq>` / `Array<Zq>` API, no `from_u16`/`to_u16` |
| `packages/falcon/src/falcon.cairo` | All functions take `Zq`, norm check upcasts to `u32` |
| `cairo_gen/circuit.py` | Generator emits `Zq` imports, drops `RemT`/`upcast` |
| `cairo_gen/circuits/ntt.py` | Wrapper returns `Array<Zq>` |
| `packages/falcon/tests/*.cairo` | Test-only `u16 → Zq` conversion for `falcon_old` interop |
