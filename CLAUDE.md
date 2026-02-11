# Project Guidelines

## Cairo Tooling

**Always use ASDF.** Versions pinned in `.tool-versions`.

**Dependencies:** Use `snforge_std` + `assert_macros`. Never `cairo_test` (they conflict).

```toml
[dev-dependencies]
snforge_std = { git = "https://github.com/foundry-rs/starknet-foundry", tag = "v0.55.0" }
assert_macros = "2.15.1"
```

**Running executables:**
```bash
# NTT benchmark (felt252 mode)
scarb execute --executable-name bench_ntt_bounded_int \
  --arguments-file packages/falcon/tests/data/ntt_input_512.json \
  --print-resource-usage --save-profiler-trace-data
```

**Profiling:** Use `/benchmarking-cairo` skill. Note: snforge may hit "cycle during cost computation" errors with large BoundedInt code—use `scarb execute` instead.

**BoundedInt optimization:** Use `/cairo-coding` skill. Regenerate NTT with:
```bash
python -m cairo_gen.circuits.regenerate ntt --n 512
```

## snforge Test Data Loading

**Always use `Serde::deserialize` to load JSON test data.** Never use manual index arithmetic with `read_json` — the snforge object wrapper makes manual offsets error-prone and failures are silent when comparing two implementations on the same (wrong) input.

```cairo
#[derive(Drop, Serde)]
struct MyData { input: Array<felt252> }

fn load_data(path: ByteArray) -> Span<felt252> {
    let file = FileTrait::new(path);
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front(); // skip snforge object wrapper
    let data: MyData = Serde::deserialize(ref span).expect('deser fail');
    data.input.span()
}
```

See `test_cross_language.cairo` for the canonical example with nested structs.

## Falcon Package Architecture

`packages/falcon/` — Falcon-512 post-quantum signature verification for Starknet.

### Source modules
| File | Purpose |
|------|---------|
| `types.cairo` | `FalconPublicKey`, `FalconSignature`, `FalconSignatureWithHint`, `HashToPoint` trait |
| `zq.cairo` | BoundedInt `Zq` type ([0, 12288]), modular arithmetic (`add_mod`, `sub_mod`, `mul_mod`) |
| `packing.cairo` | Base-Q packing: 512 Zq values ↔ 29 felt252 storage slots (9 values per u128, 18 per felt252) |
| `hash_to_point.cairo` | Poseidon hash_to_point: `poseidon_hash_span(msg \|\| salt)` → seed, 22 squeeze permutations → 512 Zq |
| `falcon.cairo` | `verify<H>()` (hint-based, 2 NTTs), `verify_with_msg_point()`, norm checking |
| `ntt.cairo` | `sub_zq`, `mul_ntt`, `ntt_fast` (unrolled, n=512 only), `intt_with_hint` |
| `ntt_felt252.cairo` | Auto-generated unrolled NTT (fastest, use `/cairo-coding` to regenerate) |

### Companion Rust crate: `falcon-rs`

Located at `../falcon-rs/`. Generates test vectors consumed by Cairo tests.

**Regenerate test vectors:**
```bash
cd ../falcon-rs && cargo test generate_ -- --nocapture
```

This writes JSON files to `packages/falcon/tests/data/`:
- `hash_to_point_test_int.json` — Poseidon hash_to_point reference output
- `packing_test_int.json` — Base-Q packing roundtrip data
- `verify_test_int.json` — End-to-end verify with Poseidon (keypair, s1, mul_hint)

**Serialization format:** snforge-compatible JSON with integer values (not strings). Large felt252s use `serde_json` `arbitrary_precision` feature with `Number::from_string_unchecked`.

### Key design decisions

**Hash-to-point algorithm:**
1. Absorb via `poseidon_hash_span(message || salt)` → single felt252 seed
2. Squeeze: `state = (seed, 0, 0)`, 21 full hades_permutation rounds (extract 24 coeffs each from s0+s1) + 1 partial round (extract 8 from s0 only)
3. Base-Q extraction: felt252 → u256 → split low u128 + high FeltHigh → 6 DivRem-by-Q each → 12 Zq per felt252

**Hint-based verification (2 NTTs, 0 INTTs):**
- Off-chain: compute `mul_hint = INTT(NTT(s1) * pk_ntt)` and pass as hint
- On-chain: compute `NTT(s1)`, pointwise multiply by `pk_ntt`, verify `NTT(mul_hint) == product_ntt` (1 NTT), then `s0 = msg_point - mul_hint`, check norm

**BoundedInt throughout:** `Zq = BoundedInt<0, 12288>`, all arithmetic stays in BoundedInt types to avoid runtime overflow checks. Use `Q_CONST: UnitInt<12289>` as the single modulus constant.

## Falcon_Old Package

`packages/falcon_old/` — Legacy u16-based Falcon implementation for reference testing.

### Source modules
| File | Purpose |
|------|---------|
| `zq.cairo` | u16 modular arithmetic: `add_mod`, `sub_mod`, `mul_mod`, `mul3_mod` |
| `ntt.cairo` | Recursive NTT/INTT for arbitrary degrees: `ntt`, `intt`, `mul_zq`, `sub_zq`, `mul_ntt`, `split`, `merge` |
| `ntt_constants.cairo` | Precomputed twiddle factors for recursive NTT |
| `falcon.cairo` | `verify_uncompressed<const N>()` with norm checking for all degrees |

### Usage

`falcon_old` is a dev-dependency of `falcon`. Tests in `packages/falcon/tests/` use it as reference:
- `test_ntt.cairo`: compares `ntt_fast` (unrolled) against `falcon_old::ntt::ntt` (recursive)
- `test_verify.cairo`: runs `falcon_old::falcon::verify_uncompressed` on test vectors
- `test_verify_hint.cairo`: uses `falcon_old::ntt::intt` for hint generation
