// Test that compares bounded int NTT vs felt252 NTT implementations
// Both should produce identical results for the same input

use falcon::ntt_bounded_int::ntt_512 as ntt_bounded;
use falcon::ntt_felt252::ntt_512 as ntt_felt;
use falcon::zq::{Zq, from_u16, to_u16};

#[test]
fn test_ntt_modes_produce_same_output() {
    // Create test input
    let mut input_bounded: Array<Zq> = array![];
    let mut input_felt: Array<felt252> = array![];

    // Fill with test values (0, 1, 2, ..., 511)
    let mut i: u16 = 0;
    while i < 512 {
        input_bounded.append(from_u16(i));
        input_felt.append(i.into());
        i += 1;
    };

    let result_bounded = ntt_bounded(input_bounded);
    let result_felt = ntt_felt(input_felt);

    // Compare first few results for debugging
    let rb0: felt252 = to_u16(*result_bounded.at(0)).into();
    let rf0: felt252 = *result_felt.at(0);
    println!("bounded[0] = {}, felt[0] = {}", rb0, rf0);

    let rb1: felt252 = to_u16(*result_bounded.at(1)).into();
    let rf1: felt252 = *result_felt.at(1);
    println!("bounded[1] = {}, felt[1] = {}", rb1, rf1);

    let rb2: felt252 = to_u16(*result_bounded.at(2)).into();
    let rf2: felt252 = *result_felt.at(2);
    println!("bounded[2] = {}, felt[2] = {}", rb2, rf2);

    // Compare results
    let mut j: usize = 0;
    while j < 512 {
        let rb: felt252 = to_u16(*result_bounded.at(j)).into();
        let rf: felt252 = *result_felt.at(j);
        assert!(rb == rf, "Mismatch at index {}", j);
        j += 1;
    };
}
