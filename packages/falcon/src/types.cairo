#[derive(Drop, Serde)]
pub struct FalconPublicKey {
    pub h_ntt: Array<u16>, // 512 values, NTT domain
}

#[derive(Drop, Serde)]
pub struct FalconSignature {
    pub s1: Array<u16>,
    pub salt: Array<felt252>,
}

#[derive(Drop, Serde)]
pub struct FalconVerificationHint {
    pub mul_hint: Array<u16>, // INTT(s1_ntt * pk_ntt)
}

#[derive(Drop, Serde)]
pub struct FalconSignatureWithHint {
    pub signature: FalconSignature,
    pub hint: FalconVerificationHint,
}

pub trait HashToPoint<H> {
    fn hash_to_point(message: Span<felt252>, salt: Span<felt252>) -> Array<u16>;
}
