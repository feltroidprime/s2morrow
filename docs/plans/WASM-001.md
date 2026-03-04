# WASM-001: SecretKey::from_bytes() Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `SecretKey::from_bytes(bytes: &[u8]) -> Result<Self, FalconError>` to falcon-rs that deserializes (f, g, F, G) from 4×896 bytes, centers coefficients, and reconstructs b0_fft + LDL tree — enabling the WASM sign() binding.

**Architecture:** Single method addition to the existing `impl SecretKey` block in `falcon.rs`. Reuses the FFT → Gram → ffLDL → normalize pipeline from `keygen_with_rng`. The centering step (values > Q/2 → subtract Q) is critical because `serialize_public_key` reduces coefficients mod Q, but the Gram matrix and signing preimage require signed values.

**Tech Stack:** Rust, falcon-rs crate (`../falcon-rs/`)

**Reference files:**
- `docs/context/WASM-001.md` — full research context
- `../falcon-rs/src/falcon.rs` — SecretKey struct, to_bytes(), keygen_with_rng()
- `../falcon-rs/src/encoding.rs` — serialize_public_key(), deserialize_public_key()
- `../falcon-rs/src/ffsampling.rs` — gram(), ffldl_fft(), normalize_tree()
- `../falcon-rs/src/fft.rs` — fft()

---

### Task 1: Write failing roundtrip test

**Files:**
- Modify: `../falcon-rs/src/falcon.rs` (add test in `mod tests`)

**Step 1: Write the failing roundtrip test**

Add this test inside the existing `#[cfg(all(test, feature = "shake"))] mod tests` block at the end of `falcon.rs` (after line 666):

```rust
#[test]
fn test_secret_key_roundtrip_from_bytes() {
    // 1. Generate a known-good keypair
    let seed = [42u8; 32];
    let (sk, vk) = Falcon::<Shake256Hash>::keygen_with_seed(&seed);

    // 2. Serialize → deserialize
    let sk_bytes = sk.to_bytes();
    let sk2 = SecretKey::from_bytes(&sk_bytes).expect("from_bytes should succeed");

    // 3. Verify polynomials match
    assert_eq!(sk.f, sk2.f, "f polynomial mismatch");
    assert_eq!(sk.g, sk2.g, "g polynomial mismatch");
    assert_eq!(sk.capital_f, sk2.capital_f, "F polynomial mismatch");
    assert_eq!(sk.capital_g, sk2.capital_g, "G polynomial mismatch");

    // 4. Sign with reconstructed key → verify with original VK
    let message = b"roundtrip test message";
    let salt = [0u8; SALT_LEN];
    let sig = Falcon::<Shake256Hash>::sign_with_salt(&sk2, message, &salt);
    let result = Falcon::<Shake256Hash>::verify(&vk, message, &sig);
    assert!(result.is_ok());
    assert!(result.unwrap(), "Signature from reconstructed key should verify");
}
```

**Step 2: Run the test to verify it fails**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test test_secret_key_roundtrip_from_bytes --features shake -- --nocapture`

Expected: FAIL — `SecretKey::from_bytes` method does not exist yet.

**Step 3: Commit the failing test**

```bash
jj describe -m "test(wasm): add failing roundtrip test for SecretKey::from_bytes"
```

---

### Task 2: Write failing error-case tests

**Files:**
- Modify: `../falcon-rs/src/falcon.rs` (add tests in `mod tests`)

**Step 1: Write error case tests**

Add these tests after the roundtrip test:

```rust
#[test]
fn test_secret_key_from_bytes_wrong_length() {
    // Too short
    let short = vec![0u8; 100];
    assert_eq!(
        SecretKey::from_bytes(&short),
        Err(FalconError::InvalidSecretKey),
        "Should reject bytes with wrong length"
    );

    // Too long
    let long = vec![0u8; 4 * PUBLIC_KEY_LEN + 1];
    assert_eq!(
        SecretKey::from_bytes(&long),
        Err(FalconError::InvalidSecretKey),
        "Should reject bytes that are too long"
    );

    // Empty
    assert_eq!(
        SecretKey::from_bytes(&[]),
        Err(FalconError::InvalidSecretKey),
        "Should reject empty bytes"
    );
}

#[test]
fn test_secret_key_from_bytes_invalid_coefficients() {
    // Create valid-length bytes but with a coefficient >= Q in the first polynomial
    let mut bytes = vec![0u8; 4 * PUBLIC_KEY_LEN];
    // Set first 14 bits to Q (12289 = 0x3001), which is invalid
    // 12289 in little-endian 14-bit: bits 0-13
    // 12289 = 0b11000000000001
    bytes[0] = 0x01; // bit 0 set
    bytes[1] = 0x30; // bits 12,13 set (0x30 = 0b00110000, in bit positions 8-15)
    // This encodes coefficient 12289 which is >= Q, should be rejected
    assert_eq!(
        SecretKey::from_bytes(&bytes),
        Err(FalconError::InvalidSecretKey),
        "Should reject bytes with coefficient >= Q"
    );
}
```

**Step 2: Run the tests to verify they fail**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test test_secret_key_from_bytes --features shake -- --nocapture`

Expected: FAIL — `SecretKey::from_bytes` does not exist.

**Step 3: Commit the failing tests**

```bash
jj describe -m "test(wasm): add failing error-case tests for SecretKey::from_bytes"
```

---

### Task 3: Implement SecretKey::from_bytes()

**Files:**
- Modify: `../falcon-rs/src/falcon.rs` (add method in `impl SecretKey` block, after line 123)

**Step 1: Implement the from_bytes method**

Add this method inside the existing `impl SecretKey` block (after `to_bytes()`, around line 124):

```rust
/// Deserialize a secret key from bytes.
///
/// Reconstructs the full secret key including `b0_fft` and the LDL tree
/// from the serialized (f, g, F, G) polynomials. This replicates the
/// computation performed during key generation.
///
/// # Format
///
/// The input must be exactly `4 * PUBLIC_KEY_LEN` (3584) bytes:
/// `f || g || F || G`, each polynomial encoded as 896 bytes (14-bit coefficients).
///
/// # Coefficient centering
///
/// `serialize_public_key` reduces coefficients mod Q, so negative values
/// (e.g., -3) are stored as Q-3 (12286). This method centers them back:
/// values > Q/2 are mapped to value - Q, restoring the original signed
/// representation needed for the Gram matrix and signing preimage.
///
/// # Errors
///
/// Returns `FalconError::InvalidSecretKey` if:
/// - Byte length is not `4 * PUBLIC_KEY_LEN`
/// - Any polynomial chunk fails to deserialize (invalid 14-bit encoding)
pub fn from_bytes(bytes: &[u8]) -> Result<Self, FalconError> {
    if bytes.len() != 4 * PUBLIC_KEY_LEN {
        return Err(FalconError::InvalidSecretKey);
    }

    // Deserialize 4 polynomials from consecutive 896-byte chunks
    let f_raw = deserialize_public_key(
        bytes[0..PUBLIC_KEY_LEN].try_into().unwrap(),
    )
    .ok_or(FalconError::InvalidSecretKey)?;

    let g_raw = deserialize_public_key(
        bytes[PUBLIC_KEY_LEN..2 * PUBLIC_KEY_LEN].try_into().unwrap(),
    )
    .ok_or(FalconError::InvalidSecretKey)?;

    let cf_raw = deserialize_public_key(
        bytes[2 * PUBLIC_KEY_LEN..3 * PUBLIC_KEY_LEN].try_into().unwrap(),
    )
    .ok_or(FalconError::InvalidSecretKey)?;

    let cg_raw = deserialize_public_key(
        bytes[3 * PUBLIC_KEY_LEN..4 * PUBLIC_KEY_LEN].try_into().unwrap(),
    )
    .ok_or(FalconError::InvalidSecretKey)?;

    // Center coefficients: values > Q/2 represent negative numbers
    // e.g., 12286 → 12286 - 12289 = -3
    let half_q = Q / 2;
    let mut f = [0i32; N];
    let mut g = [0i32; N];
    let mut capital_f = [0i32; N];
    let mut capital_g = [0i32; N];

    for i in 0..N {
        f[i] = if f_raw[i] > half_q { f_raw[i] - Q } else { f_raw[i] };
        g[i] = if g_raw[i] > half_q { g_raw[i] - Q } else { g_raw[i] };
        capital_f[i] = if cf_raw[i] > half_q { cf_raw[i] - Q } else { cf_raw[i] };
        capital_g[i] = if cg_raw[i] > half_q { cg_raw[i] - Q } else { cg_raw[i] };
    }

    // Reconstruct b0_fft and LDL tree — same pipeline as keygen_with_rng
    // B0 = [[g, -f], [G, -F]] in f64 coefficient representation
    let neg_f: Vec<f64> = f.iter().map(|&x| -(x as f64)).collect();
    let neg_f_cap: Vec<f64> = capital_f.iter().map(|&x| -(x as f64)).collect();
    let b0: [[Vec<f64>; 2]; 2] = [
        [g.iter().map(|&x| x as f64).collect(), neg_f],
        [capital_g.iter().map(|&x| x as f64).collect(), neg_f_cap],
    ];

    // Convert B0 to FFT representation
    let b0_fft = [
        [fft(&b0[0][0]), fft(&b0[0][1])],
        [fft(&b0[1][0]), fft(&b0[1][1])],
    ];

    // Compute Gram matrix G0 = B0 * B0^* in coefficient domain, then FFT
    let g0 = gram(&b0);
    let g0_fft = [
        [fft(&g0[0][0]), fft(&g0[0][1])],
        [fft(&g0[1][0]), fft(&g0[1][1])],
    ];

    // Build and normalize LDL tree
    let mut tree = ffldl_fft(&g0_fft);
    normalize_tree(&mut tree, SIGMA);

    Ok(SecretKey {
        f,
        g,
        capital_f,
        capital_g,
        b0_fft,
        tree,
    })
}
```

**Step 2: Run the roundtrip test to verify it passes**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test test_secret_key_roundtrip_from_bytes --features shake -- --nocapture`

Expected: PASS — keygen → to_bytes → from_bytes → sign → verify succeeds.

**Step 3: Run the error-case tests to verify they pass**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test test_secret_key_from_bytes --features shake -- --nocapture`

Expected: PASS — both `test_secret_key_from_bytes_wrong_length` and `test_secret_key_from_bytes_invalid_coefficients` pass.

**Step 4: Run the full test suite to verify nothing is broken**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test --features shake`

Expected: All existing tests pass. Zero regressions.

**Step 5: Commit the implementation**

```bash
jj describe -m "feat(wasm): implement SecretKey::from_bytes with centering and LDL reconstruction"
```

---

### Task 4: Write b0_fft equivalence test

This test verifies that the reconstructed b0_fft matches the original — ensuring the centering and FFT pipeline produce identical results.

**Files:**
- Modify: `../falcon-rs/src/falcon.rs` (add test in `mod tests`)

**Step 1: Write the b0_fft equivalence test**

```rust
#[test]
fn test_secret_key_from_bytes_b0_fft_matches() {
    let seed = [42u8; 32];
    let (sk, _vk) = Falcon::<Shake256Hash>::keygen_with_seed(&seed);

    let sk_bytes = sk.to_bytes();
    let sk2 = SecretKey::from_bytes(&sk_bytes).expect("from_bytes should succeed");

    // Verify b0_fft matches element by element
    for row in 0..2 {
        for col in 0..2 {
            assert_eq!(
                sk.b0_fft[row][col].len(),
                sk2.b0_fft[row][col].len(),
                "b0_fft[{}][{}] length mismatch",
                row,
                col
            );
            for (i, (a, b)) in sk.b0_fft[row][col]
                .iter()
                .zip(sk2.b0_fft[row][col].iter())
                .enumerate()
            {
                assert!(
                    (a.re - b.re).abs() < 1e-10 && (a.im - b.im).abs() < 1e-10,
                    "b0_fft[{}][{}][{}] mismatch: {:?} vs {:?}",
                    row,
                    col,
                    i,
                    a,
                    b,
                );
            }
        }
    }
}
```

**Step 2: Run the test**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test test_secret_key_from_bytes_b0_fft_matches --features shake -- --nocapture`

Expected: PASS — b0_fft from keygen and from_bytes are identical (within f64 epsilon).

**Step 3: Commit**

```bash
jj describe -m "test(wasm): add b0_fft equivalence test for SecretKey::from_bytes"
```

---

### Task 5: Write signing-equivalence test (different message)

Verifies that the reconstructed key produces valid signatures for arbitrary messages, not just one fixed message.

**Files:**
- Modify: `../falcon-rs/src/falcon.rs` (add test in `mod tests`)

**Step 1: Write the multi-message test**

```rust
#[test]
fn test_secret_key_from_bytes_sign_multiple_messages() {
    let seed = [42u8; 32];
    let (sk, vk) = Falcon::<Shake256Hash>::keygen_with_seed(&seed);

    let sk2 = SecretKey::from_bytes(&sk.to_bytes()).expect("from_bytes should succeed");

    let messages: &[&[u8]] = &[
        b"Hello, Falcon!",
        b"",
        b"A longer message that tests with more content to ensure robustness",
        &[0xFF; 256],
    ];

    for (idx, &msg) in messages.iter().enumerate() {
        let salt = [idx as u8; SALT_LEN];
        let sig = Falcon::<Shake256Hash>::sign_with_salt(&sk2, msg, &salt);
        let result = Falcon::<Shake256Hash>::verify(&vk, msg, &sig);
        assert!(result.is_ok(), "Message {} verification errored", idx);
        assert!(
            result.unwrap(),
            "Message {} signature invalid with reconstructed key",
            idx
        );
    }
}
```

**Step 2: Run the test**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test test_secret_key_from_bytes_sign_multiple --features shake -- --nocapture`

Expected: PASS — all 4 messages sign + verify correctly.

**Step 3: Commit**

```bash
jj describe -m "test(wasm): add multi-message signing test for reconstructed SecretKey"
```

---

### Task 6: Final verification and squash

**Step 1: Run the complete falcon-rs test suite**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo test --features shake`

Expected: All tests pass. Zero regressions.

**Step 2: Run clippy**

Run: `cd /home/felt/PycharmProjects/falcon-rs && cargo clippy --features shake -- -D warnings`

Expected: No warnings.

**Step 3: Squash into a single commit**

```bash
jj describe -m "📝 docs(wasm): create plan for WASM-001"
jj new
jj bookmark set ticket/WASM-001 -r @
jj git push --bookmark ticket/WASM-001
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Centering bug: forgetting to center coefficients | **High** if not careful | **Critical** — signing produces wrong signatures | Task 1 test catches this: sign with reconstructed key must verify. Task 4 verifies b0_fft element-by-element. |
| `deserialize_public_key` returns `&[u8]` not `&[u8; 896]` | Low | Compile error | Use `.try_into().unwrap()` — slice is exactly 896 bytes by construction from the length check. |
| f64 precision drift in FFT/Gram/LDL | Very low | Signing sometimes fails | Task 4's b0_fft comparison uses 1e-10 epsilon. Task 5 tests 4 different messages to surface any precision issues. |
| `deserialize_public_key` signature takes `&[u8]` not `&[u8; N*14/8]` | Low | Type mismatch | Checked in encoding.rs — it takes `&[u8]` and validates length internally. |

## Acceptance Criteria Verification

| Criterion | Verified by |
|-----------|-------------|
| `SecretKey::from_bytes` deserializes f, g, F, G from 4×896 bytes | Task 1 roundtrip test, Task 2 error tests |
| Reconstructs b0_fft by reusing keygen_with_rng pipeline | Task 4 b0_fft equivalence test |
| Reconstructs LDL tree by reusing keygen_with_rng pipeline | Task 1 roundtrip test (sign requires working tree) |
| Roundtrip: keygen → to_bytes → from_bytes → sign → verify | Task 1 (`test_secret_key_roundtrip_from_bytes`) |
| Returns `FalconError::InvalidSecretKey` on invalid input | Task 2 error tests (wrong length, invalid coefficients) |
| All existing tests still pass | Task 6 full suite verification |

## Files Modified

| File | Change |
|------|--------|
| `../falcon-rs/src/falcon.rs` | Add `SecretKey::from_bytes()` method (~60 lines). Add 5 tests (~90 lines). |

No new files created. No new dependencies. No import changes needed (all required functions already imported).
