// SPDX-FileCopyrightText: 2025 StarkWare Industries Ltd.
//
// SPDX-License-Identifier: MIT

use crate::ntt::{sub_zq, ntt_fast, mul_ntt, intt_with_hint};
use crate::zq::Zq;
use falcon::types::{FalconPublicKey, FalconSignatureWithHint, HashToPoint};
use corelib_imports::bounded_int::{BoundedInt, downcast, upcast};

/// Zq value in the low half: [0, (Q-1)/2] = [0, 6144]
type ZqLow = BoundedInt<0, 6144>;
const Q_felt252: felt252 = 12289;
/// Compute sum of squared centered coefficients: sum(min(x, Q-x)^2 for x in f)
/// Uses downcast to split at Q/2 (1 range check per element), then felt252
/// arithmetic for squaring and accumulation (no overflow, no range checks).
fn norm_squared(mut f: Span<Zq>) -> felt252 {
    let mut acc: felt252 = 0;
    while let Some(coeff) = f.pop_front() {
        let sq: felt252 = match downcast::<Zq, ZqLow>(*coeff) {
            Option::Some(low) => {
                let x: felt252 = upcast(low);
                x * x
            },
            Option::None => {
                let x: felt252 = upcast(*coeff);
                let centered = Q_felt252 - x;
                centered * centered
            },
        };
        acc += sq;
    };
    acc
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

    // 1. s1_ntt = NTT(s1)
    let s1_ntt = ntt_fast(s1);

    // 2. product_ntt = s1_ntt * pk_ntt (pointwise mod Q)
    let product_ntt = mul_ntt(s1_ntt.span(), pk_ntt);

    // 3. Verify hint: checks that NTT(mul_hint) == product_ntt (costs 1 NTT)
    let product = intt_with_hint(product_ntt.span(), mul_hint);

    // 4. s0 = msg_point - product (coefficient-wise mod Q)
    let s0 = sub_zq(msg_point, product);

    // 5. Norm check: ||s0||^2 + ||s1||^2 <= SIG_BOUND
    let norm = norm_squared(s0.span()) + norm_squared(s1);
    let norm_u64: u64 = norm.try_into().unwrap();
    norm_u64 <= SIG_BOUND_512
}
