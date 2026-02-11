//! Poseidon XOF hash_to_point for Falcon-512.
//!
//! Produces 512 Zq coefficients from (message, salt) using:
//! - Poseidon sponge (rate=2, capacity=1) in XOF mode
//! - Base-Q extraction: felt252 -> u256 -> 2x u128 -> 6 DivRem-by-Q each -> 12 Zq per felt252
//!
//! Security: each coefficient comes from reducing a >=50-bit value mod Q.
//! Per Renyi analysis (scripts/renyi.md), this gives <=0.37 bits security loss.

use corelib_imports::bounded_int::{BoundedInt, DivRemHelper};
use falcon::zq::{Zq, QConst};

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
