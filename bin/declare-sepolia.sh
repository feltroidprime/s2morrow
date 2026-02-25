#!/usr/bin/env bash
set -euo pipefail

# Declare FalconAccount on Starknet Sepolia
# Prerequisites:
#   1. sncast.toml configured with Sepolia RPC (see repo root)
#   2. A funded deployer account (see README or Task 2 instructions)
#
# Usage:
#   ./bin/declare-sepolia.sh
#   ./bin/declare-sepolia.sh --account my-other-deployer

SIERRA_PATH="target/dev/falcon_account_FalconAccount.contract_class.json"
CASM_PATH="target/dev/falcon_account_FalconAccount.compiled_contract_class.json"

if [[ ! -f "$SIERRA_PATH" ]]; then
  echo "ERROR: Sierra artifact not found at $SIERRA_PATH"
  echo "Run: scarb build --package falcon_account"
  exit 1
fi

if [[ ! -f "$CASM_PATH" ]]; then
  echo "ERROR: CASM artifact not found at $CASM_PATH"
  echo "Ensure casm = true in packages/falcon_account/Scarb.toml and rebuild"
  exit 1
fi

echo "Declaring FalconAccount on Sepolia..."

# sncast reads URL from sncast.toml [default] section
# If class already declared, sncast reports it — use the existing class hash
sncast declare \
  --contract-name FalconAccount \
  --fee-token strk \
  "$@"

echo ""
echo "Save the class_hash from above and update:"
echo "  apps/demo/src/services/StarknetService.ts  (FALCON_ACCOUNT_CLASS_HASH)"
