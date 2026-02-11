use falcon::falcon::{verify};
use falcon::hash_to_point::{PoseidonHashToPoint, PoseidonHashToPointImpl};
use falcon::packing::{pack_public_key, unpack_public_key};
use falcon::types::{FalconPublicKey, FalconSignature, FalconVerificationHint, FalconSignatureWithHint};
use snforge_std::fs::{FileTrait, read_json};

#[derive(Drop, Serde)]
struct HashToPointTest {
    message: Array<felt252>,
    salt: Array<felt252>,
    expected: Array<u16>,
}

#[derive(Drop, Serde)]
struct PackingTest {
    values: Array<u16>,
    packed: Array<felt252>,
}

#[derive(Drop, Serde)]
struct VerifyTest {
    message: Array<felt252>,
    salt: Array<felt252>,
    pk_ntt: Array<u16>,
    s1: Array<u16>,
    mul_hint: Array<u16>,
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
    };

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
