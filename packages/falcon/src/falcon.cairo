// SPDX-FileCopyrightText: 2025 StarkWare Industries Ltd.
//
// SPDX-License-Identifier: MIT

use crate::ntt::ntt_fast;
use crate::zq::{Zq, mul_mod, sub_mod};
use falcon::types::{FalconPublicKey, FalconSignatureWithHint, HashToPoint};
use corelib_imports::bounded_int::{BoundedInt, downcast, upcast};

/// Zq value in the low half: [0, (Q-1)/2] = [0, 6144]
type ZqLow = BoundedInt<0, 6144>;
const Q_felt252: felt252 = 12289;

/// Compute the squared centered norm of a single Zq element.
#[inline(always)]
fn center_and_square(coeff: Zq) -> felt252 {
    match downcast::<Zq, ZqLow>(coeff) {
        Option::Some(low) => {
            let x: felt252 = upcast(low);
            x * x
        },
        Option::None => {
            let x: felt252 = upcast(coeff);
            let centered = Q_felt252 - x;
            centered * centered
        },
    }
}

/// Signature bound for Falcon-512
const SIG_BOUND_512: u64 = 34034726;

/// Verify a Falcon signature using the hint-based approach.
/// Computes msg_point internally via hash_to_point.
/// Cost: 2 NTTs, 0 INTTs.
pub fn verify<H, +HashToPoint<H>, +Drop<H>>(
    pk: @FalconPublicKey, sig_with_hint: FalconSignatureWithHint, message: Span<felt252>,
) -> bool {
    let msg_point = HashToPoint::<H>::hash_to_point(message, sig_with_hint.signature.salt.span());
    verify_with_msg_point(pk, sig_with_hint, msg_point.span())
}

/// Verify with a pre-computed msg_point (useful for testing without hash_to_point).
///
/// Single-pass verification: 2 unrolled NTTs + 1 fused loop that does
/// hint verification, pointwise multiply check, and norm computation.
pub fn verify_with_msg_point(
    pk: @FalconPublicKey,
    sig_with_hint: FalconSignatureWithHint,
    msg_point: Span<Zq>,
) -> bool {
    let s1 = sig_with_hint.signature.s1.span();
    let pk_ntt = pk.h_ntt.span();
    let mul_hint = sig_with_hint.hint.mul_hint.span();

    assert!(s1.len() == 512, "s1 must be 512 elements");
    assert!(pk_ntt.len() == 512, "pk must be 512 elements");
    assert!(mul_hint.len() == 512, "mul_hint must be 512 elements");
    assert!(msg_point.len() == 512, "msg_point must be 512 elements");

    // Two forward NTTs (unrolled, no loops)
    let s1_ntt = ntt_fast(s1);
    let hint_ntt = ntt_fast(mul_hint);

    // Single pass over all 512 coefficients:
    //   - Verify hint: s1_ntt[i] * pk_ntt[i] == NTT(mul_hint)[i]
    //   - Accumulate: ||msg_point - mul_hint||² + ||s1||²
    let mut s1_ntt_iter = s1_ntt.span();
    let mut pk_ntt_iter = pk_ntt;
    let mut hint_ntt_iter = hint_ntt.span();
    let mut msg_iter = msg_point;
    let mut hint_iter = mul_hint;
    let mut s1_iter = s1;

    let mut acc: felt252 = 0;
    while let Some(s1n) = s1_ntt_iter.pop_front() {
        let pkn = pk_ntt_iter.pop_front().unwrap();
        let hn = hint_ntt_iter.pop_front().unwrap();
        let msg = msg_iter.pop_front().unwrap();
        let hint = hint_iter.pop_front().unwrap();
        let s1v = s1_iter.pop_front().unwrap();

        // Verify: NTT(s1)[i] * pk_ntt[i] == NTT(mul_hint)[i]
        assert(mul_mod(*s1n, *pkn) == *hn, 'hint mismatch');

        // Accumulate: ||msg_point - mul_hint||² + ||s1||²
        let diff = sub_mod(*msg, *hint);
        acc += center_and_square(diff) + center_and_square(*s1v);
    };

    let norm_u64: u64 = acc.try_into().unwrap();
    norm_u64 <= SIG_BOUND_512
}
