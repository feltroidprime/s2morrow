# Falcon-512 Account Abstraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Starknet account abstraction contract that uses Falcon-512 post-quantum signature verification, with packed calldata (~62 felt252 instead of ~1030).

**Architecture:** A `FalconAccountComponent` (modeled on OZ's `AccountComponent`) implements ISRC6/IDeclarer/IDeployable using `falcon::verify_packed`. Public key stored as 29 packed felt252 in storage. Signature deserialized from `tx_info.signature` as `PackedFalconSignatureWithHint`. OZ packages provide interfaces, introspection (SRC5), and execution utils.

**Tech Stack:** Cairo 2.15.0, Scarb 2.15.1, snforge 0.55.0, OpenZeppelin cairo-contracts v4.0.0-alpha.0

**Design doc:** `docs/plans/2026-02-16-falcon-account-abstraction-design.md`

---

### Task 1: Add PackedPolynomial512 struct to falcon/packing.cairo

**Files:**
- Modify: `packages/falcon/src/packing.cairo` (append after line 383)
- Test: `packages/falcon/tests/test_packing.cairo`

**Step 1: Write the failing test**

Append to `packages/falcon/tests/test_packing.cairo`:

```cairo
use falcon::packing::{PackedPolynomial512, PackedPolynomial512Trait};

#[test]
fn test_packed_polynomial_roundtrip() {
    // Build 512 Zq values: indices 0..511
    let mut values: Array<Zq> = array![];
    let mut i: u16 = 0;
    while i != 512_u16 {
        values.append(falcon::zq::from_u16(i));
        i += 1;
    };

    // Pack into struct
    let packed = PackedPolynomial512Trait::from_coeffs(values.span());

    // Unpack back
    let unpacked = packed.to_coeffs();
    assert_eq!(unpacked.len(), 512);
    let mut j: usize = 0;
    while j != 512 {
        assert_eq!(*unpacked.span().at(j), *values.span().at(j), "mismatch at {}", j);
        j += 1;
    };
}

#[test]
fn test_packed_polynomial_to_span() {
    let mut values: Array<Zq> = array![];
    let mut i: u16 = 0;
    while i != 512_u16 {
        values.append(falcon::zq::from_u16(i));
        i += 1;
    };

    let packed = PackedPolynomial512Trait::from_coeffs(values.span());
    let span = packed.to_span();
    assert_eq!(span.len(), 29);

    // Verify roundtrip through span: unpack the span manually
    let unpacked = falcon::packing::unpack_public_key(span);
    assert_eq!(unpacked.len(), 512);
    let mut j: usize = 0;
    while j != 512 {
        assert_eq!(*unpacked.span().at(j), *values.span().at(j), "span roundtrip mismatch at {}", j);
        j += 1;
    };
}
```

**Step 2: Run test to verify it fails**

Run: `cd packages/falcon && snforge test test_packed_polynomial -v`
Expected: FAIL — `PackedPolynomial512` and `PackedPolynomial512Trait` not found.

**Step 3: Write the implementation**

Append to `packages/falcon/src/packing.cairo` (after the existing `unpack_public_key` function at line 383):

```cairo
// =============================================================================
// PackedPolynomial512: 29 felt252 slots for 512 Zq values
// =============================================================================

#[derive(Drop, Copy, Serde)]
pub struct PackedPolynomial512 {
    pub s0: felt252, pub s1: felt252, pub s2: felt252, pub s3: felt252,
    pub s4: felt252, pub s5: felt252, pub s6: felt252, pub s7: felt252,
    pub s8: felt252, pub s9: felt252, pub s10: felt252, pub s11: felt252,
    pub s12: felt252, pub s13: felt252, pub s14: felt252, pub s15: felt252,
    pub s16: felt252, pub s17: felt252, pub s18: felt252, pub s19: felt252,
    pub s20: felt252, pub s21: felt252, pub s22: felt252, pub s23: felt252,
    pub s24: felt252, pub s25: felt252, pub s26: felt252, pub s27: felt252,
    pub s28: felt252,
}

#[generate_trait]
pub impl PackedPolynomial512Impl of PackedPolynomial512Trait {
    /// Pack 512 Zq values into a PackedPolynomial512.
    fn from_coeffs(values: Span<Zq>) -> PackedPolynomial512 {
        let packed = pack_public_key(values);
        let s = packed.span();
        PackedPolynomial512 {
            s0: *s.at(0), s1: *s.at(1), s2: *s.at(2), s3: *s.at(3),
            s4: *s.at(4), s5: *s.at(5), s6: *s.at(6), s7: *s.at(7),
            s8: *s.at(8), s9: *s.at(9), s10: *s.at(10), s11: *s.at(11),
            s12: *s.at(12), s13: *s.at(13), s14: *s.at(14), s15: *s.at(15),
            s16: *s.at(16), s17: *s.at(17), s18: *s.at(18), s19: *s.at(19),
            s20: *s.at(20), s21: *s.at(21), s22: *s.at(22), s23: *s.at(23),
            s24: *s.at(24), s25: *s.at(25), s26: *s.at(26), s27: *s.at(27),
            s28: *s.at(28),
        }
    }

    /// Unpack back to 512 Zq values.
    fn to_coeffs(self: @PackedPolynomial512) -> Array<Zq> {
        unpack_public_key(self.to_span())
    }

    /// Convert to a span of 29 felt252 values.
    fn to_span(self: @PackedPolynomial512) -> Span<felt252> {
        array![
            *self.s0, *self.s1, *self.s2, *self.s3, *self.s4,
            *self.s5, *self.s6, *self.s7, *self.s8, *self.s9,
            *self.s10, *self.s11, *self.s12, *self.s13, *self.s14,
            *self.s15, *self.s16, *self.s17, *self.s18, *self.s19,
            *self.s20, *self.s21, *self.s22, *self.s23, *self.s24,
            *self.s25, *self.s26, *self.s27, *self.s28,
        ].span()
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/falcon && snforge test test_packed_polynomial -v`
Expected: Both `test_packed_polynomial_roundtrip` and `test_packed_polynomial_to_span` PASS.

Also run existing packing tests to ensure no regressions:
Run: `cd packages/falcon && snforge test test_packing -v`
Expected: All existing tests still PASS.

**Step 5: Commit**

```bash
git add packages/falcon/src/packing.cairo packages/falcon/tests/test_packing.cairo
git commit -m "feat(falcon): add PackedPolynomial512 struct for generic packed 512-element polynomials"
```

---

### Task 2: Add packed signature types and verify_packed to falcon

**Files:**
- Modify: `packages/falcon/src/types.cairo` (append packed types)
- Modify: `packages/falcon/src/falcon.cairo` (add `verify_packed`)
- Test: `packages/falcon/tests/test_cross_language.cairo` (add packed verify test)

**Step 1: Write the failing test**

Append to `packages/falcon/tests/test_cross_language.cairo`:

```cairo
use falcon::falcon::verify_packed;
use falcon::packing::{PackedPolynomial512Trait};
use falcon::types::PackedFalconSignatureWithHint;

#[test]
fn test_verify_packed_matches_rust() {
    let test = load_verify_test();

    // Pack everything
    let pk_packed = PackedPolynomial512Trait::from_coeffs(test.pk_ntt.span());
    let s1_packed = PackedPolynomial512Trait::from_coeffs(test.s1.span());
    let mul_hint_packed = PackedPolynomial512Trait::from_coeffs(test.mul_hint.span());

    let sig = PackedFalconSignatureWithHint {
        signature: falcon::types::PackedFalconSignature { s1: s1_packed, salt: test.salt },
        hint: falcon::types::PackedFalconVerificationHint { mul_hint: mul_hint_packed },
    };

    let result = verify_packed::<PoseidonHashToPoint>(@pk_packed, sig, test.message.span());
    assert!(result, "verify_packed with Poseidon hash should pass");
}
```

**Step 2: Run test to verify it fails**

Run: `cd packages/falcon && snforge test test_verify_packed -v`
Expected: FAIL — `verify_packed`, `PackedFalconSignatureWithHint` not found.

**Step 3: Add packed types to types.cairo**

Append to `packages/falcon/src/types.cairo`:

```cairo
use falcon::packing::PackedPolynomial512;

#[derive(Drop, Serde)]
pub struct PackedFalconSignature {
    pub s1: PackedPolynomial512,
    pub salt: Array<felt252>,
}

#[derive(Drop, Serde)]
pub struct PackedFalconVerificationHint {
    pub mul_hint: PackedPolynomial512,
}

#[derive(Drop, Serde)]
pub struct PackedFalconSignatureWithHint {
    pub signature: PackedFalconSignature,
    pub hint: PackedFalconVerificationHint,
}
```

**Step 4: Add verify_packed to falcon.cairo**

Append to `packages/falcon/src/falcon.cairo`:

```cairo
use crate::packing::{PackedPolynomial512, PackedPolynomial512Trait};
use crate::types::{
    FalconSignature, FalconSignatureWithHint, FalconVerificationHint,
    PackedFalconSignatureWithHint,
};

/// Verify a Falcon signature from packed (29 felt252) inputs.
/// Unpacks PK, s1, and mul_hint, then delegates to verify.
pub fn verify_packed<H, +HashToPoint<H>, +Drop<H>>(
    pk: @PackedPolynomial512,
    sig: PackedFalconSignatureWithHint,
    message: Span<felt252>,
) -> bool {
    let pk_coeffs = pk.to_coeffs();
    let s1_coeffs = sig.signature.s1.to_coeffs();
    let mul_hint_coeffs = sig.hint.mul_hint.to_coeffs();
    let falcon_pk = FalconPublicKey { h_ntt: pk_coeffs };
    let sig_with_hint = FalconSignatureWithHint {
        signature: FalconSignature { s1: s1_coeffs, salt: sig.signature.salt },
        hint: FalconVerificationHint { mul_hint: mul_hint_coeffs },
    };
    verify::<H>(@falcon_pk, sig_with_hint, message)
}
```

**Note:** The existing imports at the top of `falcon.cairo` already bring in `FalconPublicKey` and `FalconSignatureWithHint` from `crate::types`. The new import for `PackedFalconSignatureWithHint` and `PackedPolynomial512` needs to be added. Check for conflicts and merge imports as needed.

**Step 5: Run tests**

Run: `cd packages/falcon && snforge test test_verify_packed -v`
Expected: PASS

Run: `cd packages/falcon && snforge test test_cross_language -v`
Expected: All tests PASS (including existing ones).

**Step 6: Commit**

```bash
git add packages/falcon/src/types.cairo packages/falcon/src/falcon.cairo packages/falcon/tests/test_cross_language.cairo
git commit -m "feat(falcon): add packed signature types and verify_packed entry point"
```

---

### Task 3: Create falcon_account package scaffold

**Files:**
- Create: `packages/falcon_account/Scarb.toml`
- Create: `packages/falcon_account/src/lib.cairo`
- Create: `packages/falcon_account/src/utils.cairo`
- Modify: `Scarb.toml` (workspace members)

**Step 1: Create package directory**

```bash
mkdir -p packages/falcon_account/src
```

**Step 2: Create Scarb.toml**

Write `packages/falcon_account/Scarb.toml`:

```toml
[package]
name = "falcon_account"
version = "0.1.0"
edition = "2024_07"

[dependencies]
starknet = "2.15.1"
falcon = { path = "../falcon" }
openzeppelin_interfaces = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v4.0.0-alpha.0" }
openzeppelin_introspection = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v4.0.0-alpha.0" }
openzeppelin_utils = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v4.0.0-alpha.0" }

[dev-dependencies]
snforge_std = { git = "https://github.com/foundry-rs/starknet-foundry", tag = "v0.55.0" }
assert_macros = "2.15.1"

[[target.starknet-contract]]
allowed-libfuncs-list.name = "experimental"
sierra = true
casm = false
```

**Step 3: Create utils.cairo**

Write `packages/falcon_account/src/utils.cairo`:

```cairo
/// Minimum transaction version for invoke transactions.
pub const MIN_TRANSACTION_VERSION: u256 = 1;

/// Query offset for simulation transactions.
pub const QUERY_OFFSET: u256 = 0x100000000000000000000000000000000;

/// Validates that the current transaction version is supported.
/// Regular transactions must be >= MIN_TRANSACTION_VERSION.
/// Simulation transactions (version >= QUERY_OFFSET) must be >= QUERY_OFFSET + MIN_TRANSACTION_VERSION.
pub fn is_tx_version_valid() -> bool {
    let tx_info = starknet::get_tx_info().unbox();
    let tx_version: u256 = tx_info.version.into();
    if tx_version >= QUERY_OFFSET {
        QUERY_OFFSET + MIN_TRANSACTION_VERSION <= tx_version
    } else {
        MIN_TRANSACTION_VERSION <= tx_version
    }
}
```

**Step 4: Create lib.cairo**

Write `packages/falcon_account/src/lib.cairo`:

```cairo
pub mod account;
pub mod preset;
pub mod utils;
```

**Step 5: Create stub account.cairo and preset.cairo (so it compiles)**

Write `packages/falcon_account/src/account.cairo`:

```cairo
// FalconAccountComponent — placeholder
```

Write `packages/falcon_account/src/preset.cairo`:

```cairo
// FalconAccount preset contract — placeholder
```

**Step 6: Add to workspace**

Modify `Scarb.toml` (root) — add `"packages/falcon_account"` to workspace members:

```toml
[workspace]
members = ["packages/falcon", "packages/falcon_old", "packages/falcon_zknox", "packages/falcon_account"]
```

**Step 7: Verify it compiles**

Run: `scarb build`
Expected: Build succeeds (stub modules are valid Cairo).

**Step 8: Commit**

```bash
git add packages/falcon_account/ Scarb.toml
git commit -m "feat: scaffold falcon_account package with OZ deps and utils"
```

---

### Task 4: Implement FalconAccountComponent

**Files:**
- Modify: `packages/falcon_account/src/account.cairo` (replace stub)

This is the core component. It follows the OZ `AccountComponent` pattern from `/tmp/oz-cairo-contracts/packages/account/src/account.cairo`.

**Step 1: Write the component**

Replace `packages/falcon_account/src/account.cairo` with:

```cairo
/// Falcon-512 Account Component
///
/// Implements Starknet account abstraction using Falcon-512 post-quantum signatures.
/// Modeled on OpenZeppelin's AccountComponent but replaces ECDSA with Falcon verification.
#[starknet::component]
pub mod FalconAccountComponent {
    use core::num::traits::Zero;
    use falcon::falcon::verify_packed;
    use falcon::hash_to_point::PoseidonHashToPoint;
    use falcon::packing::{PackedPolynomial512, PackedPolynomial512Trait};
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
        pub pk_0: felt252, pub pk_1: felt252, pub pk_2: felt252,
        pub pk_3: felt252, pub pk_4: felt252, pub pk_5: felt252,
        pub pk_6: felt252, pub pk_7: felt252, pub pk_8: felt252,
        pub pk_9: felt252, pub pk_10: felt252, pub pk_11: felt252,
        pub pk_12: felt252, pub pk_13: felt252, pub pk_14: felt252,
        pub pk_15: felt252, pub pk_16: felt252, pub pk_17: felt252,
        pub pk_18: felt252, pub pk_19: felt252, pub pk_20: felt252,
        pub pk_21: felt252, pub pk_22: felt252, pub pk_23: felt252,
        pub pk_24: felt252, pub pk_25: felt252, pub pk_26: felt252,
        pub pk_27: felt252, pub pk_28: felt252,
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
        fn initializer(
            ref self: ComponentState<TContractState>, pk: PackedPolynomial512,
        ) {
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
                s0: self.pk_0.read(), s1: self.pk_1.read(), s2: self.pk_2.read(),
                s3: self.pk_3.read(), s4: self.pk_4.read(), s5: self.pk_5.read(),
                s6: self.pk_6.read(), s7: self.pk_7.read(), s8: self.pk_8.read(),
                s9: self.pk_9.read(), s10: self.pk_10.read(), s11: self.pk_11.read(),
                s12: self.pk_12.read(), s13: self.pk_13.read(), s14: self.pk_14.read(),
                s15: self.pk_15.read(), s16: self.pk_16.read(), s17: self.pk_17.read(),
                s18: self.pk_18.read(), s19: self.pk_19.read(), s20: self.pk_20.read(),
                s21: self.pk_21.read(), s22: self.pk_22.read(), s23: self.pk_23.read(),
                s24: self.pk_24.read(), s25: self.pk_25.read(), s26: self.pk_26.read(),
                s27: self.pk_27.read(), s28: self.pk_28.read(),
            }
        }

        /// Writes a PackedPolynomial512 into the 29 storage slots.
        fn write_packed_pk(
            ref self: ComponentState<TContractState>, pk: PackedPolynomial512,
        ) {
            self.pk_0.write(pk.s0); self.pk_1.write(pk.s1); self.pk_2.write(pk.s2);
            self.pk_3.write(pk.s3); self.pk_4.write(pk.s4); self.pk_5.write(pk.s5);
            self.pk_6.write(pk.s6); self.pk_7.write(pk.s7); self.pk_8.write(pk.s8);
            self.pk_9.write(pk.s9); self.pk_10.write(pk.s10); self.pk_11.write(pk.s11);
            self.pk_12.write(pk.s12); self.pk_13.write(pk.s13); self.pk_14.write(pk.s14);
            self.pk_15.write(pk.s15); self.pk_16.write(pk.s16); self.pk_17.write(pk.s17);
            self.pk_18.write(pk.s18); self.pk_19.write(pk.s19); self.pk_20.write(pk.s20);
            self.pk_21.write(pk.s21); self.pk_22.write(pk.s22); self.pk_23.write(pk.s23);
            self.pk_24.write(pk.s24); self.pk_25.write(pk.s25); self.pk_26.write(pk.s26);
            self.pk_27.write(pk.s27); self.pk_28.write(pk.s28);
        }
    }
}
```

**Step 2: Verify it compiles**

Run: `scarb build`
Expected: Build succeeds. The component references SRC5Component, OZ interfaces, and falcon types — all must resolve.

**Step 3: Commit**

```bash
git add packages/falcon_account/src/account.cairo
git commit -m "feat(falcon_account): implement FalconAccountComponent with Falcon-512 validation"
```

---

### Task 5: Implement preset contract

**Files:**
- Modify: `packages/falcon_account/src/preset.cairo` (replace stub)

**Step 1: Write the preset contract**

Replace `packages/falcon_account/src/preset.cairo`:

```cairo
/// Falcon-512 Account preset contract.
///
/// Deploys an account with a packed Falcon-512 public key (29 felt252 slots).
/// Validates transactions using post-quantum Falcon signature verification.
#[starknet::contract]
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

    // Deployable (__validate_deploy__)
    #[abi(embed_v0)]
    impl DeployableImpl = FalconAccountComponent::DeployableImpl<ContractState>;

    // SRC5 (supports_interface)
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    // Internal access for tests
    impl InternalImpl = FalconAccountComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v2)]
        account: FalconAccountComponent::Storage,
        #[substorage(v2)]
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
```

**Step 2: Verify it compiles as a contract**

Run: `scarb build`
Expected: Build succeeds. The contract target should produce a Sierra artifact.

**Step 3: Commit**

```bash
git add packages/falcon_account/src/preset.cairo
git commit -m "feat(falcon_account): add FalconAccount preset contract"
```

---

### Task 6: Write integration tests

**Files:**
- Create: `packages/falcon_account/tests/test_account.cairo`

The tests use snforge cheatcodes (`start_cheat_signature_global`, `start_cheat_transaction_hash_global`, `start_cheat_caller_address`) to simulate transaction validation. Test data comes from `falcon-rs`-generated `verify_test_int.json`.

**Step 1: Configure test build**

Add to `packages/falcon_account/Scarb.toml`:

```toml
[[test]]
name = "falcon_account_unittest"
build-external-contracts = [
    "falcon_account::preset::FalconAccount",
]
```

**Step 2: Write the test file**

Create `packages/falcon_account/tests/test_account.cairo`:

```cairo
use falcon::falcon::verify;
use falcon::hash_to_point::PoseidonHashToPoint;
use falcon::packing::{PackedPolynomial512Trait};
use falcon::types::{
    FalconPublicKey, FalconSignature, FalconSignatureWithHint, FalconVerificationHint,
    PackedFalconSignature, PackedFalconSignatureWithHint, PackedFalconVerificationHint,
};
use falcon::zq::Zq;
use openzeppelin_interfaces::account::accounts::{ISRC6Dispatcher, ISRC6DispatcherTrait, ISRC6_ID};
use openzeppelin_interfaces::introspection::{ISRC5Dispatcher, ISRC5DispatcherTrait, ISRC5_ID};
use snforge_std::fs::{FileTrait, read_json};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare,
    start_cheat_caller_address, start_cheat_signature_global,
    start_cheat_transaction_hash_global, start_cheat_transaction_version_global,
};
use starknet::contract_address_const;

// ─── Test Data Loading ───

#[derive(Drop, Serde)]
struct VerifyTest {
    message: Array<felt252>,
    salt: Array<felt252>,
    pk_ntt: Array<Zq>,
    s1: Array<Zq>,
    mul_hint: Array<Zq>,
}

fn load_verify_test() -> VerifyTest {
    let file = FileTrait::new("tests/data/verify_test_int.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front();
    Serde::deserialize(ref span).expect('deserialize failed')
}

/// Serialize a PackedFalconSignatureWithHint into a felt252 array (as tx signature).
fn serialize_signature(sig: @PackedFalconSignatureWithHint) -> Array<felt252> {
    let mut output: Array<felt252> = array![];
    Serde::serialize(sig, ref output);
    output
}

/// Deploy a FalconAccount contract with the given packed public key.
fn deploy_falcon_account(
    pk_packed: @falcon::packing::PackedPolynomial512,
) -> starknet::ContractAddress {
    let contract_class = declare("FalconAccount").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    Serde::serialize(pk_packed, ref calldata);
    let (contract_address, _) = contract_class.deploy(@calldata).unwrap();
    contract_address
}

// ─── Tests ───

#[test]
fn test_is_valid_signature() {
    let test = load_verify_test();

    // Pack PK and deploy
    let pk_packed = PackedPolynomial512Trait::from_coeffs(test.pk_ntt.span());
    let contract_address = deploy_falcon_account(@pk_packed);
    let dispatcher = ISRC6Dispatcher { contract_address };

    // Build packed signature — the message for hash_to_point is the tx_hash.
    // We need to figure out the tx_hash that produces the right msg_point.
    // Since verify uses hash_to_point(message=[tx_hash], salt), and our test data
    // has a specific (message, salt, s1, mul_hint), we use message[0] as the "tx_hash".
    let tx_hash: felt252 = *test.message.at(0);

    let s1_packed = PackedPolynomial512Trait::from_coeffs(test.s1.span());
    let mul_hint_packed = PackedPolynomial512Trait::from_coeffs(test.mul_hint.span());
    let sig = PackedFalconSignatureWithHint {
        signature: PackedFalconSignature { s1: s1_packed, salt: test.salt },
        hint: PackedFalconVerificationHint { mul_hint: mul_hint_packed },
    };
    let sig_serialized = serialize_signature(@sig);

    let result = dispatcher.is_valid_signature(tx_hash, sig_serialized);
    assert_eq!(result, starknet::VALIDATED);
}

#[test]
fn test_is_valid_signature_rejects_bad_sig() {
    let test = load_verify_test();

    let pk_packed = PackedPolynomial512Trait::from_coeffs(test.pk_ntt.span());
    let contract_address = deploy_falcon_account(@pk_packed);
    let dispatcher = ISRC6Dispatcher { contract_address };

    // Use wrong tx_hash — signature won't match
    let wrong_hash: felt252 = 999;
    let s1_packed = PackedPolynomial512Trait::from_coeffs(test.s1.span());
    let mul_hint_packed = PackedPolynomial512Trait::from_coeffs(test.mul_hint.span());
    let sig = PackedFalconSignatureWithHint {
        signature: PackedFalconSignature { s1: s1_packed, salt: test.salt },
        hint: PackedFalconVerificationHint { mul_hint: mul_hint_packed },
    };
    let sig_serialized = serialize_signature(@sig);

    let result = dispatcher.is_valid_signature(wrong_hash, sig_serialized);
    assert_eq!(result, 0, "Should reject signature for wrong hash");
}

#[test]
fn test_supports_interface() {
    let test = load_verify_test();
    let pk_packed = PackedPolynomial512Trait::from_coeffs(test.pk_ntt.span());
    let contract_address = deploy_falcon_account(@pk_packed);
    let dispatcher = ISRC5Dispatcher { contract_address };

    assert!(dispatcher.supports_interface(ISRC6_ID), "Should support ISRC6");
    assert!(dispatcher.supports_interface(ISRC5_ID), "Should support ISRC5");
    assert!(!dispatcher.supports_interface(0x12345), "Should not support random interface");
}

#[test]
fn test_validate_with_cheatcodes() {
    let test = load_verify_test();

    let pk_packed = PackedPolynomial512Trait::from_coeffs(test.pk_ntt.span());
    let contract_address = deploy_falcon_account(@pk_packed);
    let dispatcher = ISRC6Dispatcher { contract_address };

    // Build the packed signature and serialize it
    let tx_hash: felt252 = *test.message.at(0);
    let s1_packed = PackedPolynomial512Trait::from_coeffs(test.s1.span());
    let mul_hint_packed = PackedPolynomial512Trait::from_coeffs(test.mul_hint.span());
    let sig = PackedFalconSignatureWithHint {
        signature: PackedFalconSignature { s1: s1_packed, salt: test.salt },
        hint: PackedFalconVerificationHint { mul_hint: mul_hint_packed },
    };
    let sig_serialized = serialize_signature(@sig);

    // Cheat: set the global tx signature and hash so __validate__ picks them up
    start_cheat_signature_global(sig_serialized.span());
    start_cheat_transaction_hash_global(tx_hash);
    start_cheat_transaction_version_global(1);
    // __validate__ requires caller == 0 (protocol)
    start_cheat_caller_address(contract_address, contract_address_const::<0>());

    // Call __validate__ with empty calls (we're testing signature validation, not call execution)
    let result = dispatcher.__validate__(array![]);
    assert_eq!(result, starknet::VALIDATED);
}
```

**Important:** The test file needs access to the falcon package test data. The `verify_test_int.json` file lives at `packages/falcon/tests/data/verify_test_int.json`. snforge resolves `FileTrait::new` relative to the package root, so we need to either:
- Symlink or copy the test data: `ln -s ../../falcon/tests/data packages/falcon_account/tests/data`
- Or adjust the path if snforge supports `../falcon/tests/data/...`

Try the symlink approach first:
```bash
mkdir -p packages/falcon_account/tests
ln -s ../../falcon/tests/data packages/falcon_account/tests/data
```

**Step 3: Run tests**

Run: `cd packages/falcon_account && snforge test -v`
Expected: All 4 tests PASS.

If test data loading fails, check if snforge follows symlinks. If not, copy the JSON file instead:
```bash
cp packages/falcon/tests/data/verify_test_int.json packages/falcon_account/tests/data/
```

**Step 4: Commit**

```bash
git add packages/falcon_account/tests/ packages/falcon_account/Scarb.toml
git commit -m "test(falcon_account): add integration tests for FalconAccount contract"
```

---

### Task 7: Final verification and cleanup

**Files:**
- All modified files

**Step 1: Run the full workspace test suite**

Run: `snforge test --workspace`
Expected: All tests across all packages PASS.

**Step 2: Run formatter**

Run: `scarb fmt`

**Step 3: Verify build**

Run: `scarb build`
Expected: Clean build, no warnings.

**Step 4: Final commit (if formatter changed anything)**

```bash
git add -A
git commit -m "style: apply cairo formatter to falcon_account"
```
