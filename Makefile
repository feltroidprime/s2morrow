TARGET_DIR = target
PROVING_UTILS_REV=efbaeebfdce3463aa61e16d7d8e6069f03df0994

install-stwo-run-and-prove:
	cargo +nightly-2025-07-14 install \
		--git ssh://git@github.com/m-kus/proving-utils.git \
		--rev $(PROVING_UTILS_REV) \
		stwo_run_and_prove --force

falcon-execute:
	rm -rf $(TARGET_DIR)/execute/falcon \
		&& cd packages/falcon \
		&& scarb execute --arguments-file tests/data/args_512_1.json --print-resource-usage --save-profiler-trace-data

falcon-args:
	python packages/falcon/scripts/generate_args.py --n 512 --num_signatures 1 > packages/falcon/tests/data/args_512_1.json
	python packages/falcon/scripts/generate_args.py --n 1024 --num_signatures 1 > packages/falcon/tests/data/args_1024_1.json

falcon-build:
	scarb --profile release build --package falcon

falcon-prove:
	stwo_run_and_prove \
		--program resources/simple_bootloader_compiled.json \
		--program_input packages/falcon/proving_task.json \
		--prover_params_json prover_params.json \
		--proofs_dir $(TARGET_DIR) \
		--proof-format cairo-serde \
		--verify

falcon-burn:
	scarb burn --package falcon \
		--arguments-file packages/falcon/tests/data/args_512_1.json \
		--output-file target/falcon.svg \
		--open-in-browser

regenerate-ntt:
	python3 -m cairo_gen.circuits.regenerate ntt --n 512

regenerate-intt:
	python3 -m cairo_gen.circuits.regenerate intt --n 512

regenerate-all:
	python3 -m cairo_gen.circuits.regenerate all --n 512
