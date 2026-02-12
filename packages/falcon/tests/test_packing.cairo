use falcon::packing::{pack_public_key, unpack_public_key};
use falcon::zq::{Zq, from_u16};

#[test]
fn test_packing_roundtrip_simple() {
    let mut values: Array<Zq> = array![
        from_u16(0), from_u16(1), from_u16(2), from_u16(100), from_u16(12288), from_u16(6000),
        from_u16(3000), from_u16(9999), from_u16(5555), from_u16(42), from_u16(7777),
        from_u16(11111), from_u16(0), from_u16(12288), from_u16(1234), from_u16(5678),
        from_u16(8888), from_u16(4321),
    ];
    let mut i: usize = 18;
    while i != 512 {
        values.append(from_u16((i % 12289).try_into().unwrap()));
        i += 1;
    }

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
    let zero: Zq = from_u16(0);
    let mut zeros: Array<Zq> = array![];
    let mut i: usize = 0;
    while i != 512 {
        zeros.append(zero);
        i += 1;
    }
    let packed = pack_public_key(zeros.span());
    let unpacked = unpack_public_key(packed.span());
    let mut j: usize = 0;
    while j != 512 {
        assert_eq!(*unpacked.at(j), zero, "zero mismatch at {}", j);
        j += 1;
    }

    let max_val: Zq = from_u16(12288);
    let mut maxes: Array<Zq> = array![];
    i = 0;
    while i != 512 {
        maxes.append(max_val);
        i += 1;
    }
    let packed_max = pack_public_key(maxes.span());
    let unpacked_max = unpack_public_key(packed_max.span());
    j = 0;
    while j != 512 {
        assert_eq!(*unpacked_max.at(j), max_val, "max mismatch at {}", j);
        j += 1;
    };
}
