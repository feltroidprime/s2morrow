# Falcon-512 Production-Ready Design

**Date:** 2026-02-11
**Goal:** Push `packages/falcon/` to production-ready for Falcon-512 signature verification on Starknet (account abstraction).

## Overview

Two workstreams:
1. **Cairo** (`packages/falcon/`): clean structs, hint-based verify, base-Q packing, Poseidon hash_to_point
2. **Rust** (`falcon-rs/`): matching Poseidon, hint generation, packing, serialization CLI

Account abstraction constraint: same class hash across accounts means the public key lives in **storage**, requiring efficient packing (512 Zq values into felt252 slots).

---

## Section 1: Structs & Verify Function

### Structs

```cairo
#[derive(Drop, Serde)]
struct FalconPublicKey {
    h_ntt: Array<u16>,  // 512 values, NTT domain
}

#[derive(Drop, Serde)]
struct FalconSignature {
    s1: Array<u16>,
    salt: Array<felt252>,
}

#[derive(Drop, Serde)]
struct FalconVerificationHint {
    mul_hint: Array<u16>,  // INTT(s1_ntt * pk_ntt), provided by Rust tooling
}

#[derive(Drop, Serde)]
struct FalconSignatureWithHint {
    signature: FalconSignature,
    hint: FalconVerificationHint,
}
```

Inspired by garaga's `ECDSASignatureWithHint` pattern: signature bundled with computation hints.

### HashToPoint Trait

```cairo
trait HashToPoint<H> {
    fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<u16>;
}
```

### Verify Function

```cairo
fn verify<H, +HashToPoint<H>, +Drop<H>>(
    pk: @FalconPublicKey,
    sig_with_hint: FalconSignatureWithHint,
    message: Span<felt252>,
) -> bool {
    // 1. msg_point = H::hash_to_point(message, sig.salt.span())
    // 2. s1_ntt = ntt_fast(sig.s1.span())              — 1st NTT
    // 3. product_ntt = mul_ntt(s1_ntt, pk.h_ntt.span())
    // 4. product = intt_with_hint(product_ntt, hint.mul_hint.span())  — 2nd NTT (verify hint)
    // 5. s0 = sub_zq(msg_point, product)
    // 6. norm_check(s0, s1) <= SIG_BOUND (34034726 for Falcon-512)
}
```

**Cost:** 2 NTTs, 0 INTTs. Reuses existing `ntt_fast`, `mul_ntt`, `sub_zq`, `intt_with_hint` from `ntt.cairo`. Existing `verify_uncompressed` kept as reference.

---

## Section 2: Base-Q Packing Module

### Design

Pack 512 Zq values (each in [0, 12288]) as polynomials in base Q = 12289:

```
felt252 = v0 + v1*Q + v2*Q^2 + ... + v17*Q^17
```

DivRem by Q gives `RemT = Zq` directly — **zero downcasts** needed.

### Layout

- 9 values per u128 half (Q^9 ≈ 2^122.3 < 2^128)
- 18 values per felt252 (low u128 + high u128)
- **29 storage slots** for 512 values (28 full + 1 partial with 8 values)

### Accumulator Type Chain

Shared between Horner packing and DivRem unpacking. AccN max = Q^(N+1) - 1:

```
Acc0 = Zq                          = BoundedInt<0, 12288>
Acc1 = BoundedInt<0, 151019520>                              // Q^2 - 1
Acc2 = BoundedInt<0, 1855878893568>                          // Q^3 - 1
Acc3 = BoundedInt<0, 22806895723069440>                      // Q^4 - 1
Acc4 = BoundedInt<0, 280273941540800360448>                  // Q^5 - 1
Acc5 = BoundedInt<0, 3444286467594895629557760>              // Q^6 - 1
Acc6 = BoundedInt<0, 42326836400273672391635324928>          // Q^7 - 1
Acc7 = BoundedInt<0, 520154492522963160020806508052480>      // Q^8 - 1
Acc8 = BoundedInt<0, 6392178558614694273495691177456939008>  // Q^9 - 1
```

### Packing (Horner)

```cairo
// acc = v_i + Q * acc_prev
acc = add(v, mul(Q_CONST, acc_prev))
```

Uses `MulHelper<QConst, AccN>` and `AddHelper<Zq, MulQAccN>` at each level.

### Unpacking (DivRem chain)

```cairo
let (acc_prev, v_i) = bounded_int_div_rem(acc, nz_q());
// acc_prev: AccN-1, v_i: Zq
```

Uses `DivRemHelper<AccN, QConst>` → `(DivT = AccN-1, RemT = Zq)`.

### Type Count

40 definitions total per u128 half:
- 8 AccN types (Acc1–Acc8, Acc0 = Zq reused)
- 8 MulQAccN intermediate types
- 8 MulHelper impls
- 8 AddHelper impls
- 8 DivRemHelper impls

`QConst`, `nz_q()`, `Zq` all reused from existing `zq.cairo`.

---

## Section 3: HashToPoint — Poseidon XOF with Base-Q Extraction

### Architecture

1. Poseidon sponge (rate=2, capacity=1) in XOF mode
2. Absorb: message + salt
3. Squeeze: permute, extract 12 Zq coefficients from each of s0 and s1 (24 per permutation)
4. Extraction: felt252 → u256 → (low u128, high u128) → 6 DivRem-by-Q per half → 12 Zq per felt252

### Why Base-Q Instead of b-bit Limbs

| | b-bit limb → mod Q | Base-Q DivRem |
|---|---|---|
| Coeffs/felt252 | 4 (b=64) | **12** |
| Squeeze perms | 64 | **22** (2.9x fewer) |
| Extra mod Q step | Yes | **No** (RemT = Zq) |

Same security: each coefficient comes from reducing a ≥50-bit value mod Q (per Renyi analysis, ≤0.37 bits loss at b=50).

### Renyi Safety Analysis

From u128 (128 bits), repeated DivRem by Q ≈ 13.585 bits per coefficient:

| Coeff | Input bits | Safe (≥50)? |
|-------|-----------|-------------|
| 1 | 128.0 | yes |
| 2 | 114.4 | yes |
| 3 | 100.8 | yes |
| 4 | 87.2 | yes |
| 5 | 73.6 | yes |
| 6 | 60.0 | yes |
| 7 | 46.5 | **no** (discard) |

6 safe coefficients per u128 half → 12 per felt252 → 24 per squeeze permutation.

### Two Separate DivRem Chains

The high u128 from `u128s_from_felt252` is bounded by the Stark prime:

```
P = 2^251 + 17 * 2^192 + 1
high_max = (P - 1) >> 128 = 10633823966279327296825105735305134080   (124 bits)
```

This is tighter than u128 (128 bits), so we use two separate type chains with exact bounds.

**LOW chain (u128, 128 bits → 6 Zq):**

```cairo
// Starting type: u128

type ExtractLQ1 = BoundedInt<0, 27689996494502275487295516920153650>;     // 115 bits
type ExtractLQ2 = BoundedInt<0, 2253234314793903123711898195146>;         // 101 bits
type ExtractLQ3 = BoundedInt<0, 183353756594833031468133956>;             // 88 bits
type ExtractLQ4 = BoundedInt<0, 14920152705251284194656>;                 // 74 bits
type ExtractLQ5 = BoundedInt<0, 1214106331292317047>;                     // 61 bits
type ExtractLQ6 = BoundedInt<0, 98796186125178>;                          // 47 bits (discarded)

impl DivRemLQ0 of DivRemHelper<u128, QConst>       { type DivT = ExtractLQ1; type RemT = Zq; }
impl DivRemLQ1 of DivRemHelper<ExtractLQ1, QConst>  { type DivT = ExtractLQ2; type RemT = Zq; }
impl DivRemLQ2 of DivRemHelper<ExtractLQ2, QConst>  { type DivT = ExtractLQ3; type RemT = Zq; }
impl DivRemLQ3 of DivRemHelper<ExtractLQ3, QConst>  { type DivT = ExtractLQ4; type RemT = Zq; }
impl DivRemLQ4 of DivRemHelper<ExtractLQ4, QConst>  { type DivT = ExtractLQ5; type RemT = Zq; }
impl DivRemLQ5 of DivRemHelper<ExtractLQ5, QConst>  { type DivT = ExtractLQ6; type RemT = Zq; }
```

**HIGH chain (FeltHigh, 124 bits → 6 Zq):**

```cairo
type FeltHigh = BoundedInt<0, 10633823966279327296825105735305134080>;    // 124 bits

type ExtractHQ1 = BoundedInt<0, 865312390453196134496306105891865>;       // 110 bits
type ExtractHQ2 = BoundedInt<0, 70413572337309474692514126933>;           // 96 bits
type ExtractHQ3 = BoundedInt<0, 5729804893588532402352846>;               // 83 bits
type ExtractHQ4 = BoundedInt<0, 466254772039102644833>;                   // 69 bits
type ExtractHQ5 = BoundedInt<0, 37940822852884908>;                       // 56 bits
type ExtractHQ6 = BoundedInt<0, 3087380816411>;                           // 42 bits (discarded)

impl DivRemHQ0 of DivRemHelper<FeltHigh, QConst>    { type DivT = ExtractHQ1; type RemT = Zq; }
impl DivRemHQ1 of DivRemHelper<ExtractHQ1, QConst>  { type DivT = ExtractHQ2; type RemT = Zq; }
impl DivRemHQ2 of DivRemHelper<ExtractHQ2, QConst>  { type DivT = ExtractHQ3; type RemT = Zq; }
impl DivRemHQ3 of DivRemHelper<ExtractHQ3, QConst>  { type DivT = ExtractHQ4; type RemT = Zq; }
impl DivRemHQ4 of DivRemHelper<ExtractHQ4, QConst>  { type DivT = ExtractHQ5; type RemT = Zq; }
impl DivRemHQ5 of DivRemHelper<ExtractHQ5, QConst>  { type DivT = ExtractHQ6; type RemT = Zq; }
```

One `downcast(high)` from u128 → FeltHigh per felt252 (44 total, negligible vs hades cost).

**Type count:** 12 quotient types + 1 FeltHigh + 12 DivRemHelper impls = **25 definitions**.

### XOF Construction

```cairo
use core::poseidon::hades_permutation;

fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<u16> {
    let (mut s0, mut s1, mut s2): (felt252, felt252, felt252) = (0, 0, 0);

    // Absorb message then salt (rate=2: pairs per permutation)
    absorb(ref s0, ref s1, ref s2, message);
    absorb(ref s0, ref s1, ref s2, salt);
    s2 += 1;  // domain separation before squeeze

    // Squeeze: permute → extract 12 coefficients from each of s0, s1
    let mut coeffs: Array<u16> = array![];
    loop {
        let (ns0, ns1, ns2) = hades_permutation(s0, s1, s2);
        s0 = ns0; s1 = ns1; s2 = ns2;
        extract_12_from_felt252(s0, ref coeffs);
        if coeffs.len() >= 512 { break; }
        extract_12_from_felt252(s1, ref coeffs);
        if coeffs.len() >= 512 { break; }
    };
    // Truncate to exactly 512 via slice
    ...
}

fn absorb(ref s0: felt252, ref s1: felt252, ref s2: felt252, mut input: Span<felt252>) {
    loop {
        match input.pop_front() {
            Option::None => { break; },
            Option::Some(first) => {
                let second = match input.pop_front() {
                    Option::Some(v) => *v,
                    Option::None => 1,  // pad
                };
                let (ns0, ns1, ns2) = hades_permutation(s0 + *first, s1 + second, s2);
                s0 = ns0; s1 = ns1; s2 = ns2;
            }
        }
    };
}
```

### Extraction

```cairo
fn extract_12_from_felt252(value: felt252, ref coeffs: Array<u16>) {
    match u128s_from_felt252(value) {
        U128sFromFelt252Result::Narrow(low) => {
            extract_6_from_low(low, ref coeffs);
        },
        U128sFromFelt252Result::Wide((high, low)) => {
            extract_6_from_low(low, ref coeffs);
            let high_bounded: FeltHigh = downcast(high).unwrap();
            extract_6_from_high(high_bounded, ref coeffs);
        },
    }
}

fn extract_6_from_low(value: u128, ref coeffs: Array<u16>) {
    let (q1, r0) = bounded_int_div_rem(value, nz_q_extract());
    coeffs.append(upcast::<Zq, u16>(r0));

    let (q2, r1) = bounded_int_div_rem(q1, nz_q_extract());
    coeffs.append(upcast::<Zq, u16>(r1));

    let (q3, r2) = bounded_int_div_rem(q2, nz_q_extract());
    coeffs.append(upcast::<Zq, u16>(r2));

    let (q4, r3) = bounded_int_div_rem(q3, nz_q_extract());
    coeffs.append(upcast::<Zq, u16>(r3));

    let (q5, r4) = bounded_int_div_rem(q4, nz_q_extract());
    coeffs.append(upcast::<Zq, u16>(r4));

    let (_q6, r5) = bounded_int_div_rem(q5, nz_q_extract());
    coeffs.append(upcast::<Zq, u16>(r5));
}
// extract_6_from_high: identical structure, uses HIGH chain types
```

### Permutation Budget

- Absorption: ~2 permutations (typical 3-element input: tx hash + 2 salt)
- Squeeze: 22 permutations
- **Total: ~24 hades_permutation calls**

---

## Section 4: Rust Tooling (falcon-rs)

### Dependencies

```toml
[dependencies]
lambdaworks-crypto = "0.13"
lambdaworks-math = "0.13"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Imports (matching garaga pattern)

```rust
use lambdaworks_crypto::hash::poseidon::starknet::PoseidonCairoStark252;
use lambdaworks_crypto::hash::poseidon::Poseidon;
use lambdaworks_math::field::element::FieldElement;
use lambdaworks_math::field::fields::fft_friendly::stark_252_prime_field::Stark252PrimeField;

type Felt = FieldElement<Stark252PrimeField>;
```

### 4.1 `src/poseidon_hash.rs` — PoseidonHash

Same XOF construction as Cairo. Base-Q extraction is trivial in Rust:

```rust
const Q: u64 = 12289;

pub struct PoseidonHash;

impl PoseidonHash {
    pub fn hash_to_point(message: &[Felt], salt: &[Felt]) -> [u16; 512] {
        let mut state = [Felt::zero(); 3];

        absorb(&mut state, message);
        absorb(&mut state, salt);
        state[2] += Felt::one();  // domain separation

        let mut coeffs = [0u16; 512];
        let mut idx = 0;
        while idx < 512 {
            PoseidonCairoStark252::hades_permutation(&mut state);
            idx += extract_12_from_felt(&state[0], &mut coeffs, idx);
            if idx >= 512 { break; }
            idx += extract_12_from_felt(&state[1], &mut coeffs, idx);
        }
        coeffs
    }
}

fn absorb(state: &mut [Felt; 3], input: &[Felt]) {
    let mut iter = input.iter();
    loop {
        match iter.next() {
            None => break,
            Some(first) => {
                state[0] += *first;
                match iter.next() {
                    Some(second) => state[1] += *second,
                    None => state[1] += Felt::one(),
                }
                PoseidonCairoStark252::hades_permutation(state);
            }
        }
    }
}

fn extract_12_from_felt(value: &Felt, out: &mut [u16; 512], start: usize) -> usize {
    let bytes = value.to_bytes_be();
    let high = u128::from_be_bytes(bytes[0..16].try_into().unwrap());
    let low = u128::from_be_bytes(bytes[16..32].try_into().unwrap());
    let mut count = 0;
    count += extract_6_from_u128(low, out, start + count);
    count += extract_6_from_u128(high, out, start + count);
    count
}

fn extract_6_from_u128(mut value: u128, out: &mut [u16; 512], start: usize) -> usize {
    for i in 0..6 {
        if start + i >= 512 { return i; }
        out[start + i] = (value % Q as u128) as u16;
        value /= Q as u128;
    }
    6
}
```

### 4.2 `src/hints.rs` — Verification Hint Generation

```rust
pub fn generate_mul_hint(s1: &[u16; 512], pk_h_ntt: &[u16; 512]) -> [u16; 512] {
    let s1_ntt = ntt(s1);
    let product_ntt: [i32; 512] = std::array::from_fn(|i| {
        ((s1_ntt[i] as i64 * pk_h_ntt[i] as i64) % Q as i64) as i32
    });
    let product = intt(&product_ntt);
    std::array::from_fn(|i| product[i].rem_euclid(Q as i32) as u16)
}

pub fn generate_signature_with_hint(
    s1: &[u16; 512],
    salt: &[Felt],
    pk_h_ntt: &[u16; 512],
) -> FalconSignatureWithHint {
    let mul_hint = generate_mul_hint(s1, pk_h_ntt);
    FalconSignatureWithHint {
        signature: FalconSignature { s1: s1.to_vec(), salt: salt.to_vec() },
        hint: FalconVerificationHint { mul_hint: mul_hint.to_vec() },
    }
}
```

### 4.3 `src/packing.rs` — Base-Q Public Key Packing

```rust
const VALS_PER_U128: usize = 9;
const VALS_PER_FELT: usize = 18;
const PACKED_SLOTS: usize = 29;  // ceil(512 / 18)

pub fn pack_public_key(h_ntt: &[u16; 512]) -> Vec<Felt> {
    h_ntt.chunks(VALS_PER_FELT).map(|chunk| {
        let (lo_vals, hi_vals) = chunk.split_at(chunk.len().min(VALS_PER_U128));
        let lo = horner_pack(lo_vals);
        let hi = horner_pack(hi_vals);
        // felt252 = lo + hi * 2^128
        Felt::from(lo) + Felt::from(hi) * TWO_POW_128
    }).collect()
}

fn horner_pack(values: &[u16]) -> u128 {
    let mut acc: u128 = 0;
    for &v in values.iter().rev() {
        acc = acc * Q as u128 + v as u128;
    }
    acc
}

pub fn unpack_public_key(packed: &[Felt]) -> Vec<u16> {
    // Reverse: split each felt252 into u128 halves, DivRem by Q chain
    ...
}
```

### 4.4 `src/serialize.rs` — Output Formats

**snforge JSON** (matches Cairo Serde deserialization with `pop_front` header skip):

```rust
pub fn to_snforge_json(sig: &FalconSignatureWithHint) -> serde_json::Value {
    let mut payload: Vec<String> = Vec::new();
    // s1 array: [length, elem0, ...]
    payload.push(sig.signature.s1.len().to_string());
    for v in &sig.signature.s1 { payload.push(v.to_string()); }
    // salt array
    payload.push(sig.signature.salt.len().to_string());
    for s in &sig.signature.salt { payload.push(s.to_string()); }
    // mul_hint array
    payload.push(sig.hint.mul_hint.len().to_string());
    for v in &sig.hint.mul_hint { payload.push(v.to_string()); }

    json!({ "signature_with_hint": payload })
}
```

**Starknet calldata** (flat felt252 array for invoke transactions):

```rust
pub fn to_calldata(sig: &FalconSignatureWithHint) -> Vec<Felt> {
    let mut calldata = Vec::new();
    serialize_u16_array(&sig.signature.s1, &mut calldata);
    serialize_felt_array(&sig.signature.salt, &mut calldata);
    serialize_u16_array(&sig.hint.mul_hint, &mut calldata);
    calldata
}
```

### 4.5 `src/bin/falcon_tool.rs` — CLI

```
falcon-tool generate-keypair                     → (sk.json, pk_packed.json)
falcon-tool sign --sk sk.json --message <felt>   → signature_with_hint.json
falcon-tool generate-test-data                   → all test vectors for Cairo snforge
```

Test vectors generated:
- `hash_to_point_test.json` — (message, salt) → expected 512 coefficients
- `packing_test.json` — 512 Zq values → 29 packed felt252 → roundtrip
- `verify_test.json` — full FalconSignatureWithHint + public key + expected result

### 4.6 HashToPoint Trait Update

Generalize for both byte-based (Shake256) and field-based (Poseidon) inputs:

```rust
pub trait HashToPoint {
    type Input;
    type Salt;
    fn hash_to_point(message: &[Self::Input], salt: &[Self::Salt]) -> [i16; 512];
}

impl HashToPoint for Shake256Hash {
    type Input = u8;
    type Salt = u8;
    // existing impl
}

impl HashToPoint for PoseidonHash {
    type Input = Felt;
    type Salt = Felt;
    // Section 4.1 impl
}
```

Preserves `Falcon<Shake256Hash>` for standard Falcon, adds `Falcon<PoseidonHash>` for Starknet.

### New Rust Modules Summary

| Module | Purpose | Key dependency |
|--------|---------|---------------|
| `poseidon_hash.rs` | Poseidon XOF hash_to_point | `lambdaworks-crypto` |
| `hints.rs` | Generate FalconVerificationHint | existing NTT/INTT |
| `packing.rs` | Base-Q pack/unpack 512 Zq → 29 felt252 | `lambdaworks-math` |
| `serialize.rs` | snforge JSON + Starknet calldata | `serde_json` |
| `bin/falcon_tool.rs` | CLI for keygen/sign/test-data | all above |
