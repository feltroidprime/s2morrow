# WASM-001: Implement SecretKey::from_bytes() for WASM secret key reconstruction

## Ticket Summary

Add `SecretKey::from_bytes(bytes: &[u8]) -> Result<Self, FalconError>` to `falcon.rs` that deserializes `f`, `g`, `F`, `G` from 4×896 bytes and reconstructs `b0_fft` and LDL tree by reusing the computation from `keygen_with_rng` (`fft`, `gram`, `ffldl_fft`, `normalize_tree`). Add roundtrip test: keygen → to_bytes → from_bytes → sign → verify.

## Reference Materials

### Specifications
- **`docs/specs/falcon-demo-website.md`** (PRD): P0 requirement under "Focus: wasm" — "Extend falcon-rs `wasm.rs` to implement `sign()` (currently a stub) — requires adding `SecretKey::from_bytes()` to reconstruct b0_fft and LDL tree from serialized (f, g, F, G)."
- **`docs/plans/2026-02-23-falcon-demo-website-design.md`**: Architecture design showing falcon-rs WASM module consumed by FalconService in the Effect Services Layer. WASM Strategy section describes the `sign(sk_bytes, message, salt)` binding that depends on `SecretKey::from_bytes`.
- **`docs/plans/2026-02-23-falcon-demo-website-impl.md`**: Task 2, Step 3 provides a reference implementation sketch for `SecretKey::from_bytes`. The implementation plan describes the full chain: `from_bytes` → `sign_with_salt` → return JS object with signature + salt.
- **`CLAUDE.md`**: Documents that `falcon-rs` is located at `../falcon-rs/` relative to the s2morrow project root.

### Key Constants
- `N = 512` (polynomial degree)
- `Q = 12289` (integer modulus)
- `PUBLIC_KEY_LEN = 896` bytes (512 coefficients × 14 bits / 8)
- `SALT_LEN = 40` bytes
- `SEED_LEN = 56` bytes
- `SIGMA = 165.7366171829776` (normalization constant for LDL tree)
- `SIG_BOUND = 34034726` (signature norm bound)
- `SIG_BYTELEN = 666` (signature byte length)
- Secret key byte length: `4 × 896 = 3584` bytes

## Existing Implementation

### SecretKey struct (`../falcon-rs/src/falcon.rs` lines 64-77)

```rust
pub struct SecretKey {
    f: [i32; N],           // NTRU secret polynomial f
    g: [i32; N],           // NTRU secret polynomial g
    capital_f: [i32; N],   // NTRU secret polynomial F
    capital_g: [i32; N],   // NTRU secret polynomial G
    b0_fft: [[Vec<Complex>; 2]; 2],  // Basis B0 in FFT representation
    tree: LdlTree,         // LDL tree for fast sampling
}
```

**Key insight:** `b0_fft` and `tree` are derived values computed from `(f, g, F, G)`. They are NOT serialized by `to_bytes()` and must be reconstructed in `from_bytes()`.

### SecretKey::to_bytes() (`../falcon-rs/src/falcon.rs` lines 116-123)

```rust
pub fn to_bytes(&self) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(4 * PUBLIC_KEY_LEN);
    bytes.extend_from_slice(&serialize_public_key(&self.f));
    bytes.extend_from_slice(&serialize_public_key(&self.g));
    bytes.extend_from_slice(&serialize_public_key(&self.capital_f));
    bytes.extend_from_slice(&serialize_public_key(&self.capital_g));
    bytes
}
```

Format: `f || g || F || G`, each 896 bytes (14-bit encoding via `serialize_public_key`).

### keygen_with_rng() — the reconstruction reference (`../falcon-rs/src/falcon.rs` lines 279-333)

The `from_bytes` method must replicate lines 292-319 of `keygen_with_rng`:

```rust
// 1. Build B0 = [[g, -f], [G, -F]] in f64 coefficient representation
let neg_f: Vec<f64> = f_vec.iter().map(|&x| -(x as f64)).collect();
let neg_f_cap: Vec<f64> = capital_f.iter().map(|&x| -(x as f64)).collect();
let b0: [[Vec<f64>; 2]; 2] = [
    [g_vec.iter().map(|&x| x as f64).collect(), neg_f],
    [capital_g.iter().map(|&x| x as f64).collect(), neg_f_cap],
];

// 2. Convert B0 to FFT representation
let b0_fft = [
    [fft(&b0[0][0]), fft(&b0[0][1])],
    [fft(&b0[1][0]), fft(&b0[1][1])],
];

// 3. Compute Gram matrix G0 = B0 * B0^* in coefficient domain, then FFT
let g0 = gram(&b0);
let g0_fft = [
    [fft(&g0[0][0]), fft(&g0[0][1])],
    [fft(&g0[1][0]), fft(&g0[1][1])],
];

// 4. Build and normalize LDL tree
let mut tree = ffldl_fft(&g0_fft);
normalize_tree(&mut tree, SIGMA);
```

### Serialization functions (`../falcon-rs/src/encoding.rs`)

- `serialize_public_key(poly: &[i32; N]) -> Vec<u8>`: 14-bit packing, coefficients reduced mod Q.
- `deserialize_public_key(bytes: &[u8]) -> Option<[i32; N]>`: Inverse of serialize. Returns `None` if byte length != 896 or any coefficient >= Q.

**Important:** `deserialize_public_key` returns coefficients in `[0, Q)` range. For `f`, `g`, `F`, `G` these are the NTRU polynomials which may have been stored as `rem_euclid(Q)`. The secret polynomials are small integers that should be reconstructable from this representation.

### FalconError enum (`../falcon-rs/src/falcon.rs` lines 32-38)

```rust
pub enum FalconError {
    InvalidPublicKey,
    InvalidSignature,
    InvalidSecretKey,      // ← Use this for from_bytes errors
    SignatureNormTooLarge,
    DecompressionFailed,
}
```

Already has `InvalidSecretKey` variant — no enum modification needed.

### FFT/LDL functions used in reconstruction

| Function | Module | Signature |
|----------|--------|-----------|
| `fft` | `fft.rs` | `pub fn fft(f: &[f64]) -> Vec<Complex>` |
| `gram` | `ffsampling.rs` | `pub fn gram(b: &[[Vec<f64>; 2]; 2]) -> [[Vec<f64>; 2]; 2]` |
| `ffldl_fft` | `ffsampling.rs` | `pub fn ffldl_fft(g: &[[Vec<Complex>; 2]; 2]) -> LdlTree` |
| `normalize_tree` | `ffsampling.rs` | `pub fn normalize_tree(tree: &mut LdlTree, sigma: f64)` |
| `deserialize_public_key` | `encoding.rs` | `pub fn deserialize_public_key(bytes: &[u8]) -> Option<[i32; N]>` |

All are already `pub` and imported in `falcon.rs`.

### Existing imports in falcon.rs (line 5)

```rust
use crate::ffsampling::{ffldl_fft, ffsampling_fft, gram, normalize_tree, LdlTree};
use crate::fft::{add_fft, fft, ifft, mul_fft, Complex};
use crate::encoding::{compress, decompress, deserialize_public_key, serialize_public_key};
```

All required functions are already imported — no new imports needed for `from_bytes`.

### LdlTree enum (`../falcon-rs/src/ffsampling.rs` lines 10-19)

```rust
#[derive(Clone)]
pub enum LdlTree {
    Leaf(f64),
    Node {
        l10: Vec<Complex>,
        left: Box<LdlTree>,
        right: Box<LdlTree>,
    },
}
```

### Signature struct — salt accessor needed (`../falcon-rs/src/falcon.rs` lines 103-110)

```rust
pub struct Signature {
    header: u8,
    salt: [u8; SALT_LEN],    // Private field — needs public accessor
    s1_enc: Vec<u8>,
}
```

The `salt` field is private. A `pub fn salt(&self) -> &[u8; SALT_LEN]` accessor is needed (separate ticket WASM-002 but included in Task 2 of the impl plan).

### Existing wasm.rs stub (`../falcon-rs/src/wasm.rs` lines 49-54)

```rust
#[wasm_bindgen]
pub fn sign(_sk_bytes: &[u8], _message: &[u8], _seed: &[u8]) -> Result<Vec<u8>, JsError> {
    Err(JsError::new(
        "sign() not yet implemented for WASM. Use native Rust API.",
    ))
}
```

### Existing test patterns (`../falcon-rs/src/falcon.rs` lines 586-667 and `../falcon-rs/tests/wasm_bindings_test.rs`)

The roundtrip test should follow the pattern from `test_sign_verify_roundtrip` (line 607):
```rust
let seed = [42u8; 32];
let (sk, vk) = Falcon::<Shake256Hash>::keygen_with_seed(&seed);
let message = b"Hello, Falcon!";
let salt = [0u8; SALT_LEN];
let sig = Falcon::<Shake256Hash>::sign_with_salt(&sk, message, &salt);
let result = Falcon::<Shake256Hash>::verify(&vk, message, &sig);
```

The new roundtrip test adds: `sk.to_bytes()` → `SecretKey::from_bytes()` → sign with reconstructed key → verify.

## Files to Modify

| File | Change |
|------|--------|
| `../falcon-rs/src/falcon.rs` | Add `SecretKey::from_bytes()` method in the `impl SecretKey` block (after line 123). Add roundtrip test in `mod tests`. |

## Implementation Notes

1. **Byte length validation:** `from_bytes` must check `bytes.len() == 4 * PUBLIC_KEY_LEN` (3584 bytes).
2. **Polynomial deserialization:** Use `deserialize_public_key()` for each 896-byte chunk. It returns `Option<[i32; N]>` — map `None` to `FalconError::InvalidSecretKey`.
3. **Coefficient range:** `deserialize_public_key` returns values in `[0, Q)`. The secret polynomials `f`, `g`, `F`, `G` are small integers that `serialize_public_key` stores as `coef.rem_euclid(Q)`. Since `keygen_with_rng` constructs `b0` using the raw signed values, but `serialize_public_key` reduces them mod Q, the `from_bytes` path uses the `[0, Q)` representation which works because all the FFT/Gram operations use `f64` conversions that are equivalent mod Q for the Gram matrix computation. **However**, note that `sample_preimage` uses `b0_fft` directly for the signing computation — the B0 matrix elements must be the actual signed coefficient values, not their mod-Q representatives. This means we need to center the deserialized values: if a coefficient > Q/2, subtract Q to get the signed representation.
4. **Centering is critical:** The secret polynomials are small (typically |coef| < 10). After `deserialize_public_key`, coefficients are in `[0, Q)`. Values near Q represent negative numbers — they must be converted back: `if c > Q/2 { c - Q } else { c }`.
5. **Reconstruction is deterministic:** Given the same `(f, g, F, G)`, `fft`, `gram`, `ffldl_fft`, and `normalize_tree` produce identical `b0_fft` and `tree` every time.
6. **Test seed 42:** The existing tests use `seed = [42u8; 32]` which is known to produce a valid keypair reliably.

## Dependency Chain

```
WASM-001 (SecretKey::from_bytes)
    ↓
WASM-002 (sign() WASM binding + Signature::salt() accessor)
    ↓
ES-002 (FalconService.sign Effect wrapper)
    ↓
Verify Playground (interactive demo)
```

`SecretKey::from_bytes` is the first prerequisite in the WASM chain — it unblocks the sign() binding which unblocks the entire interactive demo.
