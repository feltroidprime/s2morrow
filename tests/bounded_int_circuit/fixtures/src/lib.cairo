// Test Cairo's bounded_int_div_rem behavior with different dividend ranges
//
// FINDINGS:
// - Cairo's bounded_int_div_rem does NOT support negative dividends
// - Attempting to use negative min bounds causes Sierra specialization failure:
//   "Provided generic argument is unsupported."
//
// This test only includes the positive dividend case that compiles.

#[feature("bounded-int-utils")]
use corelib_imports::bounded_int::{
    BoundedInt, DivRemHelper, UnitInt, bounded_int_div_rem,
};

// =============================================================================
// Test Case 1: Positive Dividend (baseline from Cairo corelib tests)
// =============================================================================
// Dividend: [128, 255], Divisor: [3, 8]
// Quotient: floor(128/8)=16 to floor(255/3)=85
// Remainder: [0, max_divisor - 1] = [0, 7]

impl TestCase1_DivRem of DivRemHelper<BoundedInt<128, 255>, BoundedInt<3, 8>> {
    type DivT = BoundedInt<16, 85>;
    type RemT = BoundedInt<0, 7>;
}

pub fn test_positive_dividend(
    a: BoundedInt<128, 255>,
    b: NonZero<BoundedInt<3, 8>>
) -> (BoundedInt<16, 85>, BoundedInt<0, 7>) {
    bounded_int_div_rem(a, b)
}

// =============================================================================
// Test Case 2: Division with UnitInt divisor (constant)
// =============================================================================
// Dividend: [0, 510], Divisor: 256 (constant)
// Quotient: floor(0/256)=0 to floor(510/256)=1
// Remainder: [0, 255]

impl TestCase2_UnitDivisor of DivRemHelper<BoundedInt<0, 510>, UnitInt<256>> {
    type DivT = BoundedInt<0, 1>;
    type RemT = BoundedInt<0, 255>;
}

pub fn test_constant_divisor(
    a: BoundedInt<0, 510>,
    b: NonZero<UnitInt<256>>
) -> (BoundedInt<0, 1>, BoundedInt<0, 255>) {
    bounded_int_div_rem(a, b)
}

// =============================================================================
// Test Case 3: Wide dividend range
// =============================================================================
// Dividend: [0, 150994944], Divisor: 12289 (constant) - typical NTT reduction
// Quotient: floor(0/12289)=0 to floor(150994944/12289)=12287
// Remainder: [0, 12288]

impl TestCase3_NttReduction of DivRemHelper<BoundedInt<0, 150994944>, UnitInt<12289>> {
    type DivT = BoundedInt<0, 12287>;
    type RemT = BoundedInt<0, 12288>;
}

pub fn test_ntt_reduction(
    a: BoundedInt<0, 150994944>,
    b: NonZero<UnitInt<12289>>
) -> (BoundedInt<0, 12287>, BoundedInt<0, 12288>) {
    bounded_int_div_rem(a, b)
}

// =============================================================================
// Test Case 4: WRONG bounds - Test if Cairo validates them
// =============================================================================
// Dividend: [128, 255], Divisor: [4, 7]
// Correct: q_min=floor(128/7)=18, q_max=floor(255/4)=63
// WRONG Quotient: [0, 100] instead of correct [18, 63]
// This compiles but may fail at runtime if quotient is outside [0,100]

impl TestCase4_WrongBounds of DivRemHelper<BoundedInt<128, 255>, BoundedInt<4, 7>> {
    // DELIBERATELY WRONG: q_min should be 18, not 0
    // DELIBERATELY WRONG: q_max should be 63, not 100
    type DivT = BoundedInt<0, 100>;
    type RemT = BoundedInt<0, 6>;
}

pub fn test_wrong_quotient_bounds(
    a: BoundedInt<128, 255>,
    b: NonZero<BoundedInt<4, 7>>
) -> (BoundedInt<0, 100>, BoundedInt<0, 6>) {
    bounded_int_div_rem(a, b)
}

