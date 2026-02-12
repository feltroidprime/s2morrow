use corelib_imports::bounded_int::upcast;
use falcon::falcon::verify_with_msg_point;
use falcon::ntt::{mul_ntt, ntt_fast};
use falcon::types::{
    FalconPublicKey, FalconSignature, FalconSignatureWithHint, FalconVerificationHint,
};
use falcon::zq::{Zq, from_u16};
use falcon_old::ntt::intt;
use snforge_std::fs::{FileTrait, read_json};

#[derive(Drop, Serde)]
struct Args {
    attestations: Array<Attestation>,
    n: u32,
}

#[derive(Drop, Serde)]
struct Attestation {
    s1: Array<u16>,
    pk: Array<u16>,
    msg_point: Array<u16>,
}

fn load_args() -> Args {
    let file = FileTrait::new("tests/data/args_512_1_int.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    Serde::deserialize(ref span).expect('deserialize failed')
}

/// Convert u16 span to Zq array (only place u16→Zq conversion lives in tests)
fn to_zq_array(s: Span<u16>) -> Array<Zq> {
    let mut r: Array<Zq> = array![];
    for v in s {
        r.append(from_u16(*v));
    }
    r
}

/// Convert Zq span to u16 array (for falcon_old interop)
fn to_u16_array(s: Span<Zq>) -> Array<u16> {
    let mut r: Array<u16> = array![];
    for v in s {
        r.append(upcast(*v));
    }
    r
}

#[test]
fn test_verify_with_msg_point() {
    let args = load_args();
    let att = args.attestations.at(0);

    // Convert u16 test data to Zq for the new API
    let pk_zq = to_zq_array(att.pk.span());
    let s1_zq = to_zq_array(att.s1.span());

    // Test data has pk in coefficient domain; convert to NTT domain
    let pk_ntt = ntt_fast(pk_zq.span());

    // Compute mul_hint = INTT(NTT(s1) * pk_ntt)
    // ntt_fast and mul_ntt return Array<Zq>; falcon_old::intt needs Span<u16>
    let s1_ntt = ntt_fast(s1_zq.span());
    let product_ntt = mul_ntt(s1_ntt.span(), pk_ntt.span());
    let product_ntt_u16 = to_u16_array(product_ntt.span());
    let mul_hint_u16 = intt(product_ntt_u16.span());

    // Convert hint back to Zq for the struct
    let hint_arr = to_zq_array(mul_hint_u16);

    // Clone s1 and pk_ntt for the struct
    let mut s1_arr: Array<Zq> = array![];
    for v in s1_zq.span() {
        s1_arr.append(*v);
    }
    let mut pk_ntt_arr: Array<Zq> = array![];
    for v in pk_ntt.span() {
        pk_ntt_arr.append(*v);
    }

    let msg_point_zq = to_zq_array(att.msg_point.span());

    let pk = FalconPublicKey { h_ntt: pk_ntt_arr };
    let sig = FalconSignature { s1: s1_arr, salt: array![] };
    let hint = FalconVerificationHint { mul_hint: hint_arr };
    let sig_with_hint = FalconSignatureWithHint { signature: sig, hint };

    let result = verify_with_msg_point(@pk, sig_with_hint, msg_point_zq.span());
    assert!(result, "verification should pass");
}

#[test]
#[should_panic(expected: 'hint mismatch')]
fn test_verify_bad_hint_panics() {
    let args = load_args();
    let att = args.attestations.at(0);

    let pk_zq = to_zq_array(att.pk.span());
    let pk_ntt = ntt_fast(pk_zq.span());

    // Build a WRONG hint (all zeros — won't match NTT(s1) * pk_ntt)
    let zero: Zq = from_u16(0);
    let mut bad_hint: Array<Zq> = array![];
    let mut i: usize = 0;
    while i != 512 {
        bad_hint.append(zero);
        i += 1;
    }

    let s1_arr = to_zq_array(att.s1.span());
    let mut pk_ntt_arr: Array<Zq> = array![];
    for v in pk_ntt.span() {
        pk_ntt_arr.append(*v);
    }

    let msg_point_zq = to_zq_array(att.msg_point.span());

    let pk = FalconPublicKey { h_ntt: pk_ntt_arr };
    let sig = FalconSignature { s1: s1_arr, salt: array![] };
    let hint = FalconVerificationHint { mul_hint: bad_hint };
    let sig_with_hint = FalconSignatureWithHint { signature: sig, hint };

    // This should panic with 'intt hint mismatch' because NTT(zeros) != s1_ntt * pk_ntt
    verify_with_msg_point(@pk, sig_with_hint, msg_point_zq.span());
}
