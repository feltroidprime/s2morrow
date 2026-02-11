//! Base-Q polynomial packing for storage-efficient Falcon public keys.
//!
//! Packs 512 Zq values into 29 felt252 slots using base Q=12289 encoding:
//!   felt252 = pack_9(v0..v8) + pack_9(v9..v17) * 2^128
//!
//! DivRem by Q gives RemT = Zq directly — zero downcasts in the hot path.

use corelib_imports::bounded_int::{AddHelper, BoundedInt, DivRemHelper, MulHelper};
use falcon::zq::{Zq, QConst};

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
