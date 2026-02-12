// SPDX-FileCopyrightText: 2025 StarkWare Industries Ltd.
//
// SPDX-License-Identifier: MIT

use core::num::traits::{CheckedAdd, CheckedMul};
use crate::ntt::{sub_zq, ntt_fast, mul_ntt, intt_with_hint};
use crate::zq::Zq;
use falcon::types::{FalconPublicKey, FalconSignatureWithHint, HashToPoint};
use corelib_imports::bounded_int::upcast;

/// Half of the base ring modulus
const HALF_Q: u32 = 6145;
/// Base ring modulus
const Q_U32: u32 = 12289;

#[derive(Drop, Debug)]
pub enum FalconVerificationError {
    NormOverflow,
}

/// Compute the Euclidean norm of a polynomial and add it to the accumulator
fn extend_euclidean_norm(mut acc: u32, mut f: Span<Zq>) -> Result<u32, FalconVerificationError> {
    let mut res = Ok(0);
    while let Some(f_coeff) = f.pop_front() {
        match norm_square_and_add(acc, *f_coeff) {
            Some(res) => acc = res,
            None => {
                res = Result::Err(FalconVerificationError::NormOverflow);
                break;
            },
        }
    }
    match res {
        Ok(_) => Ok(acc),
        Err(e) => Err(e),
    }
}

/// Normalize the value square to be in the range [0, Q^2/4] and add it to an accumulator
fn norm_square_and_add(acc: u32, x: Zq) -> Option<u32> {
    let x_u32: u32 = upcast(x);
    let x_centered: u32 = if x_u32 < HALF_Q {
        x_u32
    } else {
        Q_U32 - x_u32
    };
    match x_centered.checked_mul(x_centered) {
        Some(x_sq) => acc.checked_add(x_sq),
        None => None,
    }
}

/// Signature bound for Falcon-512
const SIG_BOUND_512: u32 = 34034726;

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
    let mut norm: u32 = 0;
    match extend_euclidean_norm(norm, s0.span()) {
        Result::Ok(n) => norm = n,
        Result::Err(_) => { return false; },
    }
    match extend_euclidean_norm(norm, s1) {
        Result::Ok(n) => norm = n,
        Result::Err(_) => { return false; },
    }

    norm <= SIG_BOUND_512
}
