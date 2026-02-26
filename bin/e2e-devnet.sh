#!/usr/bin/env bash
set -euo pipefail

# End-to-end Falcon account test on devnet.
# Idempotent — safe to run repeatedly.
#
# Usage: ./bin/e2e-devnet.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FALCON_RS_DIR="$ROOT_DIR/../falcon-rs"
WASM_OUT="$SCRIPT_DIR/.wasm-nodejs"
RPC_URL="http://localhost:5050/rpc"

cd "$ROOT_DIR"

# ── 1. Check devnet ──────────────────────────────────────────────────
STARTED_DEVNET=false

if curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
   -d '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId"}' >/dev/null 2>&1; then
  echo "Devnet already running on :5050"
else
  echo "Starting devnet..."
  starknet-devnet --seed 0 --port 5050 &
  DEVNET_PID=$!
  STARTED_DEVNET=true

  # Wait for devnet to be ready
  for i in $(seq 1 30); do
    if curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
       -d '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId"}' >/dev/null 2>&1; then
      echo "Devnet ready (PID $DEVNET_PID)"
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "ERROR: Devnet failed to start after 30s"
      exit 1
    fi
    sleep 1
  done
fi

cleanup() {
  if [ "$STARTED_DEVNET" = true ] && [ -n "${DEVNET_PID:-}" ]; then
    echo "Stopping devnet (PID $DEVNET_PID)..."
    kill "$DEVNET_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── 2. Build Node.js WASM ────────────────────────────────────────────
if [ ! -f "$WASM_OUT/falcon_rs.js" ]; then
  echo ""
  echo "Building Node.js WASM to $WASM_OUT..."
  mkdir -p "$WASM_OUT"
  (cd "$FALCON_RS_DIR" && wasm-pack build --target nodejs --features wasm --no-default-features)
  cp "$FALCON_RS_DIR/pkg/falcon_rs.js" "$WASM_OUT/"
  cp "$FALCON_RS_DIR/pkg/falcon_rs_bg.wasm" "$WASM_OUT/"
  cp "$FALCON_RS_DIR/pkg/falcon_rs_bg.wasm.d.ts" "$WASM_OUT/" 2>/dev/null || true
  echo "WASM built"
else
  echo "Node.js WASM cached at $WASM_OUT"
fi

# ── 3. Build Cairo contracts ─────────────────────────────────────────
echo ""
echo "Building Cairo contracts..."
scarb build --package falcon_account

# ── 4. Declare class ─────────────────────────────────────────────────
echo ""
echo "Declaring FalconAccount..."
DECLARE_OUTPUT=$("$SCRIPT_DIR/declare.sh" devnet 2>&1) || true
echo "$DECLARE_OUTPUT"

# Extract class hash
CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP 'Class hash: \K0x[0-9a-fA-F]+' || true)
if [ -z "$CLASS_HASH" ]; then
  CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP '0x[0-9a-fA-F]{50,}' | head -1 || true)
fi
if [ -z "$CLASS_HASH" ]; then
  echo "ERROR: Could not extract class hash"
  exit 1
fi
echo "Using class hash: $CLASS_HASH"

# ── 5. Run E2E deploy + transfer ─────────────────────────────────────
echo ""
echo "Running E2E deploy..."
CLASS_HASH="$CLASS_HASH" \
  FALCON_WASM_PATH="$WASM_OUT" \
  RPC_URL="$RPC_URL" \
  node "$SCRIPT_DIR/e2e-deploy.mjs"

echo ""
echo "=== ALL PASSED ==="
