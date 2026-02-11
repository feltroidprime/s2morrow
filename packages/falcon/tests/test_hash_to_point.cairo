use falcon::hash_to_point::PoseidonHashToPointImpl;

#[test]
fn test_hash_to_point_length_and_range() {
    let message: Array<felt252> = array![42];
    let salt: Array<felt252> = array![1, 2];

    let result = PoseidonHashToPointImpl::hash_to_point(message.span(), salt.span());
    assert_eq!(result.len(), 512);

    let span = result.span();
    let mut i: usize = 0;
    while i != 512 {
        let v: u16 = *span.at(i);
        assert!(v < 12289, "value out of range: {}", v);
        i += 1;
    };
}

#[test]
fn test_hash_to_point_deterministic() {
    let message: Array<felt252> = array![42];
    let salt: Array<felt252> = array![1, 2];

    let result1 = PoseidonHashToPointImpl::hash_to_point(message.span(), salt.span());
    let result2 = PoseidonHashToPointImpl::hash_to_point(message.span(), salt.span());

    let span1 = result1.span();
    let span2 = result2.span();
    let mut i: usize = 0;
    while i != 512 {
        assert_eq!(*span1.at(i), *span2.at(i), "non-deterministic at {}", i);
        i += 1;
    };
}

#[test]
fn test_hash_to_point_different_inputs() {
    let msg1: Array<felt252> = array![1];
    let msg2: Array<felt252> = array![2];
    let salt: Array<felt252> = array![0, 0];

    let r1 = PoseidonHashToPointImpl::hash_to_point(msg1.span(), salt.span());
    let r2 = PoseidonHashToPointImpl::hash_to_point(msg2.span(), salt.span());

    let span1 = r1.span();
    let span2 = r2.span();
    let mut differ = false;
    let mut i: usize = 0;
    while i != 512 {
        if *span1.at(i) != *span2.at(i) {
            differ = true;
            break;
        }
        i += 1;
    };
    assert!(differ, "different messages produced identical output");
}
