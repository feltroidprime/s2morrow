/// Falcon-512 Account Component
///
/// Implements Starknet account abstraction using Falcon-512 post-quantum signatures.
/// Modeled on OpenZeppelin's AccountComponent but replaces ECDSA with Falcon verification.
#[starknet::component]
pub mod FalconAccountComponent {
    use core::num::traits::Zero;
    use falcon::falcon::verify_packed;
    use falcon::hash_to_point::PoseidonHashToPoint;
    use falcon::packing::PackedPolynomial512;
    use falcon::types::PackedFalconSignatureWithHint;
    use openzeppelin_interfaces::account::accounts as interface;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_introspection::src5::SRC5Component::{
        InternalTrait as SRC5InternalTrait, SRC5Impl,
    };
    use openzeppelin_utils::execution::execute_single_call;
    use starknet::account::Call;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::utils::is_tx_version_valid;

    #[storage]
    pub struct Storage {
        pub pk_0: felt252,
        pub pk_1: felt252,
        pub pk_2: felt252,
        pub pk_3: felt252,
        pub pk_4: felt252,
        pub pk_5: felt252,
        pub pk_6: felt252,
        pub pk_7: felt252,
        pub pk_8: felt252,
        pub pk_9: felt252,
        pub pk_10: felt252,
        pub pk_11: felt252,
        pub pk_12: felt252,
        pub pk_13: felt252,
        pub pk_14: felt252,
        pub pk_15: felt252,
        pub pk_16: felt252,
        pub pk_17: felt252,
        pub pk_18: felt252,
        pub pk_19: felt252,
        pub pk_20: felt252,
        pub pk_21: felt252,
        pub pk_22: felt252,
        pub pk_23: felt252,
        pub pk_24: felt252,
        pub pk_25: felt252,
        pub pk_26: felt252,
        pub pk_27: felt252,
        pub pk_28: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {}

    pub mod Errors {
        pub const INVALID_CALLER: felt252 = 'Account: invalid caller';
        pub const INVALID_SIGNATURE: felt252 = 'Account: invalid signature';
        pub const INVALID_TX_VERSION: felt252 = 'Account: invalid tx version';
    }

    //
    // External
    //

    #[embeddable_as(SRC6Impl)]
    impl SRC6<
        TContractState,
        +HasComponent<TContractState>,
        +SRC5Component::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of interface::ISRC6<ComponentState<TContractState>> {
        fn __execute__(self: @ComponentState<TContractState>, calls: Array<Call>) {
            let sender = starknet::get_caller_address();
            assert(sender.is_zero(), Errors::INVALID_CALLER);
            assert(is_tx_version_valid(), Errors::INVALID_TX_VERSION);
            for call in calls.span() {
                execute_single_call(call);
            }
        }

        fn __validate__(self: @ComponentState<TContractState>, calls: Array<Call>) -> felt252 {
            self.validate_transaction()
        }

        fn is_valid_signature(
            self: @ComponentState<TContractState>, hash: felt252, signature: Array<felt252>,
        ) -> felt252 {
            if self._is_valid_signature(hash, signature.span()) {
                starknet::VALIDATED
            } else {
                0
            }
        }
    }

    #[embeddable_as(DeclarerImpl)]
    impl Declarer<
        TContractState,
        +HasComponent<TContractState>,
        +SRC5Component::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of interface::IDeclarer<ComponentState<TContractState>> {
        fn __validate_declare__(
            self: @ComponentState<TContractState>, class_hash: felt252,
        ) -> felt252 {
            self.validate_transaction()
        }
    }

    #[embeddable_as(DeployableImpl)]
    impl Deployable<
        TContractState,
        +HasComponent<TContractState>,
        +SRC5Component::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of interface::IDeployable<ComponentState<TContractState>> {
        fn __validate_deploy__(
            self: @ComponentState<TContractState>,
            class_hash: felt252,
            contract_address_salt: felt252,
            public_key: felt252,
        ) -> felt252 {
            self.validate_transaction()
        }
    }

    //
    // Internal
    //

    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl SRC5: SRC5Component::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        /// Initializes the account with a packed Falcon public key.
        /// Registers the ISRC6 interface.
        fn initializer(ref self: ComponentState<TContractState>, pk: PackedPolynomial512) {
            let mut src5_component = get_dep_component_mut!(ref self, SRC5);
            src5_component.register_interface(interface::ISRC6_ID);
            self.write_packed_pk(pk);
        }

        /// Validates the signature for the current transaction.
        /// Returns the short string 'VALID' if valid, otherwise reverts.
        fn validate_transaction(self: @ComponentState<TContractState>) -> felt252 {
            let tx_info = starknet::get_tx_info().unbox();
            let tx_hash = tx_info.transaction_hash;
            let signature = tx_info.signature;
            assert(self._is_valid_signature(tx_hash, signature), Errors::INVALID_SIGNATURE);
            starknet::VALIDATED
        }

        /// Returns whether the given signature is valid for the given hash.
        fn _is_valid_signature(
            self: @ComponentState<TContractState>, hash: felt252, signature: Span<felt252>,
        ) -> bool {
            let mut sig_span = signature;
            let sig: PackedFalconSignatureWithHint = match Serde::deserialize(ref sig_span) {
                Option::Some(s) => s,
                Option::None => { return false; },
            };
            let pk = self.read_packed_pk();
            let message = array![hash];
            verify_packed::<PoseidonHashToPoint>(@pk, sig, message.span())
        }

        /// Returns the packed public key.
        fn get_public_key(self: @ComponentState<TContractState>) -> PackedPolynomial512 {
            self.read_packed_pk()
        }

        /// Reads the 29 packed PK slots from storage into a PackedPolynomial512.
        fn read_packed_pk(self: @ComponentState<TContractState>) -> PackedPolynomial512 {
            PackedPolynomial512 {
                s0: self.pk_0.read(),
                s1: self.pk_1.read(),
                s2: self.pk_2.read(),
                s3: self.pk_3.read(),
                s4: self.pk_4.read(),
                s5: self.pk_5.read(),
                s6: self.pk_6.read(),
                s7: self.pk_7.read(),
                s8: self.pk_8.read(),
                s9: self.pk_9.read(),
                s10: self.pk_10.read(),
                s11: self.pk_11.read(),
                s12: self.pk_12.read(),
                s13: self.pk_13.read(),
                s14: self.pk_14.read(),
                s15: self.pk_15.read(),
                s16: self.pk_16.read(),
                s17: self.pk_17.read(),
                s18: self.pk_18.read(),
                s19: self.pk_19.read(),
                s20: self.pk_20.read(),
                s21: self.pk_21.read(),
                s22: self.pk_22.read(),
                s23: self.pk_23.read(),
                s24: self.pk_24.read(),
                s25: self.pk_25.read(),
                s26: self.pk_26.read(),
                s27: self.pk_27.read(),
                s28: self.pk_28.read(),
            }
        }

        /// Writes a PackedPolynomial512 into the 29 storage slots.
        fn write_packed_pk(ref self: ComponentState<TContractState>, pk: PackedPolynomial512) {
            self.pk_0.write(pk.s0);
            self.pk_1.write(pk.s1);
            self.pk_2.write(pk.s2);
            self.pk_3.write(pk.s3);
            self.pk_4.write(pk.s4);
            self.pk_5.write(pk.s5);
            self.pk_6.write(pk.s6);
            self.pk_7.write(pk.s7);
            self.pk_8.write(pk.s8);
            self.pk_9.write(pk.s9);
            self.pk_10.write(pk.s10);
            self.pk_11.write(pk.s11);
            self.pk_12.write(pk.s12);
            self.pk_13.write(pk.s13);
            self.pk_14.write(pk.s14);
            self.pk_15.write(pk.s15);
            self.pk_16.write(pk.s16);
            self.pk_17.write(pk.s17);
            self.pk_18.write(pk.s18);
            self.pk_19.write(pk.s19);
            self.pk_20.write(pk.s20);
            self.pk_21.write(pk.s21);
            self.pk_22.write(pk.s22);
            self.pk_23.write(pk.s23);
            self.pk_24.write(pk.s24);
            self.pk_25.write(pk.s25);
            self.pk_26.write(pk.s26);
            self.pk_27.write(pk.s27);
            self.pk_28.write(pk.s28);
        }
    }
}
