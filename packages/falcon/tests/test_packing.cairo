use falcon::packing::{pack_public_key, unpack_public_key};

#[test]
fn test_packing_roundtrip_simple() {
    let mut values: Array<u16> = array![
        0, 1, 2, 100, 12288, 6000, 3000, 9999, 5555,
        42, 7777, 11111, 0, 12288, 1234, 5678, 8888, 4321,
    ];
    let mut i: usize = 18;
    while i != 512 {
        values.append((i % 12289).try_into().unwrap());
        i += 1;
    };

    let packed = pack_public_key(values.span());
    assert_eq!(packed.len(), 29);

    let unpacked = unpack_public_key(packed.span());
    assert_eq!(unpacked.len(), 512);

    let mut j: usize = 0;
    while j != 512 {
        assert_eq!(*unpacked.at(j), *values.at(j), "mismatch at index {}", j);
        j += 1;
    };
}

#[test]
fn test_packing_edge_cases() {
    let mut zeros: Array<u16> = array![];
    let mut i: usize = 0;
    while i != 512 {
        zeros.append(0);
        i += 1;
    };
    let packed = pack_public_key(zeros.span());
    let unpacked = unpack_public_key(packed.span());
    let mut j: usize = 0;
    while j != 512 {
        assert_eq!(*unpacked.at(j), 0, "zero mismatch at {}", j);
        j += 1;
    };

    let mut maxes: Array<u16> = array![];
    i = 0;
    while i != 512 {
        maxes.append(12288);
        i += 1;
    };
    let packed_max = pack_public_key(maxes.span());
    let unpacked_max = unpack_public_key(packed_max.span());
    j = 0;
    while j != 512 {
        assert_eq!(*unpacked_max.at(j), 12288, "max mismatch at {}", j);
        j += 1;
    };
}
