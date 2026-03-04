#!/usr/bin/env node
/**
 * Deploy a Falcon-512 account on Starknet and send a test transfer.
 *
 * Environment variables:
 *   CLASS_HASH        — declared FalconAccount class hash (required)
 *   FALCON_WASM_PATH  — path to Node.js WASM package (default: bin/.wasm-nodejs)
 *   RPC_URL           — JSON-RPC endpoint (default: http://localhost:5050/rpc)
 *   SALT              — deploy salt (default: 0x1, deterministic address)
 */

import { createRequire } from "module"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"
import {
  RpcProvider, Account, hash, CallData, SignerInterface,
  transaction, EDAMode,
} from "../apps/demo/node_modules/starknet/dist/index.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- Config ---
const CLASS_HASH = process.env.CLASS_HASH
if (!CLASS_HASH) {
  console.error("ERROR: CLASS_HASH env var is required")
  process.exit(1)
}
const RPC_URL = process.env.RPC_URL || "http://localhost:5050/rpc"
const SALT = process.env.SALT || "0x1"
const WASM_PATH = resolve(process.env.FALCON_WASM_PATH || `${__dirname}/.wasm-nodejs`)

const isDevnet = /localhost|127\.0\.0\.1/.test(RPC_URL)

const require = createRequire(import.meta.url)
const falcon = require(resolve(WASM_PATH, "falcon_rs.js"))

const provider = new RpcProvider({ nodeUrl: RPC_URL })

// --- Helpers ---

/** Deserialize 896-byte VK into 512 time-domain Int32Array coefficients */
function parsePublicKey(vkBytes) {
  const Q = 12289, N = 512, BITS = 14
  const coeffs = new Int32Array(N)
  const mask = (1 << BITS) - 1
  let bitBuffer = 0, bitsInBuffer = 0, byteIndex = 0
  for (let i = 0; i < N; i++) {
    while (bitsInBuffer < BITS) {
      bitBuffer |= vkBytes[byteIndex++] << bitsInBuffer
      bitsInBuffer += 8
    }
    const coeff = bitBuffer & mask
    bitBuffer >>= BITS
    bitsInBuffer -= BITS
    if (coeff >= Q) throw new Error(`Invalid VK coeff ${coeff} at ${i}`)
    coeffs[i] = coeff
  }
  return coeffs
}

/** Convert Int32Array to Uint16Array for pack_public_key_wasm */
function toUint16(arr) {
  const u16 = new Uint16Array(arr.length)
  for (let i = 0; i < arr.length; i++) u16[i] = arr[i]
  return u16
}

/** Fund an address via devnet JSON-RPC mint */
async function mintFunds(address, amount, unit) {
  const baseUrl = RPC_URL.replace(/\/rpc.*$/, "")
  const resp = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "devnet_mint",
      params: { address, amount, unit },
    }),
  })
  if (!resp.ok) throw new Error(`Mint failed: ${resp.status} ${await resp.text()}`)
  const json = await resp.json()
  if (json.error) throw new Error(`Mint error: ${JSON.stringify(json.error)}`)
  return json.result
}

/**
 * Build resource bounds with known gas amounts + live network prices.
 * Falcon-512 verification is ~50M L2 gas steps — too heavy for auto-estimation
 * to get right, so we hardcode the amounts but fetch prices from the network.
 */
async function getResourceBounds() {
  const block = await provider.getBlock("latest")
  const priceMultiplier = 2n // safety margin for price fluctuations
  const l1Price = BigInt(block.l1_gas_price.price_in_fri) * priceMultiplier
  const l2Price = BigInt(block.l2_gas_price.price_in_fri) * priceMultiplier
  const l1DataPrice = BigInt(block.l1_data_gas_price.price_in_fri) * priceMultiplier
  return {
    l2_gas: { max_amount: 0x2FAF080n, max_price_per_unit: l2Price },
    l1_gas: { max_amount: 0x0n, max_price_per_unit: l1Price },
    l1_data_gas: { max_amount: 0x3000n, max_price_per_unit: l1DataPrice },
  }
}

/** Get STRK balance of an address */
async function getBalance(address) {
  const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
  const result = await provider.callContract({
    contractAddress: STRK,
    entrypoint: "balanceOf",
    calldata: [address],
  })
  return BigInt(result[0])
}

// --- Falcon Signer ---

class FalconSigner extends SignerInterface {
  constructor(sk, pkNtt) {
    super()
    this.sk = sk
    this.pkNtt = pkNtt
  }

  async getPubKey() { return "0x0" }
  async signMessage() { throw new Error("signMessage not implemented") }
  async signDeclareTransaction() { throw new Error("signDeclareTransaction not implemented") }

  async signTransaction(transactions, details) {
    const compiledCalldata = transaction.getExecuteCalldata(transactions, details.cairoVersion)
    const txHash = hash.calculateInvokeTransactionHash({
      ...details,
      senderAddress: details.walletAddress,
      compiledCalldata,
      version: details.version,
      nonceDataAvailabilityMode: details.nonceDataAvailabilityMode === "L1" ? EDAMode.L1 : EDAMode.L2,
      feeDataAvailabilityMode: details.feeDataAvailabilityMode === "L1" ? EDAMode.L1 : EDAMode.L2,
    })
    return this._sign(txHash)
  }

  async signDeployAccountTransaction(details) {
    const compiledConstructorCalldata = CallData.compile(details.constructorCalldata)
    const txHash = hash.calculateDeployAccountTransactionHash({
      ...details,
      salt: details.addressSalt,
      compiledConstructorCalldata,
      version: details.version,
      nonceDataAvailabilityMode: details.nonceDataAvailabilityMode === "L1" ? EDAMode.L1 : EDAMode.L2,
      feeDataAvailabilityMode: details.feeDataAvailabilityMode === "L1" ? EDAMode.L1 : EDAMode.L2,
    })
    return this._sign(txHash)
  }

  _sign(txHash) {
    console.log(`  Signing ${txHash.slice(0, 18)}...`)
    return falcon.sign_for_starknet(this.sk, txHash, this.pkNtt)
  }
}

// --- Main ---

async function main() {
  console.log("=== Falcon-512 E2E Deploy ===\n")
  console.log(`  RPC:        ${RPC_URL}`)
  console.log(`  ClassHash:  ${CLASS_HASH}`)
  console.log(`  WASM:       ${WASM_PATH}\n`)

  // 1. Keygen
  console.log("1. Generating keypair...")
  const seed = new Uint8Array(32)
  for (let i = 0; i < 32; i++) seed[i] = i + 1
  const { sk, vk } = falcon.keygen(seed)
  console.log(`   SK: ${sk.length} bytes, VK: ${vk.length} bytes`)

  // 2. NTT + pack public key
  console.log("2. NTT-transforming and packing public key...")
  const pkTime = parsePublicKey(vk)
  const pkNtt = new Int32Array(falcon.ntt_public_key(pkTime))
  const packedSlots = falcon.pack_public_key_wasm(toUint16(pkNtt))
  console.log(`   ${packedSlots.length} packed felt252 slots`)

  // 3. Compute address
  console.log("3. Computing deploy address...")
  const constructorCalldata = [...packedSlots]
  const address = hash.calculateContractAddressFromHash(SALT, CLASS_HASH, constructorCalldata, 0)
  console.log(`   Salt:    ${SALT}`)
  console.log(`   Address: ${address}`)

  // 4. Fund
  const balance = await getBalance(address)
  console.log(`4. Balance: ${Number(balance) / 1e18} STRK`)
  if (isDevnet) {
    if (balance === 0n) {
      console.log("   Minting STRK on devnet...")
      await mintFunds(address, 10000000000000000000, "FRI")
      const newBalance = await getBalance(address)
      console.log(`   Balance: ${Number(newBalance) / 1e18} STRK`)
    } else {
      console.log("   Already funded, skipping mint")
    }
  } else if (balance === 0n) {
    console.error("   ERROR: Account has no STRK. Fund it before deploying:")
    console.error(`   Address: ${address}`)
    process.exit(1)
  }

  // 5. Deploy
  const signer = new FalconSigner(sk, pkNtt)
  const account = new Account({ provider, address, signer })

  let alreadyDeployed = false
  try {
    const onChainClassHash = await provider.getClassHashAt(address)
    if (onChainClassHash) {
      alreadyDeployed = true
      console.log(`5. Account already deployed (class: ${onChainClassHash.slice(0, 18)}...)`)
    }
  } catch {
    // Not deployed yet
  }

  const resourceBounds = await getResourceBounds()
  console.log(`   L2 price: ${resourceBounds.l2_gas.max_price_per_unit}`)

  if (!alreadyDeployed) {
    console.log("5. Deploying account...")
    const deployResult = await account.deployAccount(
      {
        classHash: CLASS_HASH,
        constructorCalldata,
        addressSalt: SALT,
        contractAddress: address,
      },
      { resourceBounds },
    )
    console.log(`   Deploy tx: ${deployResult.transaction_hash}`)
    await provider.waitForTransaction(deployResult.transaction_hash)
    console.log("   Confirmed!")
  }

  // 6. Transfer
  console.log("6. Sending STRK transfer...")
  const STRK_TOKEN = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
  const recipient = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
  const transferAmount = 1000000000000000n

  const txResult = await account.execute(
    [{
      contractAddress: STRK_TOKEN,
      entrypoint: "transfer",
      calldata: CallData.compile({ recipient, amount: { low: transferAmount, high: 0n } }),
    }],
    { resourceBounds },
  )
  console.log(`   Transfer tx: ${txResult.transaction_hash}`)
  await provider.waitForTransaction(txResult.transaction_hash)

  const balanceAfter = await getBalance(address)
  console.log(`   Balance after: ${Number(balanceAfter) / 1e18} STRK`)

  console.log("\n=== E2E PASSED ===")
}

main().catch((e) => {
  console.error("\nFATAL:", e.message || e)
  process.exit(1)
})
