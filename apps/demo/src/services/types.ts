import { Schema } from "effect"

// Branded IDs
export const TxHash = Schema.String.pipe(Schema.brand("@Falcon/TxHash"))
export type TxHash = Schema.Schema.Type<typeof TxHash>

export const ContractAddress = Schema.String.pipe(Schema.brand("@Falcon/ContractAddress"))
export type ContractAddress = Schema.Schema.Type<typeof ContractAddress>

// Domain types
export interface FalconKeypair {
  readonly secretKey: Uint8Array
  readonly verifyingKey: Uint8Array
  readonly publicKeyNtt: Int32Array // h polynomial, 512 coefficients
}

export interface FalconSignatureResult {
  readonly signature: Uint8Array
  readonly salt: Uint8Array
}

export interface PackedPublicKey {
  readonly slots: ReadonlyArray<string> // 29 hex strings (felt252)
}

export type VerificationStep =
  | { step: "idle" }
  | { step: "generating-keypair" }
  | { step: "signing" }
  | { step: "creating-hint" }
  | { step: "packing" }
  | { step: "verifying"; substep: string }
  | { step: "complete"; valid: boolean; durationMs: number }
  | { step: "error"; message: string }

export interface PipelineStep {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly input: string
  readonly output: string
  readonly stepCount: number
  readonly status: "pending" | "active" | "complete"
}

export interface FalconKeyFile {
  readonly version: 1
  readonly algorithm: "falcon-512"
  readonly secretKey: string        // 0x hex
  readonly verifyingKey: string     // 0x hex
  readonly publicKeyNtt: number[]   // 512 integers in [0, 12289)
  readonly packedPublicKey: string[] // 29 hex felt252
}

export interface DevnetAccount {
  readonly address: string
  readonly private_key: string
  readonly initial_balance: string
}
