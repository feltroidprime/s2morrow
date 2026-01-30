use falcon::ntt::ntt;

#[executable]
fn main(input: Array<u16>) -> Array<u16> {
    let result = ntt(input.span());
    result.into()
}
