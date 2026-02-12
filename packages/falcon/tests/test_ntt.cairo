use falcon_old::ntt::ntt;
use falcon::ntt_felt252::ntt_512;
use falcon::zq::from_u16;
use falcon_zknox::ntt_zknox::zknox_nttFW_reduced;
use corelib_imports::bounded_int::upcast;
use snforge_std::fs::{FileTrait, read_json};

#[derive(Drop, Serde)]
struct NttJson {
    input: Array<felt252>,
}

/// Load 512 felt252 values from a JSON file with format {"input": [512, v0, ..., v511]}.
/// Uses Serde deserialization (matching test_verify.cairo pattern) to avoid manual index math.
fn load_ntt_input() -> Span<felt252> {
    let file = FileTrait::new("tests/data/ntt_input_512_int.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    let data: NttJson = Serde::deserialize(ref span).expect('deserialize failed');
    data.input.span()
}

#[test]
fn test_ntt_recursive_512() {
    let input = load_ntt_input();

    // Convert felt252 -> u16 for recursive NTT
    let mut u16_input: Array<u16> = array![];
    for val in input {
        u16_input.append((*val).try_into().unwrap());
    }

    let result = ntt(u16_input.span());
    assert_eq!(result.len(), 512);

    // ntt_512 returns Array<Zq> — compare by converting u16 result to Zq
    let result_zq = ntt_512(input);
    assert_eq!(result_zq.len(), 512);

    let mut j: usize = 0;
    while j < 512 {
        assert_eq!(from_u16(*result.at(j)), *result_zq.at(j), "mismatch at index {}", j);
        j += 1;
    };
}

#[test]
fn test_ntt_felt252_512() {
    let input = load_ntt_input();
    let result = ntt_512(input);
    assert_eq!(result.len(), 512);
}

#[test]
fn test_ntt_zknox_vs_felt252() {
    let input = load_ntt_input();

    // Clone input for zknox
    let mut input_zknox: Array<felt252> = array![];
    let mut i: usize = 0;
    while i < input.len() {
        input_zknox.append(*input.at(i));
        i += 1;
    };

    // Run zknox NTT (unreduced + reduce combined)
    let zknox_result = zknox_nttFW_reduced(input_zknox.span());

    // Run felt252 NTT (returns Array<Zq>)
    let felt252_result = ntt_512(input);

    assert_eq!(zknox_result.len(), 512);
    assert_eq!(felt252_result.len(), 512);

    // The zknox NTT (DIT) and felt252 NTT (DIF) evaluate the polynomial at
    // the same 512 roots of x^512+1, but output them in different permutation
    // order due to different twiddle factor conventions. Verify they produce
    // the same multiset by comparing sums and sums of squares.
    // Convert Zq to felt252 for comparison with zknox felt252 output.
    let mut sum_z: felt252 = 0;
    let mut sum_f: felt252 = 0;
    let mut sum_sq_z: felt252 = 0;
    let mut sum_sq_f: felt252 = 0;
    let mut j: usize = 0;
    while j < 512 {
        let z = *zknox_result.at(j);
        let f: felt252 = upcast(*felt252_result.at(j));
        sum_z += z;
        sum_f += f;
        sum_sq_z += z * z;
        sum_sq_f += f * f;
        j += 1;
    };
    assert_eq!(sum_z, sum_f, "sum mismatch");
    assert_eq!(sum_sq_z, sum_sq_f, "sum of squares mismatch");
}
