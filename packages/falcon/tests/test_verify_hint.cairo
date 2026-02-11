use falcon::falcon::verify_with_msg_point;
use falcon::types::{
    FalconPublicKey, FalconSignature, FalconSignatureWithHint, FalconVerificationHint,
};
use falcon::ntt::{ntt_fast, mul_ntt, intt};
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

#[test]
fn test_verify_with_msg_point() {
    let args = load_args();
    let att = args.attestations.at(0);

    // Test data has pk in coefficient domain; convert to NTT domain
    let pk_ntt = ntt_fast(att.pk.span());

    // Compute mul_hint = INTT(NTT(s1) * pk_ntt) using existing functions
    let s1_ntt = ntt_fast(att.s1.span());
    let product_ntt = mul_ntt(s1_ntt, pk_ntt);
    let mul_hint_span = intt(product_ntt);

    // Clone into arrays for the struct
    let mut s1_arr: Array<u16> = array![];
    for v in att.s1.span() {
        s1_arr.append(*v);
    };
    let mut hint_arr: Array<u16> = array![];
    for v in mul_hint_span {
        hint_arr.append(*v);
    };
    let mut pk_ntt_arr: Array<u16> = array![];
    for v in pk_ntt {
        pk_ntt_arr.append(*v);
    };

    let pk = FalconPublicKey { h_ntt: pk_ntt_arr };
    let sig = FalconSignature { s1: s1_arr, salt: array![] };
    let hint = FalconVerificationHint { mul_hint: hint_arr };
    let sig_with_hint = FalconSignatureWithHint { signature: sig, hint };

    let result = verify_with_msg_point(@pk, sig_with_hint, att.msg_point.span());
    assert!(result, "verification should pass");
}
