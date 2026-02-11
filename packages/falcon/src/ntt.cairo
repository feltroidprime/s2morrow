// SPDX-FileCopyrightText: 2025 StarkWare Industries Ltd.
//
// SPDX-License-Identifier: MIT

//! NTT operations for Falcon-512 signature verification.
//!
//! Uses the auto-generated unrolled NTT (ntt_felt252) for n=512 only.
//! No recursive NTT or INTT — verification uses hint-based approach.

use crate::ntt_felt252::ntt_512;
use crate::zq::{from_u16, mul_mod, sub_mod, to_u16};

/// Subtract coefficients of two polynomials modulo Q
pub fn sub_zq(mut f: Span<u16>, mut g: Span<u16>) -> Span<u16> {
    assert(f.len() == g.len(), 'f.len() != g.len()');
    let mut res = array![];

    while let Some(f_coeff) = f.pop_front() {
        let g_coeff = g.pop_front().unwrap();
        let f_zq = from_u16(*f_coeff);
        let g_zq = from_u16(*g_coeff);
        res.append(to_u16(sub_mod(f_zq, g_zq)));
    }

    res.span()
}

/// Multiply coefficients of two polynomials modulo Q (pointwise in NTT domain)
pub fn mul_ntt(mut f: Span<u16>, mut g: Span<u16>) -> Span<u16> {
    assert(f.len() == g.len(), 'f.len() != g.len()');
    let mut res = array![];

    while let Some(f_coeff) = f.pop_front() {
        let g_coeff = g.pop_front().unwrap();
        let f_zq = from_u16(*f_coeff);
        let g_zq = from_u16(*g_coeff);
        res.append(to_u16(mul_mod(f_zq, g_zq)));
    }

    res.span()
}

/// Compute NTT of a 512-element polynomial using the unrolled felt252 implementation.
pub fn ntt_fast(f: Span<u16>) -> Span<u16> {
    assert(f.len() == 512, 'ntt_fast requires n=512');

    // Convert u16 -> felt252
    let mut felt_input: Array<felt252> = array![];
    for val in f {
        felt_input.append((*val).into());
    };

    // Call fast NTT
    let result = ntt_512(felt_input.span());

    // Convert felt252 -> u16
    let mut u16_result: Array<u16> = array![];
    for val in result.span() {
        u16_result.append((*val).try_into().unwrap());
    };
    u16_result.span()
}

/// Verify an INTT result supplied as a hint.
/// Given f_ntt (NTT-domain polynomial) and result_hint (claimed coefficients),
/// verifies that NTT(result_hint) == f_ntt element-by-element.
/// Returns the verified result.
pub fn intt_with_hint(f_ntt: Span<u16>, result_hint: Span<u16>) -> Span<u16> {
    assert(f_ntt.len() == result_hint.len(), 'length mismatch');

    // Compute NTT of the hint using the fast unrolled implementation
    let roundtrip = ntt_fast(result_hint);

    // Verify element-by-element
    let mut f_iter = f_ntt;
    let mut r_iter = roundtrip;
    while let Some(f_val) = f_iter.pop_front() {
        assert(f_val == r_iter.pop_front().unwrap(), 'intt hint mismatch');
    };

    result_hint
}
