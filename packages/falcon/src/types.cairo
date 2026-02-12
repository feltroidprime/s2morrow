use falcon::zq::Zq;

#[derive(Drop, Serde)]
pub struct FalconPublicKey {
    pub h_ntt: Array<Zq>,
}

#[derive(Drop, Serde)]
pub struct FalconSignature {
    pub s1: Array<Zq>,
    pub salt: Array<felt252>,
}

#[derive(Drop, Serde)]
pub struct FalconVerificationHint {
    pub mul_hint: Array<Zq>,
}

#[derive(Drop, Serde)]
pub struct FalconSignatureWithHint {
    pub signature: FalconSignature,
    pub hint: FalconVerificationHint,
}

pub trait HashToPoint<H> {
    fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<Zq>;
}
