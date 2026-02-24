Profile `test_verify_packed_matches_rust` by steps using the benchmarking CLI, then view the PNG.

Run this command:

```bash
cd /home/felt/PycharmProjects/s2morrow && python3 .claude/skills/benchmarking-cairo/profile.py profile \
  --mode snforge \
  --package falcon \
  --test test_verify_packed_matches_rust \
  --name verify-e2e \
  --metric steps
```

After the command completes:
1. Read the generated PNG file (path printed at the end of output)
2. Show the user the profile image and summarize the top functions by steps
3. If the user provided a previous profile to compare against, show a comparison table of total steps and top functions
