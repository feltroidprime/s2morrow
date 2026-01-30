use corelib_imports::bounded_int::downcast;
use falcon::ntt_bounded_int::ntt_512;
use falcon::zq::Zq;

#[executable]
fn main(input: Array<felt252>) -> Array<felt252> {
    // Convert felt252 -> Zq
    let mut zq_input: Array<Zq> = array![];
    for val in input {
        let v: u16 = val.try_into().unwrap();
        let zq: Zq = downcast(v).expect('value exceeds Q-1');
        zq_input.append(zq);
    }

    // Run NTT
    let result = ntt_512(zq_input);

    // Convert Zq -> felt252
    let mut output: Array<felt252> = array![];
    for val in result {
        output.append(val.into());
    }
    output
}
