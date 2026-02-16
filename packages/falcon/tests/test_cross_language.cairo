use falcon::falcon::{verify, verify_packed};
use falcon::hash_to_point::{PoseidonHashToPoint, PoseidonHashToPointImpl};
use falcon::packing::{PackedPolynomial512Trait, pack_public_key, unpack_public_key};
use falcon::types::{
    FalconPublicKey, FalconSignature, FalconSignatureWithHint, FalconVerificationHint,
    PackedFalconSignature, PackedFalconSignatureWithHint, PackedFalconVerificationHint,
};
use falcon::zq::Zq;
use snforge_std::fs::{FileTrait, read_json};

#[derive(Drop, Serde)]
struct HashToPointTest {
    message: Array<felt252>,
    salt: Array<felt252>,
    expected: Array<Zq>,
}

#[derive(Drop, Serde)]
struct PackingTest {
    values: Array<Zq>,
    packed: Array<felt252>,
}

#[derive(Drop, Serde)]
struct VerifyTest {
    message: Array<felt252>,
    salt: Array<felt252>,
    pk_ntt: Array<Zq>,
    s1: Array<Zq>,
    mul_hint: Array<Zq>,
}

fn load_hash_to_point_test() -> HashToPointTest {
    let file = FileTrait::new("tests/data/hash_to_point_test_int.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    Serde::deserialize(ref span).expect('deserialize failed')
}

fn load_packing_test() -> PackingTest {
    let file = FileTrait::new("tests/data/packing_test_int.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    Serde::deserialize(ref span).expect('deserialize failed')
}

#[test]
fn test_hash_to_point_matches_rust() {
    let test = load_hash_to_point_test();
    let result = PoseidonHashToPointImpl::hash_to_point(test.message.span(), test.salt.span());

    let result_span = result.span();
    let expected_span = test.expected.span();
    assert_eq!(result_span.len(), expected_span.len());
    let mut i: usize = 0;
    while i != 512 {
        assert_eq!(*result_span.at(i), *expected_span.at(i), "mismatch at index {}", i);
        i += 1;
    };
}

#[test]
fn test_packing_matches_rust() {
    let test = load_packing_test();

    // Test pack: Cairo pack should produce same felt252 values as Rust
    let packed = pack_public_key(test.values.span());
    let packed_span = packed.span();
    let test_packed_span = test.packed.span();
    assert_eq!(packed_span.len(), test_packed_span.len());
    let mut i: usize = 0;
    while i != packed_span.len() {
        assert_eq!(*packed_span.at(i), *test_packed_span.at(i), "pack mismatch at slot {}", i);
        i += 1;
    }

    // Test unpack: unpack Rust-generated packed values
    let unpacked = unpack_public_key(test.packed.span());
    let unpacked_span = unpacked.span();
    let values_span = test.values.span();
    assert_eq!(unpacked_span.len(), values_span.len());
    i = 0;
    while i != 512 {
        assert_eq!(*unpacked_span.at(i), *values_span.at(i), "unpack mismatch at index {}", i);
        i += 1;
    };
}

fn load_verify_test() -> VerifyTest {
    let file = FileTrait::new("tests/data/verify_test_int.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    Serde::deserialize(ref span).expect('deserialize failed')
}

#[test]
fn test_verify_matches_rust() {
    let test = load_verify_test();

    let pk = FalconPublicKey { h_ntt: test.pk_ntt };
    let sig = FalconSignature { s1: test.s1, salt: test.salt };
    let hint = FalconVerificationHint { mul_hint: test.mul_hint };
    let sig_with_hint = FalconSignatureWithHint { signature: sig, hint: hint };

    let result = verify::<PoseidonHashToPoint>(@pk, sig_with_hint, test.message.span());
    assert!(result, "Falcon verify with Poseidon hash should pass");
}

#[test]
fn test_verify_packed_matches_rust() {
    let test = load_verify_test();

    let pk_packed = PackedPolynomial512Trait::from_coeffs(test.pk_ntt.span());
    let s1_packed = PackedPolynomial512Trait::from_coeffs(test.s1.span());
    let mul_hint_packed = PackedPolynomial512Trait::from_coeffs(test.mul_hint.span());

    let sig = PackedFalconSignatureWithHint {
        signature: PackedFalconSignature { s1: s1_packed, salt: test.salt },
        hint: PackedFalconVerificationHint { mul_hint: mul_hint_packed },
    };

    let result = verify_packed::<PoseidonHashToPoint>(@pk_packed, sig, test.message.span());
    assert!(result, "verify_packed with Poseidon hash should pass");
}
