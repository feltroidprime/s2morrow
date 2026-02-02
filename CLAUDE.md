# Project Guidelines

## Cairo Tooling

**Always use ASDF.** Versions pinned in `.tool-versions`.

**Dependencies:** Use `snforge_std` + `assert_macros`. Never `cairo_test` (they conflict).

```toml
[dev-dependencies]
snforge_std = { git = "https://github.com/foundry-rs/starknet-foundry", tag = "v0.55.0" }
assert_macros = "2.15.1"
```

**Profiling:** Use `/benchmarking-cairo` skill. Note: snforge may hit "cycle during cost computation" errors with large BoundedInt code—use `scarb execute` instead.

**Profiling artifacts:** Store in `profiles/` with git commit suffix. See `/benchmarking-cairo` skill for naming convention and helper script.

**BoundedInt optimization:** Use `/using-bounded-int` skill. Regenerate NTT with:
```bash
python -m hydra.compilable_circuits.regenerate ntt --n 512
```
