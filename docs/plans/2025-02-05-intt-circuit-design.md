# INTT Circuit Generator Design

## Overview

Add an INTT (Inverse Number Theoretic Transform) circuit generator alongside the existing NTT generator. Output felt252 mode only.

## Algorithm

**Constants:**
- `Q = 12289`
- `I2 = 6145` (inverse of 2 mod Q)
- `INV_SQR1 = inv_mod_q[1479]` (inverse of sqrt(-1))
- Inverse twiddle factors computed at generation time via `inv_mod_q[roots_dict_Zq[size][2*i]]`

**Base case (n=2):**
```
f0 = i2 * (f_ntt[0] + f_ntt[1])
f1 = i2 * inv_sqr1 * (f_ntt[0] - f_ntt[1])
```

**Recursive structure:**
```
intt(f_ntt):
    if n == 2: return base_case
    f0_ntt, f1_ntt = split_ntt(f_ntt)  # inverse butterfly with arithmetic
    f0 = intt(f0_ntt)
    f1 = intt(f1_ntt)
    return merge([f0, f1])  # interleave indices (compile-time only)
```

**split_ntt (inverse butterfly):**
```
f0_ntt[i] = i2 * (f_ntt[2i] + f_ntt[2i+1])
f1_ntt[i] = i2 * (f_ntt[2i] - f_ntt[2i+1]) * inv_w[2i]
```

## Implementation

### Files to create

**`hydra/compilable_circuits/intt.py`:**
```python
class InttCircuitGenerator:
    Q = 12289
    I2 = 6145
    SQR1 = 1479
    INV_SQR1 = inv_mod_q[1479]

    def __init__(self, n: int = 512)
    def _register_constants(self)
    def _intt_base_case(self, f0, f1)
    def _split_ntt(self, f_ntt, size)
    def _merge(self, f0, f1)  # compile-time interleave
    def _intt(self, f_ntt)
    def generate(self, mode="felt252")
    def generate_full(self, mode="felt252")
```

### Files to modify

**`hydra/compilable_circuits/regenerate.py`:**
- Add INTT case alongside NTT
- Output to `intt_felt252.cairo`

**`Makefile`:**
```makefile
regenerate-ntt:
	python3 -m hydra.compilable_circuits.regenerate ntt --n 512 --mode felt252

regenerate-intt:
	python3 -m hydra.compilable_circuits.regenerate intt --n 512 --mode felt252

regenerate-all:
	python3 -m hydra.compilable_circuits.regenerate all --n 512 --mode felt252
```

### Generated output

`packages/falcon/src/intt_felt252.cairo`:
```cairo
pub fn intt_512_inner(f0: felt252, ..., f511: felt252) -> (felt252, ...)
pub fn intt_512(mut f: Array<felt252>) -> Array<felt252>
```

## Testing

Verify circuit correctness by comparing `InttCircuitGenerator.simulate()` against Python reference `intt()` before generating Cairo.
