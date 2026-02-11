//! Poseidon XOF hash_to_point for Falcon-512.
//!
//! Produces 512 Zq coefficients from (message, salt) using:
//! - Poseidon sponge (rate=2, capacity=1) in XOF mode
//! - Base-Q extraction: felt252 -> u256 -> 2x u128 -> 6 DivRem-by-Q each -> 12 Zq per felt252
//!
//! Security: each coefficient comes from reducing a >=50-bit value mod Q.
//! Per Renyi analysis (scripts/renyi.md), this gives <=0.37 bits security loss.

use corelib_imports::bounded_int::{BoundedInt, DivRemHelper, bounded_int_div_rem, downcast, upcast};
use core::poseidon::hades_permutation;
use falcon::zq::{Zq, QConst, nz_q};
use falcon::types::HashToPoint;

// =============================================================================
// LOW extraction chain (from u128, 128 bits -> 6 Zq)
// Starting type: u128 = BoundedInt<0, 2^128-1>
// Each DivRem by Q removes ~13.585 bits. 6 safe coefficients (input >= 50 bits).
// =============================================================================

type ExtractLQ1 = BoundedInt<0, 27689996494502275487295516920153650>;
type ExtractLQ2 = BoundedInt<0, 2253234314793903123711898195146>;
type ExtractLQ3 = BoundedInt<0, 183353756594833031468133956>;
type ExtractLQ4 = BoundedInt<0, 14920152705251284194656>;
type ExtractLQ5 = BoundedInt<0, 1214106331292317047>;
type ExtractLQ6 = BoundedInt<0, 98796186125178>; // discarded (~47 bits)

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
// Tighter bound than u128 -> separate type chain with exact quotient bounds.
// =============================================================================

type FeltHigh = BoundedInt<0, 10633823966279327296825105735305134080>;

type ExtractHQ1 = BoundedInt<0, 865312390453196134496306105891865>;
type ExtractHQ2 = BoundedInt<0, 70413572337309474692514126933>;
type ExtractHQ3 = BoundedInt<0, 5729804893588532402352846>;
type ExtractHQ4 = BoundedInt<0, 466254772039102644833>;
type ExtractHQ5 = BoundedInt<0, 37940822852884908>;
type ExtractHQ6 = BoundedInt<0, 3087380816411>; // discarded (~42 bits)

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

// =============================================================================
// Extraction functions: base-Q digit extraction via DivRem chains
// =============================================================================

/// Extract 6 Zq coefficients from a u128 value via successive DivRem by Q.
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

/// Extract 6 Zq coefficients from the high part of a felt252 (FeltHigh).
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

/// Extract 12 Zq coefficients from a felt252: 6 from low u128, 6 from high FeltHigh.
fn extract_12_from_felt252(value: felt252, ref coeffs: Array<u16>) {
    let val_u256: u256 = value.into();
    extract_6_from_low(val_u256.low, ref coeffs);
    let high_bounded: FeltHigh = downcast(val_u256.high).expect('high exceeds FeltHigh');
    extract_6_from_high(high_bounded, ref coeffs);
}

// =============================================================================
// Poseidon sponge (rate=2, capacity=1)
// =============================================================================

/// Absorb a span of felt252 elements into the sponge state using rate-2 absorption.
/// Odd-length inputs are padded with 1.
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
// HashToPoint implementation using Poseidon XOF
// =============================================================================

#[derive(Drop)]
pub struct PoseidonHashToPoint {}

pub impl PoseidonHashToPointImpl of HashToPoint<PoseidonHashToPoint> {
    fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<u16> {
        let (mut s0, mut s1, mut s2): (felt252, felt252, felt252) = (0, 0, 0);

        absorb(ref s0, ref s1, ref s2, message);
        absorb(ref s0, ref s1, ref s2, salt);
        s2 += 1; // domain separation before squeeze

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
        let mut result: Array<u16> = array![];
        for v in coeffs.span().slice(0, 512) {
            result.append(*v);
        };
        result
    }
}
