#!/usr/bin/env bash
set -euo pipefail

# Declare FalconAccount on a Starknet network
# Usage: ./bin/declare.sh devnet|sepolia|mainnet [--account <name>]

NETWORK="${1:?Usage: ./bin/declare.sh devnet|sepolia|mainnet}"
shift

case "$NETWORK" in
  devnet|sepolia|mainnet) ;;
  *) echo "ERROR: Unknown network '$NETWORK'. Use: devnet, sepolia, or mainnet"; exit 1 ;;
esac

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

echo "Declaring FalconAccount on $NETWORK..."

OUTPUT=$(sncast --profile "$NETWORK" declare \
  --contract-name FalconAccount \
  --fee-token strk \
  "$@" 2>&1) || true

echo "$OUTPUT"

# Extract class_hash from sncast output
CLASS_HASH=$(echo "$OUTPUT" | grep -oP 'class_hash: \K0x[0-9a-fA-F]+' || true)

if [[ -z "$CLASS_HASH" ]]; then
  # Already declared — extract from "is already declared" message
  CLASS_HASH=$(echo "$OUTPUT" | grep -oP '0x[0-9a-fA-F]{50,}' | head -1 || true)
fi

if [[ -n "$CLASS_HASH" ]]; then
  echo ""
  echo "Class hash: $CLASS_HASH"

  # Auto-patch networks.ts
  NETWORKS_FILE="apps/demo/src/config/networks.ts"
  if [[ -f "$NETWORKS_FILE" ]]; then
    # Find the network block and replace its classHash
    # Uses perl for multi-line matching
    perl -i -0pe "
      s/(id: \"$NETWORK\".*?classHash: \")0x0(\")/$1${CLASS_HASH}$2/s
    " "$NETWORKS_FILE"
    echo "Updated $NETWORKS_FILE with classHash for $NETWORK"
  fi
else
  echo ""
  echo "Could not extract class_hash. Update networks.ts manually."
fi
