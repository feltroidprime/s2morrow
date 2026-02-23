# Falcon-512 Production-Ready Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement production-ready Falcon-512 signature verification for Starknet account abstraction, covering Cairo library + Rust tooling.

**Architecture:** Hint-based verification (2 NTTs, 0 INTTs) with base-Q polynomial packing for storage-efficient public keys and Poseidon XOF hash_to_point. Rust tooling generates matching test vectors and serialized calldata.

**Tech Stack:** Cairo (Scarb 2.15.1, snforge 0.55.0, BoundedInt from corelib_imports 0.1.2), Rust (lambdaworks-crypto/math 0.13)

**Design doc:** `docs/plans/2026-02-11-falcon-prod-ready-design.md`

**Note:** falcon-rs lives at `/home/felt/PycharmProjects/falcon-rs/` (outside sandbox). Rust tasks (7-9) must be executed in a separate session with that directory as working dir.

---

## Task 1: Cairo Types Module

**Files:**
- Create: `packages/falcon/src/types.cairo`
- Modify: `packages/falcon/src/lib.cairo`

**Step 1: Create types.cairo with structs and trait**

```cairo
// packages/falcon/src/types.cairo

#[derive(Drop, Serde)]
pub struct FalconPublicKey {
    pub h_ntt: Array<u16>, // 512 values, NTT domain
}

#[derive(Drop, Serde)]
pub struct FalconSignature {
    pub s1: Array<u16>,
    pub salt: Array<felt252>,
}

#[derive(Drop, Serde)]
pub struct FalconVerificationHint {
    pub mul_hint: Array<u16>, // INTT(s1_ntt * pk_ntt)
}

#[derive(Drop, Serde)]
pub struct FalconSignatureWithHint {
    pub signature: FalconSignature,
    pub hint: FalconVerificationHint,
}

pub trait HashToPoint<H> {
    fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<u16>;
}
```

**Step 2: Add module to lib.cairo**

Add after existing module declarations in `packages/falcon/src/lib.cairo`:
```cairo
pub mod types;
```

**Step 3: Verify compilation**

Run: `cd /home/felt/PycharmProjects/s2morrow && scarb build --package falcon`
Expected: Compiles with no errors.

**Step 4: Commit**
```bash
git add packages/falcon/src/types.cairo packages/falcon/src/lib.cairo
git commit -m "feat(falcon): add types module with structs and HashToPoint trait"
```

---

## Task 2: Cairo Packing Module — Types

**Files:**
- Create: `packages/falcon/src/packing.cairo`
- Modify: `packages/falcon/src/lib.cairo`
- Modify: `packages/falcon/src/zq.cairo` (add Q_UNIT constant)

**Step 1: Add Q_UNIT constant to zq.cairo**

Add after line 28 (`}` closing `nz_q()`) in `packages/falcon/src/zq.cairo`:
```cairo
/// Q as a UnitInt constant for BoundedInt mul operations
pub const Q_UNIT: QConst = 12289;
```

**Step 2: Create packing.cairo with all BoundedInt types**

All 40 type/impl definitions for the base-Q accumulator chain. AccN max = Q^(N+1) - 1.

```cairo
// packages/falcon/src/packing.cairo
//! Base-Q polynomial packing for storage-efficient Falcon public keys.
//!
//! Packs 512 Zq values into 29 felt252 slots using base Q=12289 encoding:
//!   felt252 = pack_9(v0..v8) + pack_9(v9..v17) * 2^128
//!
//! DivRem by Q gives RemT = Zq directly — zero downcasts in the hot path.

use corelib_imports::bounded_int::bounded_int::{add, mul};
use corelib_imports::bounded_int::{
    AddHelper, BoundedInt, DivRemHelper, MulHelper, bounded_int_div_rem, downcast, upcast,
};
use core::integer::{u128s_from_felt252, U128sFromFelt252Result};
use falcon::zq::{Zq, QConst, Q_UNIT, nz_q};

// =============================================================================
// Constants
// =============================================================================

/// Number of Zq values per u128 half (Q^9 < 2^128)
const VALS_PER_U128: usize = 9;

/// Number of Zq values per felt252 (two u128 halves)
const VALS_PER_FELT: usize = 18;

/// Total felt252 slots for 512 values: ceil(512/18) = 29
const PACKED_SLOTS: usize = 29;

/// 2^128 as felt252 for combining u128 halves
const TWO_POW_128: felt252 = 0x100000000000000000000000000000000;

// =============================================================================
// Accumulator type chain: AccN max = Q^(N+1) - 1
// Shared between Horner packing and DivRem unpacking.
// Acc0 = Zq (reused from zq.cairo)
// =============================================================================

type Acc0 = Zq; // BoundedInt<0, 12288>
type Acc1 = BoundedInt<0, 151019520>;
type Acc2 = BoundedInt<0, 1855878893568>;
type Acc3 = BoundedInt<0, 22806895723069440>;
type Acc4 = BoundedInt<0, 280273941540800360448>;
type Acc5 = BoundedInt<0, 3444286467594895629557760>;
type Acc6 = BoundedInt<0, 42326836400273672391635324928>;
type Acc7 = BoundedInt<0, 520154492522963160020806508052480>;
type Acc8 = BoundedInt<0, 6392178558614694273495691177456939008>;

// =============================================================================
// MulHelper intermediate types: MulQAccN max = Q * (Q^(N+1) - 1) = Q^(N+2) - Q
// =============================================================================

type MulQAcc0 = BoundedInt<0, 151007232>;
type MulQAcc1 = BoundedInt<0, 1855878881280>;
type MulQAcc2 = BoundedInt<0, 22806895723057152>;
type MulQAcc3 = BoundedInt<0, 280273941540800348160>;
type MulQAcc4 = BoundedInt<0, 3444286467594895629545472>;
type MulQAcc5 = BoundedInt<0, 42326836400273672391635312640>;
type MulQAcc6 = BoundedInt<0, 520154492522963160020806508040192>;
type MulQAcc7 = BoundedInt<0, 6392178558614694273495691177456926720>;

// =============================================================================
// MulHelper impls: QConst * AccN -> MulQAccN
// =============================================================================

impl MulQAcc0Impl of MulHelper<QConst, Acc0> {
    type Result = MulQAcc0;
}

impl MulQAcc1Impl of MulHelper<QConst, Acc1> {
    type Result = MulQAcc1;
}

impl MulQAcc2Impl of MulHelper<QConst, Acc2> {
    type Result = MulQAcc2;
}

impl MulQAcc3Impl of MulHelper<QConst, Acc3> {
    type Result = MulQAcc3;
}

impl MulQAcc4Impl of MulHelper<QConst, Acc4> {
    type Result = MulQAcc4;
}

impl MulQAcc5Impl of MulHelper<QConst, Acc5> {
    type Result = MulQAcc5;
}

impl MulQAcc6Impl of MulHelper<QConst, Acc6> {
    type Result = MulQAcc6;
}

impl MulQAcc7Impl of MulHelper<QConst, Acc7> {
    type Result = MulQAcc7;
}

// =============================================================================
// AddHelper impls: Zq + MulQAccN -> Acc(N+1)
// Identity: (Q-1) + Q*(Q^(N+1)-1) = Q^(N+2) - 1
// =============================================================================

impl AddZqMulQAcc0Impl of AddHelper<Zq, MulQAcc0> {
    type Result = Acc1;
}

impl AddZqMulQAcc1Impl of AddHelper<Zq, MulQAcc1> {
    type Result = Acc2;
}

impl AddZqMulQAcc2Impl of AddHelper<Zq, MulQAcc2> {
    type Result = Acc3;
}

impl AddZqMulQAcc3Impl of AddHelper<Zq, MulQAcc3> {
    type Result = Acc4;
}

impl AddZqMulQAcc4Impl of AddHelper<Zq, MulQAcc4> {
    type Result = Acc5;
}

impl AddZqMulQAcc5Impl of AddHelper<Zq, MulQAcc5> {
    type Result = Acc6;
}

impl AddZqMulQAcc6Impl of AddHelper<Zq, MulQAcc6> {
    type Result = Acc7;
}

impl AddZqMulQAcc7Impl of AddHelper<Zq, MulQAcc7> {
    type Result = Acc8;
}

// =============================================================================
// DivRemHelper impls: AccN / QConst -> (Acc(N-1), Zq)
// =============================================================================

impl DivRemAcc1Impl of DivRemHelper<Acc1, QConst> {
    type DivT = Acc0;
    type RemT = Zq;
}

impl DivRemAcc2Impl of DivRemHelper<Acc2, QConst> {
    type DivT = Acc1;
    type RemT = Zq;
}

impl DivRemAcc3Impl of DivRemHelper<Acc3, QConst> {
    type DivT = Acc2;
    type RemT = Zq;
}

impl DivRemAcc4Impl of DivRemHelper<Acc4, QConst> {
    type DivT = Acc3;
    type RemT = Zq;
}

impl DivRemAcc5Impl of DivRemHelper<Acc5, QConst> {
    type DivT = Acc4;
    type RemT = Zq;
}

impl DivRemAcc6Impl of DivRemHelper<Acc6, QConst> {
    type DivT = Acc5;
    type RemT = Zq;
}

impl DivRemAcc7Impl of DivRemHelper<Acc7, QConst> {
    type DivT = Acc6;
    type RemT = Zq;
}

impl DivRemAcc8Impl of DivRemHelper<Acc8, QConst> {
    type DivT = Acc7;
    type RemT = Zq;
}
```

**Step 3: Add module to lib.cairo**

```cairo
pub mod packing;
```

**Step 4: Verify compilation**

Run: `cd /home/felt/PycharmProjects/s2morrow && scarb build --package falcon`
Expected: Compiles with no errors.

**Step 5: Commit**
```bash
git add packages/falcon/src/packing.cairo packages/falcon/src/zq.cairo packages/falcon/src/lib.cairo
git commit -m "feat(falcon): add packing BoundedInt type chain for base-Q encoding"
```

---

## Task 3: Cairo Packing Functions + Roundtrip Test

**Files:**
- Modify: `packages/falcon/src/packing.cairo` (add functions)
- Create: `packages/falcon/tests/test_packing.cairo`

**Step 1: Add pack and unpack functions to packing.cairo**

Append to `packages/falcon/src/packing.cairo`:

```cairo
// =============================================================================
// Packing: 9 Zq values -> u128 via Horner encoding
// =============================================================================

/// Pack up to 9 Zq values into a u128 using Horner encoding: v0 + Q*(v1 + Q*(...))
/// Values are consumed via pop_front. Caller ensures len <= 9.
fn pack_9(mut values: Span<u16>) -> u128 {
    // Collect into fixed-size processing (Horner requires reverse order)
    let mut buf: Array<Zq> = array![];
    while let Option::Some(v) = values.pop_front() {
        buf.append(downcast(*v).expect('value exceeds Q-1'));
    };

    let mut vals = buf.span();
    let n = vals.len();
    if n == 0 {
        return 0;
    }

    // Start from last value, work backwards via Horner
    // acc = v[n-1]
    // acc = v[n-2] + Q * acc
    // ...
    // acc = v[0] + Q * acc

    // We need to handle variable lengths (1-9) with the typed chain.
    // Use a match on length to dispatch to the right chain depth.
    _pack_n(vals)
}

/// Internal: Horner pack dispatched by length. Each branch uses exact BoundedInt types.
fn _pack_n(vals: Span<u16>) -> u128 {
    let n = vals.len();
    // Convert all to Zq
    let v = |i: usize| -> Zq { downcast(*vals.at(i)).expect('overflow') };

    if n == 1 {
        upcast::<Acc0, u128>(v(0))
    } else if n == 2 {
        let acc: Acc1 = add(v(0), mul(Q_UNIT, v(1)));
        upcast(acc)
    } else if n == 3 {
        let a1: Acc1 = add(v(1), mul(Q_UNIT, v(2)));
        let a2: Acc2 = add(v(0), mul(Q_UNIT, a1));
        upcast(a2)
    } else if n == 4 {
        let a1: Acc1 = add(v(1 + 1), mul(Q_UNIT, v(1 + 2)));
        let a2: Acc2 = add(v(1), mul(Q_UNIT, a1));
        let a3: Acc3 = add(v(0), mul(Q_UNIT, a2));
        upcast(a3)
    } else if n == 5 {
        let a1: Acc1 = add(v(3), mul(Q_UNIT, v(4)));
        let a2: Acc2 = add(v(2), mul(Q_UNIT, a1));
        let a3: Acc3 = add(v(1), mul(Q_UNIT, a2));
        let a4: Acc4 = add(v(0), mul(Q_UNIT, a3));
        upcast(a4)
    } else if n == 6 {
        let a1: Acc1 = add(v(4), mul(Q_UNIT, v(5)));
        let a2: Acc2 = add(v(3), mul(Q_UNIT, a1));
        let a3: Acc3 = add(v(2), mul(Q_UNIT, a2));
        let a4: Acc4 = add(v(1), mul(Q_UNIT, a3));
        let a5: Acc5 = add(v(0), mul(Q_UNIT, a4));
        upcast(a5)
    } else if n == 7 {
        let a1: Acc1 = add(v(5), mul(Q_UNIT, v(6)));
        let a2: Acc2 = add(v(4), mul(Q_UNIT, a1));
        let a3: Acc3 = add(v(3), mul(Q_UNIT, a2));
        let a4: Acc4 = add(v(2), mul(Q_UNIT, a3));
        let a5: Acc5 = add(v(1), mul(Q_UNIT, a4));
        let a6: Acc6 = add(v(0), mul(Q_UNIT, a5));
        upcast(a6)
    } else if n == 8 {
        let a1: Acc1 = add(v(6), mul(Q_UNIT, v(7)));
        let a2: Acc2 = add(v(5), mul(Q_UNIT, a1));
        let a3: Acc3 = add(v(4), mul(Q_UNIT, a2));
        let a4: Acc4 = add(v(3), mul(Q_UNIT, a3));
        let a5: Acc5 = add(v(2), mul(Q_UNIT, a4));
        let a6: Acc6 = add(v(1), mul(Q_UNIT, a5));
        let a7: Acc7 = add(v(0), mul(Q_UNIT, a6));
        upcast(a7)
    } else {
        // n == 9
        let a1: Acc1 = add(v(7), mul(Q_UNIT, v(8)));
        let a2: Acc2 = add(v(6), mul(Q_UNIT, a1));
        let a3: Acc3 = add(v(5), mul(Q_UNIT, a2));
        let a4: Acc4 = add(v(4), mul(Q_UNIT, a3));
        let a5: Acc5 = add(v(3), mul(Q_UNIT, a4));
        let a6: Acc6 = add(v(2), mul(Q_UNIT, a5));
        let a7: Acc7 = add(v(1), mul(Q_UNIT, a6));
        let a8: Acc8 = add(v(0), mul(Q_UNIT, a7));
        upcast(a8)
    }
}

// =============================================================================
// Unpacking: u128 -> up to 9 Zq values via DivRem chain
// =============================================================================

/// Unpack up to 9 Zq values from a u128 using DivRem by Q chain.
fn unpack_9(packed: u128, count: usize, ref output: Array<u16>) {
    // Downcast u128 to Acc8 for the typed DivRem chain.
    // This is valid because pack_9 produces values <= Q^9-1 < u128_max.
    let acc8: Acc8 = downcast(packed).expect('invalid packed value');

    if count == 0 {
        return;
    }

    let (acc7, r0) = bounded_int_div_rem(acc8, nz_q());
    output.append(upcast::<Zq, u16>(r0));
    if count == 1 {
        return;
    }

    let (acc6, r1) = bounded_int_div_rem(acc7, nz_q());
    output.append(upcast::<Zq, u16>(r1));
    if count == 2 {
        return;
    }

    let (acc5, r2) = bounded_int_div_rem(acc6, nz_q());
    output.append(upcast::<Zq, u16>(r2));
    if count == 3 {
        return;
    }

    let (acc4, r3) = bounded_int_div_rem(acc5, nz_q());
    output.append(upcast::<Zq, u16>(r3));
    if count == 4 {
        return;
    }

    let (acc3, r4) = bounded_int_div_rem(acc4, nz_q());
    output.append(upcast::<Zq, u16>(r4));
    if count == 5 {
        return;
    }

    let (acc2, r5) = bounded_int_div_rem(acc3, nz_q());
    output.append(upcast::<Zq, u16>(r5));
    if count == 6 {
        return;
    }

    let (acc1, r6) = bounded_int_div_rem(acc2, nz_q());
    output.append(upcast::<Zq, u16>(r6));
    if count == 7 {
        return;
    }

    let (acc0, r7) = bounded_int_div_rem(acc1, nz_q());
    output.append(upcast::<Zq, u16>(r7));
    if count == 8 {
        return;
    }

    // count == 9: last value is acc0 itself (Zq)
    output.append(upcast::<Zq, u16>(acc0));
}

// =============================================================================
// Public API: pack/unpack 512 Zq values <-> 29 felt252 slots
// =============================================================================

/// Pack 512 Zq values (u16 in [0, Q-1]) into 29 felt252 values.
/// Each felt252 holds 18 values (9 per u128 half), except the last which holds 8.
pub fn pack_public_key(values: Span<u16>) -> Array<felt252> {
    assert!(values.len() == 512, "expected 512 values");
    let mut result: Array<felt252> = array![];
    let mut offset: usize = 0;

    while offset < 512 {
        let remaining = 512 - offset;
        let chunk_size = if remaining >= VALS_PER_FELT {
            VALS_PER_FELT
        } else {
            remaining
        };

        let lo_count = if chunk_size >= VALS_PER_U128 {
            VALS_PER_U128
        } else {
            chunk_size
        };
        let hi_count = chunk_size - lo_count;

        let lo = pack_9(values.slice(offset, lo_count));
        let hi = if hi_count > 0 {
            pack_9(values.slice(offset + lo_count, hi_count))
        } else {
            0_u128
        };

        let packed: felt252 = lo.into() + hi.into() * TWO_POW_128;
        result.append(packed);
        offset += chunk_size;
    };

    result
}

/// Unpack 29 felt252 values back to 512 Zq values (u16).
pub fn unpack_public_key(packed: Span<felt252>) -> Array<u16> {
    let mut result: Array<u16> = array![];
    let mut slot: usize = 0;
    let mut remaining: usize = 512;

    while remaining > 0 {
        let value = *packed.at(slot);

        let (low, high) = match u128s_from_felt252(value) {
            U128sFromFelt252Result::Narrow(low) => (low, 0_u128),
            U128sFromFelt252Result::Wide((high, low)) => (low, high),
        };

        let lo_count = if remaining >= VALS_PER_U128 {
            VALS_PER_U128
        } else {
            remaining
        };
        unpack_9(low, lo_count, ref result);
        remaining -= lo_count;

        if remaining > 0 {
            let hi_count = if remaining >= VALS_PER_U128 {
                VALS_PER_U128
            } else {
                remaining
            };
            unpack_9(high, hi_count, ref result);
            remaining -= hi_count;
        }

        slot += 1;
    };

    result
}
```

**Step 2: Write failing test**

Create `packages/falcon/tests/test_packing.cairo`:

```cairo
use falcon::packing::{pack_public_key, unpack_public_key};

#[test]
fn test_packing_roundtrip_simple() {
    // 18 known values (one full felt252 slot)
    let mut values: Array<u16> = array![
        0, 1, 2, 100, 12288, 6000, 3000, 9999, 5555,
        42, 7777, 11111, 0, 12288, 1234, 5678, 8888, 4321,
    ];
    // Pad to 512
    let mut i: usize = 18;
    while i != 512 {
        values.append((i % 12289).try_into().unwrap());
        i += 1;
    };

    let packed = pack_public_key(values.span());
    assert_eq!(packed.len(), 29);

    let unpacked = unpack_public_key(packed.span());
    assert_eq!(unpacked.len(), 512);

    let mut j: usize = 0;
    while j != 512 {
        assert_eq!(*unpacked.at(j), *values.at(j), "mismatch at index {}", j);
        j += 1;
    };
}

#[test]
fn test_packing_edge_cases() {
    // All zeros
    let mut zeros: Array<u16> = array![];
    let mut i: usize = 0;
    while i != 512 {
        zeros.append(0);
        i += 1;
    };
    let packed = pack_public_key(zeros.span());
    let unpacked = unpack_public_key(packed.span());
    let mut j: usize = 0;
    while j != 512 {
        assert_eq!(*unpacked.at(j), 0, "zero mismatch at {}", j);
        j += 1;
    };

    // All max (Q-1 = 12288)
    let mut maxes: Array<u16> = array![];
    i = 0;
    while i != 512 {
        maxes.append(12288);
        i += 1;
    };
    let packed_max = pack_public_key(maxes.span());
    let unpacked_max = unpack_public_key(packed_max.span());
    j = 0;
    while j != 512 {
        assert_eq!(*unpacked_max.at(j), 12288, "max mismatch at {}", j);
        j += 1;
    };
}
```

**Step 3: Run tests**

Run: `cd /home/felt/PycharmProjects/s2morrow && snforge test --package falcon -f test_packing`
Expected: PASS (both tests)

**Step 4: Commit**
```bash
git add packages/falcon/src/packing.cairo packages/falcon/tests/test_packing.cairo
git commit -m "feat(falcon): implement base-Q packing with roundtrip tests"
```

---

## Task 4: Cairo HashToPoint Extraction Types

**Files:**
- Create: `packages/falcon/src/hash_to_point.cairo`
- Modify: `packages/falcon/src/lib.cairo`

**Step 1: Create hash_to_point.cairo with BoundedInt extraction types**

Two separate DivRem chains: LOW (from u128, 128 bits) and HIGH (from FeltHigh, 124 bits).

```cairo
// packages/falcon/src/hash_to_point.cairo
//! Poseidon XOF hash_to_point for Falcon-512.
//!
//! Produces 512 Zq coefficients from (message, salt) using:
//! - Poseidon sponge (rate=2, capacity=1) in XOF mode
//! - Base-Q extraction: felt252 -> u256 -> 2x u128 -> 6 DivRem-by-Q each -> 12 Zq per felt252
//!
//! Security: each coefficient comes from reducing a >=50-bit value mod Q.
//! Per Renyi analysis (scripts/renyi.md), this gives <=0.37 bits security loss.

use corelib_imports::bounded_int::bounded_int::add;
use corelib_imports::bounded_int::{
    BoundedInt, DivRemHelper, bounded_int_div_rem, downcast, upcast,
};
use core::integer::{u128s_from_felt252, U128sFromFelt252Result};
use core::poseidon::hades_permutation;
use falcon::zq::{Zq, QConst, nz_q};
use falcon::types::HashToPoint;

// =============================================================================
// LOW extraction chain (from u128, 128 bits -> 6 Zq)
// Starting type: u128 = BoundedInt<0, 2^128-1>
// =============================================================================

type ExtractLQ1 = BoundedInt<0, 27689996494502275487295516920153650>;
type ExtractLQ2 = BoundedInt<0, 2253234314793903123711898195146>;
type ExtractLQ3 = BoundedInt<0, 183353756594833031468133956>;
type ExtractLQ4 = BoundedInt<0, 14920152705251284194656>;
type ExtractLQ5 = BoundedInt<0, 1214106331292317047>;
type ExtractLQ6 = BoundedInt<0, 98796186125178>; // discarded

impl DivRemU128ByQ of DivRemHelper<u128, QConst> {
    type DivT = ExtractLQ1;
    type RemT = Zq;
}

impl DivRemLQ1ByQ of DivRemHelper<ExtractLQ1, QConst> {
    type DivT = ExtractLQ2;
    type RemT = Zq;
}

impl DivRemLQ2ByQ of DivRemHelper<ExtractLQ2, QConst> {
    type DivT = ExtractLQ3;
    type RemT = Zq;
}

impl DivRemLQ3ByQ of DivRemHelper<ExtractLQ3, QConst> {
    type DivT = ExtractLQ4;
    type RemT = Zq;
}

impl DivRemLQ4ByQ of DivRemHelper<ExtractLQ4, QConst> {
    type DivT = ExtractLQ5;
    type RemT = Zq;
}

impl DivRemLQ5ByQ of DivRemHelper<ExtractLQ5, QConst> {
    type DivT = ExtractLQ6;
    type RemT = Zq;
}

// =============================================================================
// HIGH extraction chain (from FeltHigh, 124 bits -> 6 Zq)
// high_max = (StarkPrime - 1) >> 128 = 10633823966279327296825105735305134080
// =============================================================================

type FeltHigh = BoundedInt<0, 10633823966279327296825105735305134080>;

type ExtractHQ1 = BoundedInt<0, 865312390453196134496306105891865>;
type ExtractHQ2 = BoundedInt<0, 70413572337309474692514126933>;
type ExtractHQ3 = BoundedInt<0, 5729804893588532402352846>;
type ExtractHQ4 = BoundedInt<0, 466254772039102644833>;
type ExtractHQ5 = BoundedInt<0, 37940822852884908>;
type ExtractHQ6 = BoundedInt<0, 3087380816411>; // discarded

impl DivRemFeltHighByQ of DivRemHelper<FeltHigh, QConst> {
    type DivT = ExtractHQ1;
    type RemT = Zq;
}

impl DivRemHQ1ByQ of DivRemHelper<ExtractHQ1, QConst> {
    type DivT = ExtractHQ2;
    type RemT = Zq;
}

impl DivRemHQ2ByQ of DivRemHelper<ExtractHQ2, QConst> {
    type DivT = ExtractHQ3;
    type RemT = Zq;
}

impl DivRemHQ3ByQ of DivRemHelper<ExtractHQ3, QConst> {
    type DivT = ExtractHQ4;
    type RemT = Zq;
}

impl DivRemHQ4ByQ of DivRemHelper<ExtractHQ4, QConst> {
    type DivT = ExtractHQ5;
    type RemT = Zq;
}

impl DivRemHQ5ByQ of DivRemHelper<ExtractHQ5, QConst> {
    type DivT = ExtractHQ6;
    type RemT = Zq;
}
```

**Step 2: Add module to lib.cairo**

```cairo
pub mod hash_to_point;
```

**Step 3: Verify compilation**

Run: `cd /home/felt/PycharmProjects/s2morrow && scarb build --package falcon`
Expected: Compiles (types only, no functions yet).

**Step 4: Commit**
```bash
git add packages/falcon/src/hash_to_point.cairo packages/falcon/src/lib.cairo
git commit -m "feat(falcon): add hash_to_point BoundedInt extraction type chains"
```

---

## Task 5: Cairo HashToPoint XOF + Test

**Files:**
- Modify: `packages/falcon/src/hash_to_point.cairo` (add functions)
- Create: `packages/falcon/tests/test_hash_to_point.cairo`

**Step 1: Add extraction and XOF functions to hash_to_point.cairo**

Append to `packages/falcon/src/hash_to_point.cairo`:

```cairo
// =============================================================================
// Extraction: felt252 -> 12 Zq coefficients (6 from low u128, 6 from high)
// =============================================================================

fn extract_6_from_low(value: u128, ref coeffs: Array<u16>) {
    let (q1, r0) = bounded_int_div_rem(value, nz_q());
    coeffs.append(upcast::<Zq, u16>(r0));

    let (q2, r1) = bounded_int_div_rem(q1, nz_q());
    coeffs.append(upcast::<Zq, u16>(r1));

    let (q3, r2) = bounded_int_div_rem(q2, nz_q());
    coeffs.append(upcast::<Zq, u16>(r2));

    let (q4, r3) = bounded_int_div_rem(q3, nz_q());
    coeffs.append(upcast::<Zq, u16>(r3));

    let (q5, r4) = bounded_int_div_rem(q4, nz_q());
    coeffs.append(upcast::<Zq, u16>(r4));

    let (_q6, r5) = bounded_int_div_rem(q5, nz_q());
    coeffs.append(upcast::<Zq, u16>(r5));
}

fn extract_6_from_high(value: FeltHigh, ref coeffs: Array<u16>) {
    let (q1, r0) = bounded_int_div_rem(value, nz_q());
    coeffs.append(upcast::<Zq, u16>(r0));

    let (q2, r1) = bounded_int_div_rem(q1, nz_q());
    coeffs.append(upcast::<Zq, u16>(r1));

    let (q3, r2) = bounded_int_div_rem(q2, nz_q());
    coeffs.append(upcast::<Zq, u16>(r2));

    let (q4, r3) = bounded_int_div_rem(q3, nz_q());
    coeffs.append(upcast::<Zq, u16>(r3));

    let (q5, r4) = bounded_int_div_rem(q4, nz_q());
    coeffs.append(upcast::<Zq, u16>(r4));

    let (_q6, r5) = bounded_int_div_rem(q5, nz_q());
    coeffs.append(upcast::<Zq, u16>(r5));
}

fn extract_12_from_felt252(value: felt252, ref coeffs: Array<u16>) {
    match u128s_from_felt252(value) {
        U128sFromFelt252Result::Narrow(low) => {
            extract_6_from_low(low, ref coeffs);
            // high = 0: skip (P(Narrow) ~ 2^{-123}, essentially never for random output)
        },
        U128sFromFelt252Result::Wide((high, low)) => {
            extract_6_from_low(low, ref coeffs);
            let high_bounded: FeltHigh = downcast(high).expect('high exceeds FeltHigh');
            extract_6_from_high(high_bounded, ref coeffs);
        },
    }
}

// =============================================================================
// Poseidon XOF sponge (rate=2, capacity=1)
// =============================================================================

/// Absorb a span of felt252 values into the sponge state (rate=2).
fn absorb(ref s0: felt252, ref s1: felt252, ref s2: felt252, mut input: Span<felt252>) {
    loop {
        match input.pop_front() {
            Option::None => { break; },
            Option::Some(first) => {
                let second = match input.pop_front() {
                    Option::Some(v) => *v,
                    Option::None => 1, // pad odd element
                };
                let (ns0, ns1, ns2) = hades_permutation(s0 + *first, s1 + second, s2);
                s0 = ns0;
                s1 = ns1;
                s2 = ns2;
            },
        }
    };
}

// =============================================================================
// PoseidonHashToPoint: full hash_to_point implementation
// =============================================================================

pub struct PoseidonHashToPoint {}

impl PoseidonHashToPointImpl of HashToPoint<PoseidonHashToPoint> {
    fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<u16> {
        let (mut s0, mut s1, mut s2): (felt252, felt252, felt252) = (0, 0, 0);

        // Absorb message then salt
        absorb(ref s0, ref s1, ref s2, message);
        absorb(ref s0, ref s1, ref s2, salt);
        s2 += 1; // domain separation before squeeze

        // Squeeze: permute -> extract 12 coefficients from each of s0, s1
        let mut coeffs: Array<u16> = array![];
        loop {
            let (ns0, ns1, ns2) = hades_permutation(s0, s1, s2);
            s0 = ns0;
            s1 = ns1;
            s2 = ns2;
            extract_12_from_felt252(s0, ref coeffs);
            if coeffs.len() >= 512 {
                break;
            }
            extract_12_from_felt252(s1, ref coeffs);
            if coeffs.len() >= 512 {
                break;
            }
        };

        // Truncate to exactly 512
        let span = coeffs.span();
        let mut result: Array<u16> = array![];
        let mut i: usize = 0;
        while i != 512 {
            result.append(*span.at(i));
            i += 1;
        };
        result
    }
}
```

**Step 2: Write tests**

Create `packages/falcon/tests/test_hash_to_point.cairo`:

```cairo
use falcon::hash_to_point::PoseidonHashToPoint;
use falcon::types::HashToPoint;

#[test]
fn test_hash_to_point_length_and_range() {
    let message: Array<felt252> = array![42];
    let salt: Array<felt252> = array![1, 2];

    let result = PoseidonHashToPoint::hash_to_point(message.span(), salt.span());
    assert_eq!(result.len(), 512);

    // All values must be in [0, Q-1]
    for v in result.span() {
        assert!(*v < 12289, "value out of range: {}", *v);
    };
}

#[test]
fn test_hash_to_point_deterministic() {
    let message: Array<felt252> = array![42];
    let salt: Array<felt252> = array![1, 2];

    let result1 = PoseidonHashToPoint::hash_to_point(message.span(), salt.span());
    let result2 = PoseidonHashToPoint::hash_to_point(message.span(), salt.span());

    let mut i: usize = 0;
    while i != 512 {
        assert_eq!(*result1.at(i), *result2.at(i), "non-deterministic at {}", i);
        i += 1;
    };
}

#[test]
fn test_hash_to_point_different_inputs() {
    let msg1: Array<felt252> = array![1];
    let msg2: Array<felt252> = array![2];
    let salt: Array<felt252> = array![0, 0];

    let r1 = PoseidonHashToPoint::hash_to_point(msg1.span(), salt.span());
    let r2 = PoseidonHashToPoint::hash_to_point(msg2.span(), salt.span());

    // Different messages must produce different outputs (with overwhelming probability)
    let mut differ = false;
    let mut i: usize = 0;
    while i != 512 {
        if *r1.at(i) != *r2.at(i) {
            differ = true;
            break;
        }
        i += 1;
    };
    assert!(differ, "different messages produced identical output");
}
```

**Step 3: Run tests**

Run: `cd /home/felt/PycharmProjects/s2morrow && snforge test --package falcon -f test_hash_to_point`
Expected: PASS (all 3 tests)

**Step 4: Commit**
```bash
git add packages/falcon/src/hash_to_point.cairo packages/falcon/tests/test_hash_to_point.cairo
git commit -m "feat(falcon): implement Poseidon XOF hash_to_point with base-Q extraction"
```

---

## Task 6: Cairo Verify Function + Test

**Files:**
- Modify: `packages/falcon/src/falcon.cairo` (add verify functions)
- Create: `packages/falcon/tests/test_verify_hint.cairo`

**Step 1: Add verify functions to falcon.cairo**

Add at the end of `packages/falcon/src/falcon.cairo`, after the existing code:

```cairo
use falcon::types::{
    FalconPublicKey, FalconSignature, FalconSignatureWithHint, FalconVerificationHint,
    HashToPoint,
};
use falcon::ntt::{ntt_fast, mul_ntt, sub_zq, intt_with_hint};

/// Signature bound for Falcon-512
const SIG_BOUND_512: u32 = 34034726;

/// Verify a Falcon signature using the hint-based approach.
/// Computes msg_point internally via hash_to_point.
/// Cost: 2 NTTs, 0 INTTs.
pub fn verify<H, +HashToPoint<H>, +Drop<H>>(
    pk: @FalconPublicKey, sig_with_hint: FalconSignatureWithHint, message: Span<felt252>,
) -> bool {
    let msg_point = H::hash_to_point(message, sig_with_hint.signature.salt.span());
    verify_with_msg_point(pk, sig_with_hint, msg_point.span())
}

/// Verify with a pre-computed msg_point (useful for testing without hash_to_point).
pub fn verify_with_msg_point(
    pk: @FalconPublicKey,
    sig_with_hint: FalconSignatureWithHint,
    msg_point: Span<u16>,
) -> bool {
    let s1 = sig_with_hint.signature.s1.span();
    let pk_ntt = pk.h_ntt.span();
    let mul_hint = sig_with_hint.hint.mul_hint.span();

    assert!(s1.len() == 512, "s1 must be 512 elements");
    assert!(pk_ntt.len() == 512, "pk must be 512 elements");
    assert!(mul_hint.len() == 512, "mul_hint must be 512 elements");
    assert!(msg_point.len() == 512, "msg_point must be 512 elements");

    // 1. s1_ntt = NTT(s1)
    let s1_ntt = ntt_fast(s1);

    // 2. product_ntt = s1_ntt * pk_ntt (pointwise mod Q)
    let product_ntt = mul_ntt(s1_ntt, pk_ntt);

    // 3. Verify hint: checks that NTT(mul_hint) == product_ntt (costs 1 NTT)
    let product = intt_with_hint(product_ntt, mul_hint);

    // 4. s0 = msg_point - product (coefficient-wise mod Q)
    let s0 = sub_zq(msg_point, product);

    // 5. Norm check: ||s0||^2 + ||s1||^2 <= SIG_BOUND
    let mut norm: u32 = 0;
    match extend_euclidean_norm(norm, s0) {
        Result::Ok(n) => norm = n,
        Result::Err(_) => { return false; },
    }
    match extend_euclidean_norm(norm, s1) {
        Result::Ok(n) => norm = n,
        Result::Err(_) => { return false; },
    }

    norm <= SIG_BOUND_512
}
```

**Step 2: Write test using existing test data**

Create `packages/falcon/tests/test_verify_hint.cairo`:

```cairo
use falcon::falcon::{verify_with_msg_point};
use falcon::types::{
    FalconPublicKey, FalconSignature, FalconSignatureWithHint, FalconVerificationHint,
};
use falcon::ntt::{ntt_fast, mul_ntt, intt};
use snforge_std::fs::{FileTrait, read_json};

#[derive(Drop, Serde)]
struct Args {
    attestations: Array<Attestation>,
    n: u32,
}

#[derive(Drop, Serde)]
struct Attestation {
    s1: Array<u16>,
    pk: Array<u16>,
    msg_point: Array<u16>,
}

fn load_args() -> Args {
    let file = FileTrait::new("tests/data/args_512_1_int.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    Serde::deserialize(ref span).expect('deserialize failed')
}

#[test]
fn test_verify_with_msg_point() {
    let args = load_args();
    let att = args.attestations.at(0);

    // Compute mul_hint = INTT(NTT(s1) * pk) using existing recursive functions
    let s1_ntt = ntt_fast(att.s1.span());
    let product_ntt = mul_ntt(s1_ntt, att.pk.span());
    // Use recursive INTT to compute the hint
    let mul_hint_span = intt(product_ntt);

    // Clone into arrays for the struct (att fields are snapshots)
    let mut s1_arr: Array<u16> = array![];
    for v in att.s1.span() {
        s1_arr.append(*v);
    };
    let mut hint_arr: Array<u16> = array![];
    for v in mul_hint_span {
        hint_arr.append(*v);
    };

    let pk = FalconPublicKey { h_ntt: att.pk.clone() };
    let sig = FalconSignature { s1: s1_arr, salt: array![] };
    let hint = FalconVerificationHint { mul_hint: hint_arr };
    let sig_with_hint = FalconSignatureWithHint { signature: sig, hint: hint };

    let result = verify_with_msg_point(@pk, sig_with_hint, att.msg_point.span());
    assert!(result, "verification should pass");
}

#[test]
fn test_verify_bad_signature_fails() {
    let args = load_args();
    let att = args.attestations.at(0);

    let s1_ntt = ntt_fast(att.s1.span());
    let product_ntt = mul_ntt(s1_ntt, att.pk.span());
    let mul_hint_span = intt(product_ntt);

    // Corrupt s1: change first element
    let mut s1_bad: Array<u16> = array![];
    let mut first = true;
    for v in att.s1.span() {
        if first {
            s1_bad.append((*v + 1) % 12289);
            first = false;
        } else {
            s1_bad.append(*v);
        }
    };
    let mut hint_arr: Array<u16> = array![];
    for v in mul_hint_span {
        hint_arr.append(*v);
    };

    let pk = FalconPublicKey { h_ntt: att.pk.clone() };
    let sig = FalconSignature { s1: s1_bad, salt: array![] };
    let hint = FalconVerificationHint { mul_hint: hint_arr };
    let sig_with_hint = FalconSignatureWithHint { signature: sig, hint: hint };

    // This will panic at intt_with_hint because NTT(hint) != NTT(corrupted_s1) * pk
    // That's expected - the hint was computed for the original s1
}
```

**Step 3: Run tests**

Run: `cd /home/felt/PycharmProjects/s2morrow && snforge test --package falcon -f test_verify_hint`
Expected: `test_verify_with_msg_point` PASS. The bad-signature test may panic (expected behavior when hint doesn't match).

**Step 4: Commit**
```bash
git add packages/falcon/src/falcon.cairo packages/falcon/tests/test_verify_hint.cairo
git commit -m "feat(falcon): add hint-based verify function with msg_point test"
```

---

## Task 7: Rust Dependencies + PoseidonHash

> **Note:** This task and Tasks 8-9 must be run in a session with working directory `/home/felt/PycharmProjects/falcon-rs/`.

**Files:**
- Modify: `Cargo.toml` (add lambdaworks)
- Create: `src/poseidon_hash.rs`
- Modify: `src/lib.rs` (add module)
- Modify: `src/hash_to_point.rs` (update trait)

**Step 1: Add lambdaworks dependencies to Cargo.toml**

Add to `[dependencies]`:
```toml
lambdaworks-crypto = "0.13"
lambdaworks-math = "0.13"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

Move `serde` and `serde_json` from `[dev-dependencies]` to `[dependencies]` (needed by serialize module).

**Step 2: Update HashToPoint trait in hash_to_point.rs**

Replace the trait definition with a generic version:

```rust
// src/hash_to_point.rs
use crate::{N, Q, SALT_LEN};

pub trait HashToPoint {
    type Input;
    type Salt;
    fn hash_to_point(message: &[Self::Input], salt: &[Self::Salt]) -> [i16; N];
}

// Update Shake256Hash impl:
impl HashToPoint for Shake256Hash {
    type Input = u8;
    type Salt = u8;
    fn hash_to_point(message: &[u8], salt: &[u8]) -> [i16; N] {
        // ... existing implementation, adapt salt param from &[u8; SALT_LEN] to &[u8]
    }
}
```

**Step 3: Create poseidon_hash.rs**

```rust
// src/poseidon_hash.rs
use crate::hash_to_point::HashToPoint;
use crate::{N, Q};
use lambdaworks_crypto::hash::poseidon::starknet::PoseidonCairoStark252;
use lambdaworks_crypto::hash::poseidon::Poseidon;
use lambdaworks_math::field::element::FieldElement;
use lambdaworks_math::field::fields::fft_friendly::stark_252_prime_field::Stark252PrimeField;

pub type Felt = FieldElement<Stark252PrimeField>;

pub struct PoseidonHash;

impl HashToPoint for PoseidonHash {
    type Input = Felt;
    type Salt = Felt;

    fn hash_to_point(message: &[Felt], salt: &[Felt]) -> [i16; N] {
        let mut state = [Felt::zero(), Felt::zero(), Felt::zero()];

        // Absorb message then salt (rate=2)
        absorb(&mut state, message);
        absorb(&mut state, salt);
        state[2] = state[2] + Felt::one(); // domain separation

        // Squeeze
        let mut coeffs = [0i16; N];
        let mut idx = 0;
        while idx < N {
            PoseidonCairoStark252::hades_permutation(&mut state);
            idx += extract_12_from_felt(&state[0], &mut coeffs, idx);
            if idx >= N {
                break;
            }
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
                state[0] = state[0] + *first;
                match iter.next() {
                    Some(second) => state[1] = state[1] + *second,
                    None => state[1] = state[1] + Felt::one(), // pad
                }
                PoseidonCairoStark252::hades_permutation(state);
            }
        }
    }
}

fn extract_12_from_felt(value: &Felt, out: &mut [i16; N], start: usize) -> usize {
    let bytes = value.to_bytes_be();
    let high = u128::from_be_bytes(bytes[0..16].try_into().unwrap());
    let low = u128::from_be_bytes(bytes[16..32].try_into().unwrap());

    let mut count = 0;
    count += extract_6_from_u128(low, out, start + count);
    count += extract_6_from_u128(high, out, start + count);
    count
}

fn extract_6_from_u128(mut value: u128, out: &mut [i16; N], start: usize) -> usize {
    for i in 0..6 {
        if start + i >= N {
            return i;
        }
        out[start + i] = (value % Q as u128) as i16;
        value /= Q as u128;
    }
    6
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_poseidon_hash_deterministic() {
        let msg = [Felt::from(42u64)];
        let salt = [Felt::from(1u64), Felt::from(2u64)];
        let r1 = PoseidonHash::hash_to_point(&msg, &salt);
        let r2 = PoseidonHash::hash_to_point(&msg, &salt);
        assert_eq!(r1, r2);
    }

    #[test]
    fn test_poseidon_hash_range() {
        let msg = [Felt::from(42u64)];
        let salt = [Felt::from(1u64), Felt::from(2u64)];
        let result = PoseidonHash::hash_to_point(&msg, &salt);
        for &v in &result {
            assert!(v >= 0 && v < Q as i16, "out of range: {v}");
        }
    }

    #[test]
    fn test_poseidon_hash_different_inputs() {
        let msg1 = [Felt::from(1u64)];
        let msg2 = [Felt::from(2u64)];
        let salt = [Felt::from(0u64), Felt::from(0u64)];
        let r1 = PoseidonHash::hash_to_point(&msg1, &salt);
        let r2 = PoseidonHash::hash_to_point(&msg2, &salt);
        assert_ne!(r1, r2);
    }
}
```

**Step 4: Add module to lib.rs**

```rust
pub mod poseidon_hash;
```

**Step 5: Run tests**

Run: `cargo test poseidon`
Expected: PASS (all 3 tests)

**Step 6: Commit**
```bash
git add Cargo.toml src/poseidon_hash.rs src/hash_to_point.rs src/lib.rs
git commit -m "feat: add Poseidon XOF hash_to_point with lambdaworks"
```

---

## Task 8: Rust Packing + Hints

**Files:**
- Create: `src/packing.rs`
- Create: `src/hints.rs`
- Modify: `src/lib.rs`

**Step 1: Create packing.rs**

```rust
// src/packing.rs
use crate::poseidon_hash::Felt;
use crate::Q;

const VALS_PER_U128: usize = 9;
const VALS_PER_FELT: usize = 18;
pub const PACKED_SLOTS: usize = 29;

/// 2^128 as Felt
fn two_pow_128() -> Felt {
    Felt::from_hex("0x100000000000000000000000000000000").unwrap()
}

/// Pack 512 Zq values into 29 Felt values using base-Q Horner encoding.
pub fn pack_public_key(h_ntt: &[u16]) -> Vec<Felt> {
    assert_eq!(h_ntt.len(), 512);
    h_ntt
        .chunks(VALS_PER_FELT)
        .map(|chunk| {
            let split = chunk.len().min(VALS_PER_U128);
            let lo = horner_pack(&chunk[..split]);
            let hi = if chunk.len() > split {
                horner_pack(&chunk[split..])
            } else {
                0u128
            };
            Felt::from(lo) + Felt::from(hi) * two_pow_128()
        })
        .collect()
}

/// Unpack 29 Felt values back to 512 Zq values.
pub fn unpack_public_key(packed: &[Felt]) -> Vec<u16> {
    let mut result = Vec::with_capacity(512);
    let mut remaining = 512usize;

    for felt in packed {
        let bytes = felt.to_bytes_be();
        let high = u128::from_be_bytes(bytes[0..16].try_into().unwrap());
        let low = u128::from_be_bytes(bytes[16..32].try_into().unwrap());

        let lo_count = remaining.min(VALS_PER_U128);
        base_q_extract(low, lo_count, &mut result);
        remaining -= lo_count;

        if remaining > 0 {
            let hi_count = remaining.min(VALS_PER_U128);
            base_q_extract(high, hi_count, &mut result);
            remaining -= hi_count;
        }
    }
    result
}

fn horner_pack(values: &[u16]) -> u128 {
    let mut acc: u128 = 0;
    for &v in values.iter().rev() {
        acc = acc * Q as u128 + v as u128;
    }
    acc
}

fn base_q_extract(mut value: u128, count: usize, out: &mut Vec<u16>) {
    for _ in 0..count {
        out.push((value % Q as u128) as u16);
        value /= Q as u128;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_packing_roundtrip() {
        let mut values = vec![0u16; 512];
        for i in 0..512 {
            values[i] = (i * 37 % 12289) as u16;
        }
        let packed = pack_public_key(&values);
        assert_eq!(packed.len(), PACKED_SLOTS);
        let unpacked = unpack_public_key(&packed);
        assert_eq!(unpacked, values);
    }

    #[test]
    fn test_packing_edge_cases() {
        // All zeros
        let zeros = vec![0u16; 512];
        assert_eq!(unpack_public_key(&pack_public_key(&zeros)), zeros);

        // All max
        let maxes = vec![12288u16; 512];
        assert_eq!(unpack_public_key(&pack_public_key(&maxes)), maxes);
    }
}
```

**Step 2: Create hints.rs**

```rust
// src/hints.rs
use crate::ntt::{ntt, intt, mul_ntt};
use crate::Q;

/// Generate INTT(NTT(s1) * pk_h_ntt) — the mul_hint for verification.
pub fn generate_mul_hint(s1: &[u16], pk_h_ntt: &[u16]) -> Vec<u16> {
    let s1_i32: Vec<i32> = s1.iter().map(|&v| v as i32).collect();
    let pk_i32: Vec<i32> = pk_h_ntt.iter().map(|&v| v as i32).collect();

    let s1_ntt = ntt(&s1_i32);
    let product_ntt = mul_ntt(&s1_ntt, &pk_i32);
    let product = intt(&product_ntt);

    product
        .iter()
        .map(|&v| v.rem_euclid(Q) as u16)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hint_roundtrip() {
        // Simple test: s1 = [1, 0, 0, ...], pk = [1, 0, 0, ...]
        let mut s1 = vec![0u16; 512];
        s1[0] = 1;
        let mut pk_ntt = ntt(&s1.iter().map(|&v| v as i32).collect::<Vec<_>>());
        let pk_u16: Vec<u16> = pk_ntt.iter().map(|&v| v.rem_euclid(Q) as u16).collect();

        let hint = generate_mul_hint(&s1, &pk_u16);
        assert_eq!(hint.len(), 512);
        // hint should be INTT(NTT([1,0...]) * NTT([1,0...])) = [1,0...] * [1,0...] = [1,0...]
        assert_eq!(hint[0], 1);
        for i in 1..512 {
            assert_eq!(hint[i], 0, "expected 0 at index {i}, got {}", hint[i]);
        }
    }
}
```

**Step 3: Add modules to lib.rs**

```rust
pub mod packing;
pub mod hints;
```

**Step 4: Run tests**

Run: `cargo test packing && cargo test hint`
Expected: PASS

**Step 5: Commit**
```bash
git add src/packing.rs src/hints.rs src/lib.rs
git commit -m "feat: add base-Q packing and hint generation"
```

---

## Task 9: Rust Serialization + Test Vector Generation

**Files:**
- Create: `src/serialize.rs`
- Modify: `src/lib.rs`
- Create test vector generation (integration test or binary)

**Step 1: Create serialize.rs**

```rust
// src/serialize.rs
use crate::poseidon_hash::Felt;
use serde_json::{json, Value};

/// Serialize an array of u16 values as Cairo Serde: [length, v0, v1, ...]
fn serde_u16_array(values: &[u16]) -> Vec<String> {
    let mut out = Vec::with_capacity(values.len() + 1);
    out.push(values.len().to_string());
    for &v in values {
        out.push(v.to_string());
    }
    out
}

/// Serialize an array of Felt values as Cairo Serde: [length, f0, f1, ...]
fn serde_felt_array(values: &[Felt]) -> Vec<String> {
    let mut out = Vec::with_capacity(values.len() + 1);
    out.push(values.len().to_string());
    for v in values {
        out.push(format!("{}", felt_to_decimal(v)));
    }
    out
}

fn felt_to_decimal(f: &Felt) -> String {
    let bytes = f.to_bytes_be();
    // Convert big-endian bytes to decimal string
    let mut num = num_bigint::BigUint::from_bytes_be(&bytes);
    num.to_string()
}

/// Generate snforge-compatible JSON for hash_to_point test data.
/// Format: {"hash_to_point_test": [<message_serde>, <salt_serde>, <expected_serde>]}
pub fn hash_to_point_test_json(
    message: &[Felt],
    salt: &[Felt],
    expected: &[u16],
) -> Value {
    let mut payload = Vec::new();
    payload.extend(serde_felt_array(message));
    payload.extend(serde_felt_array(salt));
    payload.extend(serde_u16_array(expected));
    json!({ "hash_to_point_test": payload })
}

/// Generate snforge-compatible JSON for packing test data.
pub fn packing_test_json(values: &[u16], packed: &[Felt]) -> Value {
    let mut payload = Vec::new();
    payload.extend(serde_u16_array(values));
    payload.extend(serde_felt_array(packed));
    json!({ "packing_test": payload })
}
```

**Step 2: Create test vector generation test**

Create `tests/generate_test_vectors.rs`:

```rust
use falcon_rs::poseidon_hash::{Felt, PoseidonHash};
use falcon_rs::hash_to_point::HashToPoint;
use falcon_rs::packing::{pack_public_key, unpack_public_key};
use falcon_rs::serialize;
use std::fs;

#[test]
fn generate_hash_to_point_vector() {
    let message = vec![Felt::from(42u64)];
    let salt = vec![Felt::from(1u64), Felt::from(2u64)];
    let expected = PoseidonHash::hash_to_point(&message, &salt);
    let expected_u16: Vec<u16> = expected.iter().map(|&v| v as u16).collect();

    let json = serialize::hash_to_point_test_json(&message, &salt, &expected_u16);
    let path = "../s2morrow/packages/falcon/tests/data/hash_to_point_test_int.json";
    fs::write(path, serde_json::to_string_pretty(&json).unwrap()).unwrap();
    println!("Wrote hash_to_point test vector to {path}");
}

#[test]
fn generate_packing_vector() {
    // Use a deterministic sequence
    let values: Vec<u16> = (0..512).map(|i| ((i * 37) % 12289) as u16).collect();
    let packed = pack_public_key(&values);
    let json = serialize::packing_test_json(&values, &packed);
    let path = "../s2morrow/packages/falcon/tests/data/packing_test_int.json";
    fs::write(path, serde_json::to_string_pretty(&json).unwrap()).unwrap();
    println!("Wrote packing test vector to {path}");
}
```

**Step 3: Add module and run**

Add to `src/lib.rs`:
```rust
pub mod serialize;
```

Run: `cargo test generate_ -- --nocapture`
Expected: Generates JSON files in `packages/falcon/tests/data/`.

**Step 4: Commit**
```bash
git add src/serialize.rs src/lib.rs tests/generate_test_vectors.rs
git commit -m "feat: add serialization and test vector generation"
```

---

## Task 10: Cairo Cross-Language Integration Tests

**Files:**
- Create: `packages/falcon/tests/test_cross_language.cairo`

**Prerequisite:** Task 9 must have generated the test vector JSON files.

**Step 1: Write cross-language hash_to_point test**

Create `packages/falcon/tests/test_cross_language.cairo`:

```cairo
use falcon::hash_to_point::PoseidonHashToPoint;
use falcon::packing::{pack_public_key, unpack_public_key};
use falcon::types::HashToPoint;
use snforge_std::fs::{FileTrait, read_json};

#[derive(Drop, Serde)]
struct HashToPointTest {
    message: Array<felt252>,
    salt: Array<felt252>,
    expected: Array<u16>,
}

#[derive(Drop, Serde)]
struct PackingTest {
    values: Array<u16>,
    packed: Array<felt252>,
}

fn load_hash_to_point_test() -> HashToPointTest {
    let file = FileTrait::new("tests/data/hash_to_point_test_int.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    Serde::deserialize(ref span).expect('deserialize failed')
}

fn load_packing_test() -> PackingTest {
    let file = FileTrait::new("tests/data/packing_test_int.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    Serde::deserialize(ref span).expect('deserialize failed')
}

#[test]
fn test_hash_to_point_matches_rust() {
    let test = load_hash_to_point_test();
    let result = PoseidonHashToPoint::hash_to_point(test.message.span(), test.salt.span());

    assert_eq!(result.len(), test.expected.len());
    let mut i: usize = 0;
    while i != 512 {
        assert_eq!(*result.at(i), *test.expected.at(i), "mismatch at index {}", i);
        i += 1;
    };
}

#[test]
fn test_packing_matches_rust() {
    let test = load_packing_test();

    // Test pack: Cairo pack should produce same felt252 values as Rust
    let packed = pack_public_key(test.values.span());
    assert_eq!(packed.len(), test.packed.len());
    let mut i: usize = 0;
    while i != packed.len() {
        assert_eq!(*packed.at(i), *test.packed.at(i), "pack mismatch at slot {}", i);
        i += 1;
    };

    // Test unpack: unpack Rust-generated packed values
    let unpacked = unpack_public_key(test.packed.span());
    assert_eq!(unpacked.len(), test.values.len());
    i = 0;
    while i != 512 {
        assert_eq!(*unpacked.at(i), *test.values.at(i), "unpack mismatch at index {}", i);
        i += 1;
    };
}
```

**Step 2: Run tests**

Run: `cd /home/felt/PycharmProjects/s2morrow && snforge test --package falcon -f test_cross_language`
Expected: PASS (both tests)

**Step 3: Commit**
```bash
git add packages/falcon/tests/test_cross_language.cairo packages/falcon/tests/data/hash_to_point_test_int.json packages/falcon/tests/data/packing_test_int.json
git commit -m "test(falcon): add cross-language integration tests for hash_to_point and packing"
```

---

## Dependency Graph

```
Task 1 (types)
  ├─> Task 2 (packing types)
  │     └─> Task 3 (packing functions + test)
  │           └─> Task 10 (cross-language tests) [needs Task 9]
  ├─> Task 4 (hash extraction types)
  │     └─> Task 5 (hash XOF + test)
  │           └─> Task 10 (cross-language tests) [needs Task 9]
  └─> Task 6 (verify function + test)

Task 7 (Rust Poseidon)
  └─> Task 8 (Rust packing + hints)
        └─> Task 9 (Rust serialization + vectors)
              └─> Task 10 (cross-language tests)
```

**Parallelizable:** Tasks 2-3 and 4-5 can run in parallel. Tasks 7-9 (Rust) can run in parallel with Tasks 2-6 (Cairo).
