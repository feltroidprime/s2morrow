use falcon::ntt::intt_with_hint;
use falcon::zq::Zq;
use corelib_imports::bounded_int::downcast;
use falcon_zknox::ntt_zknox::zknox_nttFW_reduced;
use falcon_zknox::intt_zknox::zknox_inttFW_reduced;
use snforge_std::fs::{FileTrait, read_json};

#[derive(Drop, Serde)]
struct NttJson {
    input: Array<felt252>,
}

/// Load felt252 values from a JSON file with format {"input": [N, v0, ..., vN-1]}.
/// Uses Serde deserialization (matching test_verify.cairo pattern) to avoid manual index math.
fn load_json_input(path: ByteArray) -> Span<felt252> {
    let file = FileTrait::new(path);
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    let data: NttJson = Serde::deserialize(ref span).expect('deserialize failed');
    data.input.span()
}

/// Convert felt252 span to Zq array (for test interop)
fn felt_to_zq(input: Span<felt252>) -> Array<Zq> {
    let mut result: Array<Zq> = array![];
    for v in input {
        result.append(downcast(*v).expect('value exceeds Q-1'));
    };
    result
}

fn load_ntt_input() -> Span<felt252> {
    load_json_input("tests/data/ntt_input_512_int.json")
}

fn load_intt_input() -> Span<felt252> {
    load_json_input("tests/data/intt_input_512_int.json")
}

fn load_intt_expected() -> Span<felt252> {
    load_json_input("tests/data/intt_expected_512_int.json")
}

#[test]
fn test_intt_with_hint_512() {
    let ntt_input = load_intt_input();
    let hint = load_intt_expected();

    // Convert to Zq
    let ntt_zq = felt_to_zq(ntt_input);
    let hint_zq = felt_to_zq(hint);

    let result = intt_with_hint(ntt_zq.span(), hint_zq.span());
    assert_eq!(result.len(), 512);

    // Verify result matches expected
    let mut j: usize = 0;
    while j < 512 {
        assert_eq!(*result.at(j), *hint_zq.at(j), "mismatch at index {}", j);
        j += 1;
    };
}

#[test]
fn test_intt_zknox_roundtrip() {
    let input = load_ntt_input();

    // Clone input for comparison
    let mut input_clone: Array<felt252> = array![];
    let mut i: usize = 0;
    while i < input.len() {
        input_clone.append(*input.at(i));
        i += 1;
    };

    // NTT forward (zknox)
    let ntt_result = zknox_nttFW_reduced(input_clone.span());

    // INTT inverse (zknox)
    let roundtrip = zknox_inttFW_reduced(ntt_result);
    assert_eq!(roundtrip.len(), 512);

    // Compare element-by-element with original input
    let mut j: usize = 0;
    while j < 512 {
        assert_eq!(*roundtrip.at(j), *input.at(j), "mismatch at index {}", j);
        j += 1;
    };
}

#[test]
fn test_intt_zknox_512() {
    let input = load_ntt_input();

    // Run NTT to get valid INTT input, then benchmark INTT
    let ntt_output = zknox_nttFW_reduced(input);
    let result = zknox_inttFW_reduced(ntt_output);
    assert_eq!(result.len(), 512);
}
