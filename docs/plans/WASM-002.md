# WASM-002: Implement `sign()` WASM Binding via `SecretKey::from_bytes`

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Overview of the approach

Implement WASM-002 with strict TDD in `../falcon-rs`.

The target behavior is:
- `wasm.rs::sign(sk_bytes, message, salt)` must deserialize secret key bytes with `SecretKey::from_bytes`.
- Signing must call `Falcon::<Shake256Hash>::sign_with_salt` when `salt` is provided.
- Return type must be `Result<JsValue, JsError>` and return a JS object containing:
  - `signature: Uint8Array`
  - `salt: Uint8Array`
  - optional `s1: Int32Array` (if exposed in this ticket’s implementation scope)
- The third parameter should be named `salt` (not `_seed`).

Note: `docs/context/WASM-002.md` was referenced by ticket instructions but is not present in this repository. This plan uses the ticket description, the provided research summary, and current source state.

## TDD step order (tests first)

### Step 1: Add failing wasm-bindgen test for `sign` response shape
- Modify `../falcon-rs/src/wasm.rs` test module.
- Add a test that calls `sign()` with a valid keypair and fixed salt, then asserts:
  - `signature` exists and is `Uint8Array` with `SIGNATURE_LEN` bytes.
  - `salt` exists and is `Uint8Array` with `SALT_LEN` bytes.
  - returned salt equals input salt.
  - if `s1` is returned, it is `Int32Array` with `N` elements.
- Run only this test and confirm failure first.

### Step 2: Add failing wasm-bindgen roundtrip integration test (`sign` -> `verify`)
- Modify `../falcon-rs/src/wasm.rs` test module.
- Add a test that:
  - calls `keygen(seed)`
  - signs a message via `sign(sk, message, salt)`
  - extracts `signature`
  - verifies via `verify(vk, message, signature)`
  - expects `true`
- Run this single test and confirm failure first.

### Step 3: Add failing validation tests for input errors
- Modify `../falcon-rs/src/wasm.rs` test module.
- Add tests for:
  - invalid secret key length -> `Err(JsError)`
  - invalid secret key bytes (correct length but malformed coefficients) -> `Err(JsError)` from `SecretKey::from_bytes`
  - invalid salt length -> `Err(JsError)`
- Run targeted tests and confirm failure first.

### Step 4: Add failing native unit tests if `Signature::salt()` is missing/insufficient
- Modify `../falcon-rs/src/falcon.rs` tests only if needed.
- Test `Signature::salt()` returns the exact salt used in `sign_with_salt` and is preserved by `to_bytes`/`from_bytes`.
- Run targeted tests and confirm failure first (skip this step if already covered and passing in baseline).

### Step 5: Implement `sign()` WASM binding behavior
- Modify `../falcon-rs/src/wasm.rs` implementation.
- Ensure signature is:
  - `pub fn sign(sk_bytes: &[u8], message: &[u8], salt: &[u8]) -> Result<JsValue, JsError>`
- Implementation order inside function:
  - validate `salt.len() == SALT_LEN`
  - deserialize `sk` via `SecretKey::from_bytes(sk_bytes)`
  - call `Falcon::<Shake256Hash>::sign_with_salt(&sk, message, &salt_arr)`
  - build JS result object with `signature` and `salt`
  - optionally attach `s1` field as `Int32Array` when enabled by agreed scope
- Preserve client-only crypto invariant: no server-side operations or secret-key export beyond existing browser memory.

### Step 6: Implement/adjust `Signature::salt()` accessor only if needed
- Modify `../falcon-rs/src/falcon.rs` only if accessor does not satisfy ticket needs.
- Required signature:
  - `pub fn salt(&self) -> &[u8; SALT_LEN]`
- Keep API minimal and immutable.

### Step 7: Make tests pass incrementally
- Run targeted test groups after each implementation change:
  - wasm sign response tests
  - wasm sign/verify roundtrip
  - wasm validation tests
  - falcon native salt accessor tests
- Fix only failing assertions related to WASM-002 scope.

### Step 8: Regression test sweep
- Run full Rust tests with shake/wasm feature coverage:
  - `cargo test --features shake`
  - `cargo test --features wasm`
  - `wasm-pack test --node --features wasm` (if available in environment)
- Confirm no regressions against existing falcon-rs behavior.

## Files to create/modify (with specific function signatures)

### Modify: `../falcon-rs/src/wasm.rs`
- Function under ticket:
  - `pub fn sign(sk_bytes: &[u8], message: &[u8], salt: &[u8]) -> Result<JsValue, JsError>`
- Return object keys:
  - `signature: Uint8Array`
  - `salt: Uint8Array`
  - optional `s1: Int32Array`
- Tests in `#[cfg(test)] mod wasm_tests`:
  - add/adjust sign response shape test
  - add/adjust sign+verify roundtrip test
  - add/adjust error-path tests

### Modify (if needed): `../falcon-rs/src/falcon.rs`
- Accessor expected by ticket:
  - `pub fn salt(&self) -> &[u8; SALT_LEN]`
- Tests in `#[cfg(all(test, feature = "shake"))] mod tests`:
  - salt accessor behavior and serialization stability

### No new files required for implementation
- WASM-002 should be satisfiable via targeted edits to existing files.

## Tests to write

### Unit tests
- `falcon.rs`: `Signature::salt()` returns exact signing salt.
- `falcon.rs`: salt survives `to_bytes`/`from_bytes` roundtrip.
- `wasm.rs`: `sign()` rejects invalid salt length.
- `wasm.rs`: `sign()` rejects invalid secret key length/content via `SecretKey::from_bytes` error path.

### Integration tests (wasm-bindgen surface)
- `wasm.rs`: `keygen` -> `sign` returns JS object with typed arrays (`signature`, `salt`, optional `s1`).
- `wasm.rs`: `keygen` -> `sign` -> `verify` roundtrip returns `true`.
- `wasm.rs`: deterministic salt echo check (`returned_salt == input_salt`).

## Risks and mitigations

- Risk: Secret key deserialization edge cases produce generic JS errors.
- Mitigation: Map `SecretKey::from_bytes` failures to explicit `JsError` messages and test malformed-length + malformed-content cases.

- Risk: JS typed-array mismatches (`Array` vs `Uint8Array`/`Int32Array`) break frontend expectations.
- Mitigation: Assert exact typed-array constructors in wasm-bindgen tests.

- Risk: Optional `s1` field ambiguity causes contract drift between Rust and frontend.
- Mitigation: Document whether `s1` is included unconditionally, feature-gated, or omitted; enforce with one canonical test.

- Risk: Regression in verify compatibility after sign output changes.
- Mitigation: keep `sign` output byte-compatible with `Signature::to_bytes()` and guard with roundtrip integration test.

## How to verify against acceptance criteria

1. `sign()` no longer stubbed and uses `SecretKey::from_bytes`.
- Verified by code inspection in `wasm.rs` and passing malformed-key tests.

2. Signing uses Falcon API (`sign_with_salt` or `sign`) correctly.
- Verified by sign+verify integration test pass.

3. Return type changed to `JsValue` object with required fields.
- Verified by response-shape wasm-bindgen test asserting typed arrays.

4. Third parameter named `salt`.
- Verified by final function signature in `wasm.rs`.

5. No regressions in existing falcon-rs tests.
- Verified by full test sweep (`cargo test --features shake`, `cargo test --features wasm`, `wasm-pack test --node --features wasm`).
