# Felt252 Compilation Mode for Circuit Generator

## Overview

Add a `felt252` compilation mode to `BoundedIntCircuit` that generates native felt252 arithmetic instead of BoundedInt operations. This produces simpler, more efficient Cairo code when bounds stay below 2^128.

## Motivation

For NTT-512 with Q=12289, all intermediate values stay well within felt252's safe range. Using native `+`, `-`, `*` operators instead of BoundedInt with helper impls reduces code complexity and gas costs.

## Design

### API

```python
circuit.compile(mode="bounded")   # default - current behavior
circuit.compile(mode="felt252")   # new - native felt252 arithmetic
```

### Validation

In felt252 mode, the generator validates that all intermediate bounds stay below 2^128. If any variable exceeds this limit, compilation fails with a clear error:

```python
def _validate_felt252_mode(self) -> None:
    max_abs = max(abs(v.min_bound), abs(v.max_bound)
                  for v in self.variables.values())
    if max_abs >= 2**128:
        raise ValueError(f"Bounds exceed 2^128, cannot use felt252 mode")
```

### Reduction Strategy

Reduction only happens at outputs, using a precomputed shift constant:

1. Track worst-case negative bound during circuit generation
2. Compute `SHIFT = ceil(|min_bound| / Q) * Q`
3. At each output:
   ```cairo
   let shifted: ShiftedT = (value + SHIFT).try_into().unwrap();
   let (_, remainder) = bounded_int_div_rem(shifted, nz_q);
   let result: felt252 = upcast(remainder);
   ```

### Generated Code Structure

```cairo
// Auto-generated - DO NOT EDIT
use corelib_imports::bounded_int::{
    BoundedInt, upcast, bounded_int_div_rem, DivRemHelper, UnitInt,
};

// felt252 constants for arithmetic
const SQR1: felt252 = 1479;
const W4_0: felt252 = ...;
// ... all twiddle factors

// Reduction machinery
const SHIFT: felt252 = 516138;  // precomputed from worst-case negative
type QConst = UnitInt<12289>;
const nz_q: NonZero<QConst> = 12289;
type ShiftedT = BoundedInt<0, MAX>;
type RemT = BoundedInt<0, 12288>;

impl DivRem_ShiftedT_QConst of DivRemHelper<ShiftedT, QConst> {
    type DivT = BoundedInt<0, QMAX>;
    type RemT = RemT;
}

pub fn ntt_512_inner(f0: felt252, f1: felt252, ...) -> (felt252, felt252, ...) {
    // Native felt252 arithmetic
    let tmp_0 = f0 * SQR1;
    let tmp_1 = f1 + tmp_0;
    // ... hundreds of native operations ...

    // Output reductions
    let r0: ShiftedT = (tmp_final_0 + SHIFT).try_into().unwrap();
    let (_, r0_rem) = bounded_int_div_rem(r0, nz_q);
    let r0: felt252 = upcast(r0_rem);
    // ... repeat for each output

    (r0, r1, ..., r511)
}

pub fn ntt_512(mut f: Array<felt252>) -> Array<felt252> {
    let mut f_span = f.span();
    let boxed = f_span.multi_pop_front::<512>().expect('expected 512 elements');
    let [f0, f1, ...] = boxed.unbox();

    let (r0, r1, ...) = ntt_512_inner(f0, f1, ...);

    array![r0, r1, ..., r511]
}
```

### Key Differences from Bounded Mode

| Aspect | Bounded Mode | Felt252 Mode |
|--------|--------------|--------------|
| Type aliases | One per bound combination | Only for reduction types |
| Helper impls | AddHelper, SubHelper, MulHelper | Only DivRemHelper |
| Operations | Explicit typed `add()`, `sub()`, `mul()` | Native `+`, `-`, `*` |
| Intermediate reductions | As needed to stay in bounds | None |
| Output reductions | Per-output with individual shifts | Single SHIFT for all outputs |
| Constants | Typed `UnitInt<N>` | Plain `felt252` |

## Implementation

### Changes to `circuit.py`

1. Add `mode` parameter to `compile()`:
   ```python
   def compile(self, mode: str = "bounded") -> str:
       if mode == "felt252":
           self._validate_felt252_mode()
           return self._compile_felt252()
       return self._compile_bounded()
   ```

2. Add validation method `_validate_felt252_mode()`

3. Add shift computation `_compute_shift() -> int`

4. Add felt252 generation methods:
   - `_generate_felt252_imports()`
   - `_generate_felt252_constants()`
   - `_generate_felt252_function()`
   - `_generate_felt252_op()`

### Changes to `ntt.py`

1. Add `mode` parameter to `generate()` and `generate_full()`
2. Adjust wrapper function signature for felt252 mode (`Array<felt252>`)

### Output Files

Two separate files:
- `packages/falcon/src/ntt_bounded_int.cairo` - Current BoundedInt version
- `packages/falcon/src/ntt_felt252.cairo` - New felt252 version

### Makefile

Update `regenerate-ntt` target:

```makefile
regenerate-ntt:
	python -m hydra.compilable_circuits.regenerate ntt --n 512 --mode bounded
	python -m hydra.compilable_circuits.regenerate ntt --n 512 --mode felt252
```

## Testing

1. Verify felt252 output compiles with `scarb build`
2. Run existing NTT tests against both implementations
3. Compare outputs for correctness (should be identical)
4. Benchmark both versions to measure improvement
