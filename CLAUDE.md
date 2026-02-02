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

**Profiling artifacts:** All profiles (`.pb.gz`), PNG call graphs, and logs go in `profiles/` at the project root. Name files with git commit suffix:
- `profiles/<package>_<function>_<metric>_<commit>.pb.gz` (e.g., `falcon_ntt512_steps_abc1234.pb.gz`)
- `profiles/<package>_<function>_<metric>_<commit>.png` (e.g., `falcon_ntt512_steps_abc1234.png`)

Generate filenames with: `echo "profiles/${NAME}_$(git rev-parse --short HEAD).pb.gz"`

**BoundedInt optimization:** Use `/using-bounded-int` skill. Regenerate NTT with:
```bash
python -m hydra.compilable_circuits.regenerate ntt --n 512
```
