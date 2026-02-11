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

// =============================================================================
// Packing functions
// =============================================================================

/// Helper: get a Zq value from a u16 span (downcast at boundary only)
#[inline(always)]
fn v(vals: Span<u16>, i: usize) -> Zq {
    downcast(*vals.at(i)).expect('overflow')
}

/// Horner-encode up to 9 Zq values into a u128.
/// Encoding: v0 + Q*(v1 + Q*(v2 + ... + Q*v8))
fn pack_9(vals: Span<u16>) -> u128 {
    let n = vals.len();
    match n {
        0 => 0_u128,
        1 => {
            let a: Zq = v(vals, 0);
            upcast(a)
        },
        2 => {
            let a1: Acc1 = add(v(vals, 0), mul(Q_UNIT, v(vals, 1)));
            upcast(a1)
        },
        3 => {
            let a1: Acc1 = add(v(vals, 1), mul(Q_UNIT, v(vals, 2)));
            let a2: Acc2 = add(v(vals, 0), mul(Q_UNIT, a1));
            upcast(a2)
        },
        4 => {
            let a1: Acc1 = add(v(vals, 2), mul(Q_UNIT, v(vals, 3)));
            let a2: Acc2 = add(v(vals, 1), mul(Q_UNIT, a1));
            let a3: Acc3 = add(v(vals, 0), mul(Q_UNIT, a2));
            upcast(a3)
        },
        5 => {
            let a1: Acc1 = add(v(vals, 3), mul(Q_UNIT, v(vals, 4)));
            let a2: Acc2 = add(v(vals, 2), mul(Q_UNIT, a1));
            let a3: Acc3 = add(v(vals, 1), mul(Q_UNIT, a2));
            let a4: Acc4 = add(v(vals, 0), mul(Q_UNIT, a3));
            upcast(a4)
        },
        6 => {
            let a1: Acc1 = add(v(vals, 4), mul(Q_UNIT, v(vals, 5)));
            let a2: Acc2 = add(v(vals, 3), mul(Q_UNIT, a1));
            let a3: Acc3 = add(v(vals, 2), mul(Q_UNIT, a2));
            let a4: Acc4 = add(v(vals, 1), mul(Q_UNIT, a3));
            let a5: Acc5 = add(v(vals, 0), mul(Q_UNIT, a4));
            upcast(a5)
        },
        7 => {
            let a1: Acc1 = add(v(vals, 5), mul(Q_UNIT, v(vals, 6)));
            let a2: Acc2 = add(v(vals, 4), mul(Q_UNIT, a1));
            let a3: Acc3 = add(v(vals, 3), mul(Q_UNIT, a2));
            let a4: Acc4 = add(v(vals, 2), mul(Q_UNIT, a3));
            let a5: Acc5 = add(v(vals, 1), mul(Q_UNIT, a4));
            let a6: Acc6 = add(v(vals, 0), mul(Q_UNIT, a5));
            upcast(a6)
        },
        8 => {
            let a1: Acc1 = add(v(vals, 6), mul(Q_UNIT, v(vals, 7)));
            let a2: Acc2 = add(v(vals, 5), mul(Q_UNIT, a1));
            let a3: Acc3 = add(v(vals, 4), mul(Q_UNIT, a2));
            let a4: Acc4 = add(v(vals, 3), mul(Q_UNIT, a3));
            let a5: Acc5 = add(v(vals, 2), mul(Q_UNIT, a4));
            let a6: Acc6 = add(v(vals, 1), mul(Q_UNIT, a5));
            let a7: Acc7 = add(v(vals, 0), mul(Q_UNIT, a6));
            upcast(a7)
        },
        9 => {
            let a1: Acc1 = add(v(vals, 7), mul(Q_UNIT, v(vals, 8)));
            let a2: Acc2 = add(v(vals, 6), mul(Q_UNIT, a1));
            let a3: Acc3 = add(v(vals, 5), mul(Q_UNIT, a2));
            let a4: Acc4 = add(v(vals, 4), mul(Q_UNIT, a3));
            let a5: Acc5 = add(v(vals, 3), mul(Q_UNIT, a4));
            let a6: Acc6 = add(v(vals, 2), mul(Q_UNIT, a5));
            let a7: Acc7 = add(v(vals, 1), mul(Q_UNIT, a6));
            let a8: Acc8 = add(v(vals, 0), mul(Q_UNIT, a7));
            upcast(a8)
        },
        _ => core::panic_with_felt252('pack_9: count > 9'),
    }
}

/// Unpack a u128 into `count` u16 values using iterated DivRem by Q.
fn unpack_9(packed: u128, count: usize, ref output: Array<u16>) {
    if count == 0 {
        return;
    }
    let acc8: Acc8 = downcast(packed).expect('invalid packed value');
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
    output.append(upcast::<Zq, u16>(acc0));
}

/// Pack 512 u16 values into 29 felt252 slots.
/// Each slot encodes up to 18 values: pack_9(lo) + pack_9(hi) * 2^128.
pub fn pack_public_key(values: Span<u16>) -> Array<felt252> {
    assert!(values.len() == 512, "expected 512 values");
    let mut result: Array<felt252> = array![];
    let mut offset: usize = 0;
    // 28 full slots of 18 values each = 504 values
    // 1 final slot with 8 remaining values
    let total = 512;
    while offset != total {
        let remaining = total - offset;
        let chunk = if remaining >= VALS_PER_FELT {
            VALS_PER_FELT
        } else {
            remaining
        };
        let lo_count = if chunk >= VALS_PER_U128 {
            VALS_PER_U128
        } else {
            chunk
        };
        let hi_count = chunk - lo_count;

        let lo_packed = pack_9(values.slice(offset, lo_count));
        let lo_felt: felt252 = lo_packed.into();

        let slot = if hi_count != 0 {
            let hi_packed = pack_9(values.slice(offset + lo_count, hi_count));
            let hi_felt: felt252 = hi_packed.into();
            lo_felt + hi_felt * TWO_POW_128
        } else {
            lo_felt
        };

        result.append(slot);
        offset += chunk;
    };
    result
}

/// Unpack 29 felt252 slots back to 512 u16 values.
pub fn unpack_public_key(packed: Span<felt252>) -> Array<u16> {
    let mut output: Array<u16> = array![];
    let mut remaining: usize = 512;
    let mut i: usize = 0;
    let slot_count = packed.len();
    while i != slot_count {
        let value: felt252 = *packed.at(i);
        let val_u256: u256 = value.into();
        let low: u128 = val_u256.low;
        let high: u128 = val_u256.high;

        let lo_count = if remaining >= VALS_PER_U128 {
            VALS_PER_U128
        } else {
            remaining
        };
        unpack_9(low, lo_count, ref output);
        remaining -= lo_count;

        let hi_count = if remaining >= VALS_PER_U128 {
            VALS_PER_U128
        } else {
            remaining
        };
        if hi_count != 0 {
            unpack_9(high, hi_count, ref output);
            remaining -= hi_count;
        }

        i += 1;
    };
    output
}
