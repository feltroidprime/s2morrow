// SPDX-FileCopyrightText: 2025 StarkWare Industries Ltd.
//
// SPDX-License-Identifier: MIT

//! Operations on the base ring Z_q using BoundedInt with lazy modular reduction
//!
//! Key optimizations:
//! 1. BoundedInt throughout - Zq = BoundedInt<0, 12288> as native type
//! 2. Lazy reduction - Fuse arithmetic operations and reduce mod Q only once

use corelib_imports::bounded_int::bounded_int::{SubHelper, add, mul, sub};
use corelib_imports::bounded_int::{
    AddHelper, BoundedInt, DivRemHelper, MulHelper, UnitInt, bounded_int_div_rem, downcast, upcast,
};

/// The ring modulus Q = 12289
pub const Q: u16 = 12289;

/// BoundedInt type for elements in Z_q: [0, Q-1] = [0, 12288]
pub type Zq = BoundedInt<0, 12288>;

/// Singleton type for the modulus Q
pub type QConst = UnitInt<12289>;

/// Get Q as a NonZero constant for division
#[inline(always)]
pub fn nz_q() -> NonZero<QConst> {
    12289
}

/// Q as a UnitInt constant for BoundedInt mul operations
pub const Q_UNIT: QConst = 12289;

// =============================================================================
// Type conversion utilities
// =============================================================================

/// Convert u16 to Zq (requires range check - use only at deserialization boundaries)
#[inline(always)]
pub fn from_u16(x: u16) -> Zq {
    downcast(x).expect('value exceeds Q-1')
}

/// Convert Zq back to u16 (free upcast)
#[inline(always)]
pub fn to_u16(x: Zq) -> u16 {
    upcast(x)
}

// =============================================================================
// Intermediate bound types for lazy reduction
// =============================================================================

/// Sum of two Zq values: [0, 24576]
pub type ZqSum = BoundedInt<0, 24576>;

/// Difference after adding offset Q: (a + Q) - b gives [1, 24577]
pub type ZqDiffOffset = BoundedInt<1, 24577>;

/// Product of two Zq values: [0, 150994944]
pub type ZqProd = BoundedInt<0, 150994944>;

/// Sum of Zq + ZqProd: [0, 151007232]
pub type ZqSumProd = BoundedInt<0, 151007232>;

/// Product of I2 (6145) * ZqSum: [0, 151019520]
pub type I2xSum = BoundedInt<0, 151019520>;

/// Product of I2 (6145) * ZqDiffOffset: [6145, 151025665]
pub type I2xDiff = BoundedInt<6145, 151025665>;

/// Product of constant * Zq for SQR1 (1479): [0, 18173952]
pub type Sqr1xZq = BoundedInt<0, 18173952>;

/// Product of constant * Zq for SQR1_INV (10810) * wider diff
pub type Sqr1InvxZq = BoundedInt<0, 132833280>;

// =============================================================================
// AddHelper implementations
// =============================================================================

impl AddZqZqImpl of AddHelper<Zq, Zq> {
    type Result = ZqSum;
}

impl AddZqProdImpl of AddHelper<Zq, ZqProd> {
    type Result = ZqSumProd;
}

impl AddZqQImpl of AddHelper<Zq, QConst> {
    type Result = BoundedInt<12289, 24577>;
}

// =============================================================================
// SubHelper implementations
// =============================================================================

impl SubZqOffsetZqImpl of SubHelper<BoundedInt<12289, 24577>, Zq> {
    type Result = ZqDiffOffset;
}

// For merge_ntt subtraction: (f0 + offset) - prod where offset = 12288 * Q
impl SubZqOffsetProdImpl of SubHelper<BoundedInt<151007232, 151019520>, ZqProd> {
    type Result = BoundedInt<12288, 151019520>;
}

// DivRem for the subtraction result
impl DivRemSubResultImpl of DivRemHelper<BoundedInt<12288, 151019520>, QConst> {
    type DivT = BoundedInt<0, 12288>;
    type RemT = Zq;
}

// =============================================================================
// MulHelper implementations
// =============================================================================

impl MulZqZqImpl of MulHelper<Zq, Zq> {
    type Result = ZqProd;
}

// I2 = 6145 as singleton
pub type I2Const = UnitInt<6145>;

impl MulI2SumImpl of MulHelper<I2Const, ZqSum> {
    type Result = I2xSum;
}

impl MulI2DiffImpl of MulHelper<I2Const, ZqDiffOffset> {
    type Result = I2xDiff;
}

// MulI2DiffZqImpl removed - bounds too large for CASM backend

// SQR1 = 1479 as singleton
pub type Sqr1Const = UnitInt<1479>;

impl MulSqr1ZqImpl of MulHelper<Sqr1Const, Zq> {
    type Result = Sqr1xZq;
}

// SQR1_INV = 10810 as singleton
pub type Sqr1InvConst = UnitInt<10810>;

impl MulSqr1InvZqImpl of MulHelper<Sqr1InvConst, Zq> {
    type Result = Sqr1InvxZq;
}

// Note: MulI2DiffImpl already handles I2Const * ZqDiffOffset -> I2xDiff

// For merge: I2 * Zq for the intt base case
impl MulI2ZqImpl of MulHelper<I2Const, Zq> {
    type Result = BoundedInt<0, 75507840>;
}

// =============================================================================
// DivRemHelper implementations for modular reduction
// =============================================================================

impl DivRemI2SumImpl of DivRemHelper<I2xSum, QConst> {
    type DivT = BoundedInt<0, 12288>;
    type RemT = Zq;
}

// DivRemI2DiffxZqImpl removed - bounds too large for CASM backend

// DivRem for I2xDiff (intermediate 2-value product before final mul)
impl DivRemI2DiffImpl of DivRemHelper<I2xDiff, QConst> {
    type DivT = BoundedInt<0, 12289>;
    type RemT = Zq;
}

impl DivRemZqSumProdImpl of DivRemHelper<ZqSumProd, QConst> {
    type DivT = BoundedInt<0, 12288>;
    type RemT = Zq;
}

impl DivRemZqProdImpl of DivRemHelper<ZqProd, QConst> {
    type DivT = BoundedInt<0, 12287>;
    type RemT = Zq;
}

impl DivRemZqSumImpl of DivRemHelper<ZqSum, QConst> {
    type DivT = BoundedInt<0, 1>;
    type RemT = Zq;
}

impl DivRemSqr1xZqImpl of DivRemHelper<Sqr1xZq, QConst> {
    type DivT = BoundedInt<0, 1478>;
    type RemT = Zq;
}

impl DivRemSqr1InvxZqImpl of DivRemHelper<Sqr1InvxZq, QConst> {
    type DivT = BoundedInt<0, 10809>;
    type RemT = Zq;
}

// =============================================================================
// Modular arithmetic operations (BoundedInt in, BoundedInt out)
// =============================================================================

/// Add two Zq values and reduce mod Q
#[inline(always)]
pub fn add_mod(a: Zq, b: Zq) -> Zq {
    let sum: ZqSum = add(a, b);
    let (_q, rem) = bounded_int_div_rem(sum, nz_q());
    rem
}

/// Subtract two Zq values and reduce mod Q
/// Uses the identity: (a - b) mod Q = (a + Q - b) mod Q
#[inline(always)]
pub fn sub_mod(a: Zq, b: Zq) -> Zq {
    let a_plus_q: BoundedInt<12289, 24577> = add(a, Q_CONST);
    let diff: ZqDiffOffset = sub(a_plus_q, b);
    // diff is in [1, 24577], need to reduce mod Q
    // We can directly use bounded_int_div_rem on the wider range
    let (_q, rem) = bounded_int_div_rem(diff, nz_q());
    rem
}

// Constant Q as BoundedInt
pub const Q_CONST: QConst = 12289;

// DivRem for ZqDiffOffset (subtraction result)
impl DivRemZqDiffOffsetImpl of DivRemHelper<ZqDiffOffset, QConst> {
    type DivT = BoundedInt<0, 1>;
    type RemT = Zq;
}

/// Multiply two Zq values and reduce mod Q
#[inline(always)]
pub fn mul_mod(a: Zq, b: Zq) -> Zq {
    let prod: ZqProd = mul(a, b);
    let (_q, rem) = bounded_int_div_rem(prod, nz_q());
    rem
}

// =============================================================================
// Fused operations for NTT (single reduction per expression)
// =============================================================================

/// Fused: I2 * (a + b) mod Q - used in split_ntt for even coefficients
/// Only ONE modular reduction instead of two
#[inline(always)]
pub fn fused_i2_add_mod(a: Zq, b: Zq) -> Zq {
    let sum: ZqSum = add(a, b);
    let prod: I2xSum = mul(I2_CONST, sum);
    let (_q, rem) = bounded_int_div_rem(prod, nz_q());
    rem
}

/// I2 constant
pub const I2_CONST: I2Const = 6145;

/// I2 * (a - b + Q) * c mod Q - used in split_ntt for odd coefficients
/// Uses TWO modular reductions (down from three in original):
/// 1. Reduce (a - b + Q) first to get diff in Zq
/// 2. Then compute I2 * diff * c and reduce
#[inline(always)]
pub fn fused_i2_sub_mul_mod(a: Zq, b: Zq, c: Zq) -> Zq {
    // First get (a - b) mod Q using sub_mod
    let diff = sub_mod(a, b);
    // Then compute I2 * diff mod Q
    let i2_diff = mul_mod(from_u16(6145), diff);
    // Finally compute (I2 * diff) * c mod Q
    mul_mod(i2_diff, c)
}

/// Fused: a + (b * c) mod Q - used in merge_ntt for even coefficients
/// Only ONE modular reduction instead of two
#[inline(always)]
pub fn fused_add_mul_mod(a: Zq, b: Zq, c: Zq) -> Zq {
    let prod: ZqProd = mul(b, c);
    let sum: ZqSumProd = add(a, prod);
    let (_q, rem) = bounded_int_div_rem(sum, nz_q());
    rem
}

/// Fused: a - (b * c) mod Q - used in merge_ntt for odd coefficients
/// We compute: a + OFFSET - (b * c) where OFFSET = 12288 * Q = 151007232
/// Only ONE modular reduction instead of two
///
/// The offset works because OFFSET mod Q = 0, so adding it doesn't change
/// the result mod Q, but ensures the subtraction stays positive.
#[inline(always)]
pub fn fused_sub_mul_mod(a: Zq, b: Zq, c: Zq) -> Zq {
    let prod: ZqProd = mul(b, c);
    // a + OFFSET gives [OFFSET, OFFSET + 12288] = [151007232, 151019520]
    let a_offset: BoundedInt<151007232, 151019520> = add(a, OFFSET_CONST);
    // Subtraction: [151007232, 151019520] - [0, 150994944] = [12288, 151019520]
    let diff: BoundedInt<12288, 151019520> = sub(a_offset, prod);
    let (_q, rem) = bounded_int_div_rem(diff, nz_q());
    rem
}

/// Offset constant for subtraction: 12288 * Q = 151007232 (divisible by Q)
/// This is the smallest multiple of Q >= max(ZqProd) = 150994944
pub type OffsetConst = UnitInt<151007232>;
pub const OFFSET_CONST: OffsetConst = 151007232;

// AddHelper for a + OFFSET (12288 * Q)
impl AddZqOffsetImpl of AddHelper<Zq, OffsetConst> {
    type Result = BoundedInt<151007232, 151019520>;
}

// =============================================================================
// Fused operations for NTT base case (n=2)
// =============================================================================

/// SQR1 constant = 1479
pub const SQR1_CONST: Sqr1Const = 1479;

/// SQR1_INV constant = 10810
pub const SQR1_INV_CONST: Sqr1InvConst = 10810;

/// Fused: SQR1 * x mod Q - for ntt base case
#[inline(always)]
pub fn fused_sqr1_mul_mod(x: Zq) -> Zq {
    let prod: Sqr1xZq = mul(SQR1_CONST, x);
    let (_q, rem) = bounded_int_div_rem(prod, nz_q());
    rem
}

/// Fused: I2 * (a + b) mod Q (same as fused_i2_add_mod)
/// Alias for clarity in intt base case
#[inline(always)]
pub fn fused_i2_sum_mod(a: Zq, b: Zq) -> Zq {
    fused_i2_add_mod(a, b)
}

/// Fused: I2 * (a - b + Q) * SQR1_INV mod Q - for intt base case
#[inline(always)]
pub fn fused_i2_diff_sqr1inv_mod(a: Zq, b: Zq) -> Zq {
    fused_i2_sub_mul_mod(a, b, from_u16(10810))
}

// =============================================================================
// Legacy API compatibility (takes u16, returns u16)
// These are NOT for hot paths - use BoundedInt versions above
// =============================================================================

/// Add two u16 values modulo Q (legacy compatibility)
pub fn add_mod_u16(a: u16, b: u16) -> u16 {
    to_u16(add_mod(from_u16(a), from_u16(b)))
}

/// Subtract two u16 values modulo Q (legacy compatibility)
pub fn sub_mod_u16(a: u16, b: u16) -> u16 {
    to_u16(sub_mod(from_u16(a), from_u16(b)))
}

/// Multiply two u16 values modulo Q (legacy compatibility)
pub fn mul_mod_u16(a: u16, b: u16) -> u16 {
    to_u16(mul_mod(from_u16(a), from_u16(b)))
}
