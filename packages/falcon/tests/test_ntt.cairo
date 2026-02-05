use falcon::ntt::ntt;
use falcon::ntt_felt252::ntt_512;
use snforge_std::fs::{FileTrait, read_json};

/// Extract input array from JSON object format
/// snforge serializes {"input": [...]} as: [header, val1, val2, ..., val512, trailer]
fn load_ntt_input() -> Array<felt252> {
    let file = FileTrait::new("tests/data/ntt_input_512_int.json");
    let serialized = read_json(@file);

    // Skip first element (header) and last element (trailer)
    let mut input: Array<felt252> = array![];
    let mut i: usize = 1;
    while i < 513 {
        input.append(*serialized.at(i));
        i += 1;
    };
    input
}

#[test]
fn test_ntt_recursive_512() {
    let input = load_ntt_input();

    // Convert felt252 -> u16 for recursive NTT
    let mut u16_input: Array<u16> = array![];
    for val in input {
        u16_input.append(val.try_into().unwrap());
    };

    let result = ntt(u16_input.span());
    assert_eq!(result.len(), 512);
}

#[test]
fn test_ntt_felt252_512() {
    let input = load_ntt_input();
    let result = ntt_512(input);
    assert_eq!(result.len(), 512);
}
