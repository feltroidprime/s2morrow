# S2morrow

Ultra-performant Falcon-512 post-quantum signature verification for Starknet account abstraction.

## Why

Quantum computers will break ECDSA. Starknet's native account abstraction lets wallets upgrade their signature scheme without changing their address — but the replacement must be efficient enough for on-chain verification. S2morrow makes Falcon-512 practical on Starknet.

## Design

Falcon-512 operates over the ring Z_q\[x\]/(x^512 + 1) where q = 12289. Verification requires NTT, polynomial arithmetic, and norm checking — all expensive in a zkVM. S2morrow minimizes cost through three key techniques:

**Hint-based verification (2 NTTs, 0 INTTs):**
The inverse NTT is the most expensive operation. Instead of computing it on-chain, the signer provides `mul_hint = INTT(NTT(s1) * pk_ntt)` as a hint. On-chain verification only needs two forward NTTs to check correctness.

**BoundedInt arithmetic:**
All modular arithmetic uses `Zq = BoundedInt<0, 12288>` with compile-time bounds tracking. This eliminates runtime overflow checks — the type system guarantees correctness. Lazy reduction via `bounded_int_div_rem` keeps operations minimal.

**Auto-generated unrolled NTT:**
A Python DSL (`cairo_gen/`) generates a fully unrolled felt252 NTT for n=512. `ntt_512` accepts `Span<Zq>` directly — no intermediate array allocation.

### Storage

Account abstraction requires the same contract class hash across all accounts, so the public key must live in storage. S2morrow packs 512 Zq coefficients into 29 felt252 slots using base-Q polynomial encoding (9 values per u128, 18 per felt252).

### Hash-to-point

Uses Poseidon (Starknet-native) instead of SHAKE-256. Absorb via `poseidon_hash_span(message || salt)`, then 22 squeeze permutations to extract 512 Zq coefficients through base-Q rejection sampling.

## Packages

| Package | Purpose |
|---------|---------|
| `packages/falcon/` | Production verifier — BoundedInt, unrolled NTT, hint-based |
| `packages/falcon_old/` | Legacy u16 recursive NTT/INTT — reference for cross-testing |
| `packages/falcon_zknox/` | Experimental zknox DIT NTT — benchmarking |

### Companion tooling

| Directory | Purpose |
|-----------|---------|
| `cairo_gen/` | BoundedInt circuit DSL — generates `ntt_felt252.cairo` |
| `falcon_py/` | Python Falcon reference implementation |
| `../falcon-rs/` | Rust crate — test vector generation, Poseidon hash-to-point, hint computation |

## Quick start

```bash
# Install toolchain (versions pinned in .tool-versions)
asdf install

# Run all tests
snforge test -p falcon       # 17 tests — production verifier
snforge test -p falcon_old   # 10 tests — reference implementation

# Regenerate unrolled NTT
python -m cairo_gen.circuits.regenerate ntt --n 512

# Regenerate Rust test vectors
cd ../falcon-rs && cargo test generate_ -- --nocapture
```

## Performance

Profiled at commit `08ed84e` with `cairo-profiler` (cumulative steps):

| Function | Steps | Description |
|----------|-------|-------------|
| `verify` (e2e) | 173,693 | Full verification including hash-to-point |
| `extend_euclidean_norm` | 40,934 | Norm check for s0 + s1 (dominant cost) |
| `sub_zq` | 15,376 | Coefficient subtraction (512 elements) |
| `mul_ntt` | 14,864 | Pointwise multiply (512 elements) |
| `ntt_fast` | ~15K | NTT wrapper (delegates to ntt_512) |
| `intt_with_hint` | 9,742 | Hint verification (forward NTT + compare) |
| `hash_to_point` | 5,988 | Poseidon XOF squeeze (22 permutations) |

**Verification cost breakdown** (`verify_with_msg_point`):
- 2x `ntt_fast`: ~30K steps (NTT of s1 + NTT of mul_hint)
- `mul_ntt`: ~15K steps (pointwise s1_ntt * pk_ntt)
- `intt_with_hint`: ~10K steps (verify hint correctness)
- `sub_zq`: ~15K steps (s0 = msg_point - product)
- `extend_euclidean_norm`: ~41K steps (norm check, dominant cost)

L2 gas: `verify` ~19.1M | `verify_with_msg_point` ~62.5M (includes 2 NTTs)

## References

- [BIP360](https://bip360.org/) — Pay to Quantum Resistant Hash
- [PQ Signatures and Scaling Bitcoin with STARKs](https://delvingbitcoin.org/t/post-quantum-signatures-and-scaling-bitcoin-with-starks/1584)
- [bitcoindev thread](https://groups.google.com/g/bitcoindev/c/wKizvPUfO7w/m/hG9cwpOABQAJ) on post-quantum migration
- [Falcon specification](https://falcon-sign.info/) — NIST PQC finalist (lattice-based)
