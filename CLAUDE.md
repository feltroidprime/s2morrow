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

**Profiling artifacts:** Store in `profiles/` with `YY-MM-DD-HH:MM_` prefix and git commit suffix for date sorting. See `/benchmarking-cairo` skill for naming convention and helper script.

**BoundedInt optimization:** Use `/using-bounded-int` skill. Regenerate NTT with:
```bash
python -m cairo_gen.circuits.regenerate ntt --n 512
```
