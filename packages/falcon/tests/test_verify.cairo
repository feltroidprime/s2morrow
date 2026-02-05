use falcon::falcon;
use snforge_std::fs::{FileTrait, read_json};

#[derive(Drop, Serde)]
struct Args {
    attestations: Array<Attestation>,
    n: u32,
}

#[derive(Drop, Serde)]
struct Attestation {
    s1: Array<u16>,
    pk: Array<u16>,
    msg_point: Array<u16>,
}

/// Load args from JSON - snforge adds header/trailer around the object
fn load_args() -> Args {
    let file = FileTrait::new("tests/data/args_512_1_int.json");
    let serialized = read_json(@file);

    // Skip the first element (header) and deserialize
    let mut span = serialized.span();
    let _header = span.pop_front(); // Skip header

    Serde::deserialize(ref span).expect('deserialize failed')
}

#[test]
fn test_verify_512() {
    let args = load_args();

    for attestation in args.attestations.span() {
        falcon::verify_uncompressed::<512>(
            attestation.s1.span(),
            attestation.pk.span(),
            attestation.msg_point.span(),
            args.n
        ).expect('Invalid signature');
    }
}
