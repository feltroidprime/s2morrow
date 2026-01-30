// tests/test_ntt_bounded_int.cairo
use falcon::ntt::ntt;
use falcon::ntt_bounded_int::ntt_512;
use falcon::zq::{Zq, from_u16, to_u16};

#[test]
fn test_ntt_512_matches_recursive() {
    // Test vector: [1, 2, 3, ..., 512]
    let mut f_array: Array<Zq> = array![];
    let mut f_u16: Array<u16> = array![];

    let mut i: u16 = 1;
    while i <= 512 {
        f_array.append(from_u16(i));
        f_u16.append(i);
        i += 1;
    };

    // Reference: existing recursive ntt
    let expected = ntt(f_u16.span());

    // Generated: BoundedInt ntt_512
    let actual = ntt_512(f_array);

    // Compare all 512 elements
    let mut i: usize = 0;
    while i < 512 {
        assert_eq!(to_u16(*actual[i]), *expected[i]);
        i += 1;
    };
}

#[test]
fn test_ntt_512_all_zeros() {
    let mut f: Array<Zq> = array![];
    let mut i: usize = 0;
    while i < 512 {
        f.append(from_u16(0));
        i += 1;
    };

    let result = ntt_512(f);

    // NTT of all zeros should be all zeros
    let mut i: usize = 0;
    while i < 512 {
        assert_eq!(to_u16(*result[i]), 0);
        i += 1;
    };
}
