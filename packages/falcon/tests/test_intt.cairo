use falcon::ntt_zknox::zknox_nttFW_reduced;
use falcon::intt_zknox::zknox_inttFW_reduced;
use snforge_std::fs::{FileTrait, read_json};

/// Extract input array from JSON object format
/// snforge serializes {"input": [...]} as: [header, val1, val2, ..., val512, trailer]
fn load_ntt_input() -> Span<felt252> {
    let file = FileTrait::new("tests/data/ntt_input_512_int.json");
    let serialized = read_json(@file);

    // Skip first element (header) and last element (trailer)
    let mut input: Array<felt252> = array![];
    let mut i: usize = 1;
    while i < 513 {
        input.append(*serialized.at(i));
        i += 1;
    };
    input.span()
}

#[test]
fn test_intt_zknox_roundtrip() {
    let input = load_ntt_input();

    // Clone input for comparison (span is consumed by NTT)
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


use corelib_imports::bounded_int::{BoundedInt, DivRemHelper, UnitInt, bounded_int_div_rem, upcast};

const SHIFT: felt252 = 2305326338167692623066702044767191040;
type QConst = UnitInt<12289>;
const nz_q: NonZero<QConst> = 12289;
type ShiftedT = BoundedInt<0, 4612212885115823853836039849917814806>;
type RemT = BoundedInt<0, 12288>;

impl DivRem_ShiftedT_QConst of DivRemHelper<ShiftedT, QConst> {
    type DivT = BoundedInt<0, 375312302475044662204901932615982>;
    type RemT = RemT;
}
type bounded_u220 = BoundedInt<0, 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF>;


#[test]
fn test_bounded_int_u256() {
    let a_felt252 = 0x123;
    // let a:bounded_u220 = a_felt252.try_into().unwrap();
    // let b_felt252 = 0x456;
    // let b:bounded_u220 = b_felt252.try_into().unwrap();

}