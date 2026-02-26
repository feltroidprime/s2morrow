/* tslint:disable */
/* eslint-disable */

/**
 * Create a verification hint for Cairo on-chain verification.
 *
 * Computes `INTT(NTT(s1) * pk_ntt)` — the mul_hint that allows
 * Cairo to verify NTT products with 2 forward NTTs and 0 INTTs.
 *
 * Parameters:
 * - `s1`: 512 signature coefficients (each in [0, 12289))
 * - `pk_ntt`: 512 public key NTT coefficients (each in [0, 12289))
 *
 * Returns: Vec of 512 hint coefficients (returned as Uint16Array to JS).
 */
export function create_verification_hint(s1: Int32Array, pk_ntt: Int32Array): Uint16Array;

/**
 * Generate a new Falcon-512 keypair.
 *
 * Returns a JavaScript object with `sk` (secret key bytes) and `vk` (verifying key bytes).
 *
 * Note: Key generation is slow (~1-2 minutes) due to NTRU complexity.
 */
export function keygen(seed: Uint8Array): any;

/**
 * Transform public key from time domain to NTT domain.
 *
 * The verifying key stores `h` in time domain, but Starknet verification
 * requires NTT-domain `h_ntt` for pointwise multiplication checks.
 * Call this on the parsed VK coefficients before packing or signing.
 *
 * Parameters:
 * - `pk_time`: 512 public key coefficients in time domain (each in [0, 12289))
 *
 * Returns: 512 NTT-domain coefficients.
 */
export function ntt_public_key(pk_time: Int32Array): Int32Array;

/**
 * Pack a public key (512 Zq values) into 29 felt252 storage slots.
 *
 * Uses base-Q Horner encoding: 18 values per felt252 (9 per u128 half).
 * This achieves a 17x calldata reduction (512 → 29 slots).
 *
 * Parameters:
 * - `pk_ntt`: 512 public key NTT coefficients (each in [0, 12289))
 *
 * Returns: Array of 29 hex strings, each representing a felt252.
 */
export function pack_public_key_wasm(pk_ntt: Uint16Array): string[];

/**
 * Get the public key length in bytes.
 */
export function public_key_length(): number;

/**
 * Get the salt length in bytes.
 */
export function salt_length(): number;

/**
 * Sign a message with a secret key.
 *
 * Parameters:
 * - `sk_bytes`: The secret key bytes (serialized as 4 × 896 = 3584 bytes via `SecretKey::to_bytes`)
 * - `message`: The message to sign
 * - `salt`: A 40-byte random salt (must be exactly `SALT_LEN` bytes)
 *
 * Returns a JavaScript object with:
 * - `signature`: `Uint8Array` of 666 bytes (the full Falcon-512 signature)
 * - `salt`: `Uint8Array` of 40 bytes (echo of the provided salt)
 *
 * # Notes
 *
 * The caller is responsible for generating a cryptographically random `salt` before
 * calling this function. The same salt must not be reused for different messages.
 */
export function sign(sk_bytes: Uint8Array, message: Uint8Array, salt: Uint8Array): any;

/**
 * Sign a Starknet transaction hash using Falcon-512 with Poseidon hash-to-point.
 *
 * This produces a signature in the format expected by the Cairo FalconAccount contract,
 * matching the Serde layout of `PackedFalconSignatureWithHint`:
 * - 29 packed felt252 for s1 (signature polynomial)
 * - 1 felt252 for the salt array length
 * - 2 felt252 for the salt data
 * - 29 packed felt252 for mul_hint (verification hint)
 * Total: 61 felt252 elements.
 *
 * Parameters:
 * - `sk_bytes`: Secret key bytes (serialized SecretKey)
 * - `tx_hash`: Transaction hash as hex string (felt252)
 * - `pk_ntt`: 512 public key NTT coefficients (each in [0, 12289))
 *
 * Returns: Array of 61 hex strings, each representing a felt252.
 */
export function sign_for_starknet(sk_bytes: Uint8Array, tx_hash: string, pk_ntt: Int32Array): string[];

/**
 * Verify a signature.
 *
 * Parameters:
 * - `vk_bytes`: The verifying key (public key) bytes
 * - `message`: The signed message
 * - `signature`: The signature bytes
 *
 * Returns true if the signature is valid, false otherwise.
 */
export function verify(vk_bytes: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly create_verification_hint: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly keygen: (a: number, b: number) => [number, number, number];
    readonly ntt_public_key: (a: number, b: number) => [number, number, number, number];
    readonly pack_public_key_wasm: (a: number, b: number) => [number, number, number, number];
    readonly public_key_length: () => number;
    readonly salt_length: () => number;
    readonly sign: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly sign_for_starknet: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly verify: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
