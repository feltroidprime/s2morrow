/// Falcon-512 Account preset contract.
///
/// Deploys an account with a packed Falcon-512 public key (29 felt252 slots).
/// Validates transactions using post-quantum Falcon signature verification.
#[starknet::contract(account)]
pub mod FalconAccount {
    use falcon::packing::PackedPolynomial512;
    use openzeppelin_introspection::src5::SRC5Component;
    use crate::account::FalconAccountComponent;

    component!(path: FalconAccountComponent, storage: account, event: AccountEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    // SRC6 (execute, validate, is_valid_signature)
    #[abi(embed_v0)]
    impl SRC6Impl = FalconAccountComponent::SRC6Impl<ContractState>;

    // Declarer (__validate_declare__)
    #[abi(embed_v0)]
    impl DeclarerImpl = FalconAccountComponent::DeclarerImpl<ContractState>;

    // Deployable (__validate_deploy__) — custom impl to match constructor signature
    #[abi(per_item)]
    #[generate_trait]
    impl DeployableImpl of DeployableTrait {
        #[external(v0)]
        fn __validate_deploy__(
            self: @ContractState,
            class_hash: felt252,
            contract_address_salt: felt252,
            pk_packed: PackedPolynomial512,
        ) -> felt252 {
            self.account.validate_transaction()
        }
    }

    // SRC5 (supports_interface)
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    // Internal access for tests
    impl InternalImpl = FalconAccountComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        account: FalconAccountComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        AccountEvent: FalconAccountComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, pk_packed: PackedPolynomial512) {
        self.account.initializer(pk_packed);
    }
}
