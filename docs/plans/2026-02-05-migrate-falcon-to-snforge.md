# Migrate Falcon Package from Executables to snforge Tests

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all `[[target.executable]]` definitions from `packages/falcon/` and convert benchmark programs to snforge tests, fixing the "cycle during cost computation" bug (starknet-foundry#4151) and enabling profiling via `snforge test --save-trace-data`.

**Architecture:** Replace executable entry points with snforge tests that use `snforge_std::fs::read_json` to load test data from JSON files.

**Tech Stack:** Cairo, snforge, scarb

---

### Task 1: Update Scarb.toml

**Files:**
- Modify: `packages/falcon/Scarb.toml`

**Changes:**

Remove all executable targets and the `cairo_execute` dependency:

```toml
[package]
name = "falcon"
version = "0.1.0"
edition = "2024_07"

[lib]

[dependencies]
corelib_imports = "0.1.2"

[dev-dependencies]
snforge_std = { git = "https://github.com/foundry-rs/starknet-foundry", tag = "v0.55.0" }
assert_macros = "2.15.1"
```

**Verification:**
- `scarb build` succeeds

---

### Task 2: Update lib.cairo

**Files:**
- Modify: `packages/falcon/src/lib.cairo`

**Changes:**

Remove `#[cfg(not(test))]` guards and the programs module:

```cairo
// SPDX-FileCopyrightText: 2025 StarkWare Industries Ltd.
//
// SPDX-License-Identifier: MIT

pub mod falcon;
pub mod ntt;
pub mod ntt_constants;
pub mod ntt_felt252;
pub mod intt_felt252;
pub mod zq;
```

**Verification:**
- `scarb build` succeeds

---

### Task 3: Create NTT Test File

**Files:**
- Create: `packages/falcon/tests/test_ntt.cairo`

**Content:**

```cairo
use falcon::ntt::ntt;
use falcon::ntt_felt252::ntt_512;
use snforge_std::fs::{FileTrait, read_json};

#[test]
fn test_ntt_recursive_512() {
    // Load input from JSON (512 u16 values serialized as felt252)
    let file = FileTrait::new("tests/data/ntt_input_512.json");
    let input: Array<felt252> = read_json(@file);

    // Convert felt252 -> u16 for recursive NTT
    let mut u16_input: Array<u16> = array![];
    for val in input {
        u16_input.append(val.try_into().unwrap());
    };

    let result = ntt(u16_input.span());
    assert_eq!(result.len(), 512);
}

#[test]
fn test_ntt_felt252_512() {
    let file = FileTrait::new("tests/data/ntt_input_512.json");
    let input: Array<felt252> = read_json(@file);

    let result = ntt_512(input);
    assert_eq!(result.len(), 512);
}
```

**Verification:**
- `snforge test test_ntt` passes

---

### Task 4: Create Verification Test File

**Files:**
- Create: `packages/falcon/tests/test_verify.cairo`

**Content:**

```cairo
use falcon::falcon;
use snforge_std::fs::{FileTrait, read_json};

#[derive(Drop, Serde)]
struct Args {
    attestations: Array<Attestation>,
    n: u32,
}

#[derive(Drop, Serde)]
struct Attestation {
    s1: Array<u16>,
    pk: Array<u16>,
    msg_point: Array<u16>,
}

#[test]
fn test_verify_512() {
    let file = FileTrait::new("tests/data/args_512_1.json");
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let args: Args = Serde::deserialize(ref span).expect('deserialize failed');

    for attestation in args.attestations.span() {
        falcon::verify_uncompressed::<512>(
            attestation.s1.span(),
            attestation.pk.span(),
            attestation.msg_point.span(),
            args.n
        ).expect('Invalid signature');
    }
}
```

**Verification:**
- `snforge test test_verify` passes

---

### Task 5: Delete Obsolete Files

**Files to delete:**
- `packages/falcon/src/programs.cairo`
- `packages/falcon/src/programs/bench_ntt_bounded_int.cairo`
- `packages/falcon/src/programs/bench_ntt_recursive.cairo`
- `packages/falcon/tests/data/args_1024_1.json`

**Verification:**
- `scarb build` succeeds
- `snforge test` passes

---

### Task 6: Verify Profiling Works

**Commands:**

```bash
# Run all tests with trace data
cd packages/falcon
snforge test --save-trace-data --tracked-resource cairo-steps

# Verify trace files are generated
ls snfoundry_trace/

# Build and view profile for NTT
cairo-profiler build-profile \
  snfoundry_trace/falcon_tests_test_ntt_test_ntt_felt252_512.json \
  --show-libfuncs

cairo-profiler view profile.pb.gz --sample steps --limit 20
```

**Expected:**
- Trace files generated in `snfoundry_trace/`
- Profile builds successfully
- No "cycle during cost computation" errors

---

### Summary of Changes

| Before | After |
|--------|-------|
| 3 executables in Scarb.toml | No executables |
| `cairo_execute` dependency | Removed |
| `#[cfg(not(test))]` guards | Removed |
| `src/programs/` module | Deleted |
| Profiling via `scarb execute` | Profiling via `snforge test --save-trace-data` |
