# Falcon-512 Account Abstraction Contract Design

**Date:** 2026-02-16
**Goal:** Build a Starknet account abstraction contract using Falcon-512 post-quantum signature verification.

---

## Overview

A new `falcon_account` package implementing Starknet account abstraction with Falcon-512 as the signature scheme. Follows the OpenZeppelin component pattern, depends on OZ packages for interfaces/utils/introspection, and writes a custom `FalconAccountComponent` with Falcon-specific storage and validation.

### Key decisions

- **Sign over tx_hash only** — the protocol-provided transaction hash from `get_tx_info()`
- **OZ deps + own component** — import `openzeppelin_interfaces`, `openzeppelin_introspection`, `openzeppelin_utils`; write `FalconAccountComponent` modeled on OZ's `AccountComponent`
- **Falcon stays pure-Cairo** — no `starknet` dependency in the `falcon` package
- **Packed calldata** — signature uses `PackedPolynomial512` (29 felt252) instead of raw 512-element arrays, reducing calldata from ~1030 to ~62 felt252
- **Constructor takes packed PK** — 29 felt252 in `PackedPolynomial512` format
- **No key rotation in v1** — `set_public_key` deferred to a later version

---

## Section 1: PackedPolynomial512 (in `falcon` package)

A generic struct representing a packed 512-element Zq polynomial in 29 felt252 slots. Reused for public keys, s1 signatures, and mul_hint values.

### Struct

```cairo
// falcon/src/packing.cairo

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
```

### API

```cairo
impl PackedPolynomial512Impl of PackedPolynomial512Trait {
    /// Pack 512 Zq values into 29 felt252 slots.
    fn from_coeffs(values: Span<Zq>) -> PackedPolynomial512;

    /// Unpack back to 512 Zq values.
    fn to_coeffs(self: @PackedPolynomial512) -> Array<Zq>;

    /// Convert to a Span<felt252> of length 29 (for passing to storage helpers).
    fn to_span(self: @PackedPolynomial512) -> Span<felt252>;
}
```

Internally reuses existing `pack_9` / `unpack_9` / Horner encoding logic. The current `pack_public_key` / `unpack_public_key` functions are replaced by the struct methods.

### Packing math (unchanged)

- 9 Zq values per u128 half (Q^9 < 2^128)
- 18 values per felt252 (low u128 + high u128)
- 29 slots for 512 values (28 full + 1 partial with 8)

---

## Section 2: Packed Falcon Types (in `falcon` package)

New packed variants of the existing signature types, optimized for calldata.

```cairo
// falcon/src/types.cairo

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

### Calldata size comparison

| Field | Unpacked | Packed |
|-------|----------|--------|
| s1 | 513 felt252 | 29 felt252 |
| salt | ~4 felt252 | ~4 felt252 |
| mul_hint | 513 felt252 | 29 felt252 |
| **Total** | **~1030** | **~62** |

---

## Section 3: verify_packed (in `falcon` package)

New entry point that accepts packed inputs, unpacks, and delegates to existing `verify`.

```cairo
// falcon/src/falcon.cairo

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

---

## Section 4: FalconAccountComponent (in `falcon_account` package)

### Package structure

```
packages/falcon_account/
├── Scarb.toml
├── src/
│   ├── lib.cairo
│   ├── account.cairo          # FalconAccountComponent
│   ├── preset.cairo           # FalconAccount preset contract
│   └── utils.cairo            # is_tx_version_valid, constants
```

### Dependencies

```toml
[dependencies]
starknet = "2.15.1"
openzeppelin_interfaces = { git = "...", tag = "v4.0.0-alpha.0" }
openzeppelin_introspection = { git = "...", tag = "v4.0.0-alpha.0" }
openzeppelin_utils = { git = "...", tag = "v4.0.0-alpha.0" }
falcon = { path = "../falcon" }
```

### Storage

```cairo
#[storage]
pub struct Storage {
    // 29 individual felt252 slots for packed Falcon public key
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
```

Internal helpers `read_packed_pk()` and `write_packed_pk()` convert between storage and `PackedPolynomial512`.

### Validation flow

```
__validate__(calls: Array<Call>) -> felt252:
    1. tx_info = get_tx_info()
    2. tx_hash = tx_info.transaction_hash
    3. signature = tx_info.signature
    4. assert(_is_valid_falcon_signature(tx_hash, signature))
    5. return VALIDATED

_is_valid_falcon_signature(hash: felt252, signature: Span<felt252>) -> bool:
    1. Deserialize signature -> PackedFalconSignatureWithHint
    2. pk = read_packed_pk() -> PackedPolynomial512
    3. message = array![hash]
    4. falcon::verify_packed::<PoseidonHashToPoint>(@pk, sig, message.span())
```

### External interface

Implements ISRC6, IDeclarer, IDeployable from openzeppelin_interfaces:

```cairo
// ISRC6
fn __execute__(calls: Array<Call>)                              // iterate + execute_single_call
fn __validate__(calls: Array<Call>) -> felt252                  // Falcon signature verification
fn is_valid_signature(hash: felt252, signature: Array<felt252>) -> felt252

// IDeclarer
fn __validate_declare__(class_hash: felt252) -> felt252         // same validation logic

// IDeployable
fn __validate_deploy__(class_hash: felt252, salt: felt252, ...) -> felt252

// Custom read-only
fn get_public_key() -> PackedPolynomial512                      // read 29 slots from storage
```

### Initializer

```cairo
fn initializer(ref self: ComponentState, pk: PackedPolynomial512) {
    // Write 29 packed slots to storage
    write_packed_pk(ref self, pk);
    // Register ISRC6 interface via SRC5
    let mut src5 = get_dep_component_mut!(ref self, SRC5);
    src5.register_interface(ISRC6_ID);
}
```

---

## Section 5: Preset Contract

```cairo
#[starknet::contract]
mod FalconAccount {
    use openzeppelin_introspection::src5::SRC5Component;
    use crate::account::FalconAccountComponent;

    component!(path: FalconAccountComponent, storage: account, event: AccountEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl SRC6Impl = FalconAccountComponent::SRC6Impl<ContractState>;
    #[abi(embed_v0)]
    impl DeclarerImpl = FalconAccountComponent::DeclarerImpl<ContractState>;
    #[abi(embed_v0)]
    impl DeployableImpl = FalconAccountComponent::DeployableImpl<ContractState>;
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

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

---

## Section 6: Testing Strategy

### Unit tests

1. **`_is_valid_falcon_signature`** — known-good signature from `verify_test_int.json` returns true
2. **Tampered signature** — modified s1/mul_hint returns false
3. **Wrong PK** — valid signature against wrong key returns false

### Integration tests

4. **`is_valid_signature` external** — deploy FalconAccount, call `is_valid_signature(hash, sig)` externally
5. **Deploy test** — verify constructor stores packed PK correctly, `get_public_key` returns it

### Test data

Existing `falcon-rs` test vectors (`verify_test_int.json`) provide pk, s1, salt, mul_hint. Need to also generate packed versions from Rust side.

---

## Not in scope (deferred)

- Key rotation (`set_public_key`)
- SRC9 extensions
- CamelCase compatibility wrappers
- Multicall transaction simulation tests (require snforge cheatcodes for tx signature injection)
