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

FALCON_RS_DIR = ../falcon-rs
WASM_OUT_DIR = apps/demo/public/wasm

wasm-build:
	cd $(FALCON_RS_DIR) && wasm-pack build --target web --features wasm --no-default-features
	cp $(FALCON_RS_DIR)/pkg/falcon_rs_bg.wasm $(WASM_OUT_DIR)/falcon_rs_bg.wasm
	cp $(FALCON_RS_DIR)/pkg/falcon_rs.js $(WASM_OUT_DIR)/falcon_rs.js
	cp $(FALCON_RS_DIR)/pkg/falcon_rs.d.ts $(WASM_OUT_DIR)/falcon_rs.d.ts
	cp $(FALCON_RS_DIR)/pkg/falcon_rs_bg.wasm.d.ts $(WASM_OUT_DIR)/falcon_rs_bg.wasm.d.ts
	@echo "WASM built and copied to $(WASM_OUT_DIR)"
	@ls -lh $(WASM_OUT_DIR)/falcon_rs_bg.wasm

DEMO_PORT = 3737

demo-serve:
	@if lsof -ti :$(DEMO_PORT) >/dev/null 2>&1; then \
		echo "Port $(DEMO_PORT) already in use"; exit 1; \
	fi
	cd apps/demo && npx next dev --turbopack -H 0.0.0.0 -p $(DEMO_PORT)

demo-stop:
	@lsof -ti :$(DEMO_PORT) | xargs -r kill && echo "Demo stopped" || echo "Nothing on port $(DEMO_PORT)"

# --- E2E & Deployment ---

build-account:
	scarb build --package falcon_account

e2e-devnet:
	./bin/e2e-devnet.sh

declare-devnet: build-account
	./bin/declare.sh devnet

declare-sepolia: build-account
	./bin/declare.sh sepolia

deploy: wasm-build
	cd apps/demo && vercel --prod
