use core::ecdsa::check_ecdsa_signature;
use starknet::secp256_trait::{Secp256PointTrait, is_valid_signature};
use starknet::secp256k1::{Secp256k1Impl, Secp256k1Point};
use starknet::secp256r1::{Secp256r1Impl, Secp256r1Point};
use starknet::SyscallResultTrait;

use garaga::core::circuit::u288IntoCircuitInputValue;
use garaga::definitions::G1Point;
use garaga::signatures::ecdsa::{ECDSASignatureWithHint, is_valid_ecdsa_signature_assuming_hash};

// ─── Corelib (syscall-based) ────────────────────────────────────────────────

/// Benchmark: native Stark curve ECDSA signature verification.
/// Uses check_ecdsa_signature (built-in, no syscall).
#[test]
fn bench_stark_ecdsa() {
    let message_hash = 0x503f4bea29baee10b22a7f10bdc82dda071c977c1f25b8f3973d34e6b03b2c;
    let public_key = 0x7b7454acbe7845da996377f85eb0892044d75ae95d04d3325a391951f35d2ec;
    let signature_r = 0xbe96d72eb4f94078192c2e84d5230cde2a70f4b45c8797e2c907acff5060bb;
    let signature_s = 0x677ae6bba6daf00d2631fab14c8acf24be6579f9d9e98f67aa7f2770e57a1f5;

    let result = check_ecdsa_signature(:message_hash, :public_key, :signature_r, :signature_s);
    assert!(result, "Stark ECDSA verification should pass");
}

/// Benchmark: secp256k1 (Bitcoin/Ethereum curve) signature verification.
/// Uses is_valid_signature via secp256k1 syscall.
#[test]
fn bench_secp256k1_corelib() {
    let msg_hash = 0xe888fbb4cf9ae6254f19ba12e6d9af54788f195a6f509ca3e934f78d7a71dd85_u256;
    let r = 0x4c8e4fbc1fbb1dece52185e532812c4f7a5f81cf3ee10044320a0d03b62d3e9a_u256;
    let s = 0x4ac5e5c0c0e8a4871583cc131f35fb49c2b7f60e6a8b84965830658f08f7410c_u256;
    let public_key_x = 0xa9a02d48081294b9bb0d8740d70d3607feb20876964d432846d9b9100b91eefd_u256;
    let public_key_y = 0x18b410b5523a1431024a6ab766c89fa5d062744c75e49efb9925bf8025a7c09e_u256;

    let public_key = Secp256k1Impl::secp256_ec_new_syscall(public_key_x, public_key_y)
        .unwrap_syscall()
        .unwrap();

    let is_valid = is_valid_signature::<Secp256k1Point>(msg_hash, r, s, public_key);
    assert!(is_valid, "secp256k1 verification should pass");
}

/// Benchmark: secp256r1 (NIST P-256) signature verification.
/// Uses is_valid_signature via secp256r1 syscall.
#[test]
fn bench_secp256r1_corelib() {
    let msg_hash = 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855_u256;
    let r = 0xb292a619339f6e567a305c951c0dcbcc42d16e47f219f9e98e76e09d8770b34a_u256;
    let s = 0x177e60492c5a8242f76f07bfe3661bde59ec2a17ce5bd2dab2abebdf89a62e2_u256;
    let public_key_x = 0x04aaec73635726f213fb8a9e64da3b8632e41495a944d0045b522eba7240fad5_u256;
    let public_key_y = 0x0087d9315798aaa3a5ba01775787ced05eaaf7b4e09fc81d6d1aa546e8365d525d_u256;

    let public_key = Secp256r1Impl::secp256_ec_new_syscall(public_key_x, public_key_y)
        .unwrap_syscall()
        .unwrap();

    let is_valid = is_valid_signature::<Secp256r1Point>(msg_hash, r, s, public_key);
    assert!(is_valid, "secp256r1 verification should pass");
}

// ─── Garaga (pure Cairo circuit-based) ──────────────────────────────────────

/// Benchmark: secp256k1 via garaga (pure Cairo, no syscall).
/// curve_id = 2 (secp256k1)
#[test]
fn bench_secp256k1_garaga() {
    let mut ecdsa_sig_with_hints_serialized = array![
        0x393dead57bc85a6e9bb44a70, 0x64d4b065b3ede27cf9fb9e5c, 0xda670c8c69a8ce0a, 0x0,
        0x789872895ad7121175bd78f8, 0xc0deb0b56fb251e8fb5d0a8d, 0x3f10d670dc3297c2, 0x0,
        0x2965eeb3ec1fe786a6abe874, 0x33e2545f82bb6add02788b8e, 0xf586bc0db335d7b8, 0x0,
        0x6bb797837f385ccf8ea3b9b6e7074b68, 0x123ea74e335845008c7f5f797313610f, 0x0,
        0xeb1167b367a9c3787c65c1e582e2e663, 0xf7c1bd874da5e709d4713d60c8a70639, 0x18,
        0xed540ba7da3f81bbaa728909, 0x893eeca8c449fc9407668128, 0x4c72a831e28b48, 0x0,
        0xf7ae1bf4ac84c840ee8163eb, 0xfb80d24687ae79865523f56d, 0xebddaf8646d563b7, 0x0,
        0x5763a6a1517232b0, 0x100000000000000003fa616b9d1aa135b, 0x2ee3ef80f868d011,
        0x100000000000000003fe78eccc1da3303, 0x3baca0be7f388c0f13f91502, 0x279cead44672432f6083c7de,
        0x7b7ead3b5811d2dd, 0x0, 0x5bbc00623473536e653b34f3, 0xe4d94e156ddc62c1d41c68f4,
        0xe635b285558b642c, 0x0, 0x1000000000000000097e848fb19a47c06,
        0x100000000000000003dc81ff2129521cf, 0xdfac131bb3bb11de, 0xafc939cc6fed0eee,
    ]
        .span();
    let public_key = Serde::<G1Point>::deserialize(ref ecdsa_sig_with_hints_serialized)
        .expect('FailToDeserializePk');
    let ecdsa_with_hints = Serde::<
        ECDSASignatureWithHint,
    >::deserialize(ref ecdsa_sig_with_hints_serialized)
        .expect('FailToDeserializeSig');
    let is_valid = is_valid_ecdsa_signature_assuming_hash(ecdsa_with_hints, public_key, 2);
    assert!(is_valid);
}

/// Benchmark: secp256r1 via garaga (pure Cairo, no syscall).
/// curve_id = 3 (secp256r1)
#[test]
fn bench_secp256r1_garaga() {
    let mut ecdsa_sig_with_hints_serialized = array![
        0x113c8d620e3745e45e4389b8, 0x85b8ff52d905fd02fe191c3f, 0xf5d132d685201517, 0x0,
        0x60c0ba1b358f375b2362662e, 0x6abfc829d93e09aa5174ec04, 0x7bc4637aca93cb5a, 0x0,
        0x46ae31f6fc294ad0814552b6, 0x2d54cc811efaf988efb3de23, 0x2a2cc02b8f0c419f, 0x0,
        0x47e8f962616a171283a1176e90490f33, 0xde5c72ea3ea08688ab2876686671cca8, 0x1,
        0xeb1167b367a9c3787c65c1e582e2e663, 0xf7c1bd874da5e709d4713d60c8a70639, 0x14,
        0x286091616e02ba0069d28be8, 0x1d9745f8427b797bfae94bc9, 0xb3eb1f4823aa5b9f, 0x0,
        0xd955b1c2d5dbf2b7ce1f8cc0, 0xd9d9fdc9f4834421e0583e30, 0x8bab0f5e16efdcd5, 0x0,
        0xeae9da0724797b8c4deebd03881e0a93, 0x168a1a12c6aaa58209ea9db2a7f1a2b2f,
        0x94038dc6b682d83583f52251, 0x2c3509157e0085975bedd577, 0x1e00bb14af9e8bf8, 0x0,
        0x3017341aa1f59a0d17c013c5, 0x51583e6cc584e0a8145045aa, 0xb9220afd0e923820, 0x0,
        0xd0446b1605d4f3bfb5a82b168ba1b43, 0x1ab0f41000c73e671352e746066899a70,
    ]
        .span();
    let public_key = Serde::<G1Point>::deserialize(ref ecdsa_sig_with_hints_serialized)
        .expect('FailToDeserializePk');
    let ecdsa_with_hints = Serde::<
        ECDSASignatureWithHint,
    >::deserialize(ref ecdsa_sig_with_hints_serialized)
        .expect('FailToDeserializeSig');
    let is_valid = is_valid_ecdsa_signature_assuming_hash(ecdsa_with_hints, public_key, 3);
    assert!(is_valid);
}
