# Project Guidelines

## Cairo Tooling

**Always use ASDF.** Versions pinned in `.tool-versions`.

**Dependencies:** Use `snforge_std` + `assert_macros`. Never `cairo_test` (they conflict).

```toml
[dev-dependencies]
snforge_std = { git = "https://github.com/foundry-rs/starknet-foundry", tag = "v0.55.0" }
assert_macros = "2.15.1"
```

**Running executables:**
```bash
# NTT benchmark (felt252 mode)
scarb execute --executable-name bench_ntt_bounded_int \
  --arguments-file packages/falcon/tests/data/ntt_input_512.json \
  --print-resource-usage --save-profiler-trace-data
```

**Profiling:** Use `/benchmarking-cairo` skill. Note: snforge may hit "cycle during cost computation" errors with large BoundedInt code—use `scarb execute` instead.

**BoundedInt optimization:** Use `/using-bounded-int` skill. Regenerate NTT with:
```bash
python -m cairo_gen.circuits.regenerate ntt --n 512
```

## snforge Test Data Loading

**Always use `Serde::deserialize` to load JSON test data.** Never use manual index arithmetic with `read_json` — the snforge object wrapper makes manual offsets error-prone and failures are silent when comparing two implementations on the same (wrong) input.

```cairo
#[derive(Drop, Serde)]
struct MyData { input: Array<felt252> }

fn load_data(path: ByteArray) -> Span<felt252> {
    let file = FileTrait::new(path);
    let serialized = read_json(@file);
    let mut span = serialized.span();
    let _header = span.pop_front(); // skip snforge object wrapper
    let data: MyData = Serde::deserialize(ref span).expect('deser fail');
    data.input.span()
}
```

See `test_verify.cairo` for the canonical example with nested structs.
