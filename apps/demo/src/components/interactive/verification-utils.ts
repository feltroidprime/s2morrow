/**
 * Browser-safe verification utility functions.
 *
 * These utilities are designed to work in the browser without Node.js
 * built-ins like `Buffer`. All hex conversions use Uint8Array directly.
 */

import { Option } from "effect"
import type { FalconKeypair, VerificationStep } from "@/services/types"

// ─── Hex conversion ───────────────────────────────────────────────────────────

/**
 * Convert a Uint8Array to a lowercase hex string.
 *
 * Browser-safe: uses Array.from + toString(16) instead of Buffer.from.
 * This works in all modern browsers and in Node.js without any imports.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Truncate a long hex or felt252 string to `<head>...<tail>` format.
 *
 * If the string is at most `head + tail + 3` characters (including the "..."
 * separator), it is returned unchanged — truncation would not reduce length.
 *
 * @param value - The hex/felt string to truncate.
 * @param head  - Number of characters to keep at the start.
 * @param tail  - Number of characters to keep at the end.
 */
export function truncateHex(value: string, head: number, tail: number): string {
  if (value.length <= head + tail + 3) return value
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

// ─── Disabled-state derivation ────────────────────────────────────────────────

export interface VerificationDisabledState {
  /** True while any async operation (keygen / sign / verify) is in flight. */
  readonly isBusy: boolean
  /** True when the Generate Keypair button should be enabled. */
  readonly canGenerate: boolean
  /**
   * True when the Sign & Verify button should be enabled.
   *
   * Requires:
   *  - Not busy
   *  - Keypair is Some
   *  - Message is non-empty (after trimming)
   */
  readonly canSign: boolean
}

/** Steps that represent an in-flight async operation. */
const BUSY_STEPS = new Set<VerificationStep["step"]>([
  "generating-keypair",
  "signing",
  "creating-hint",
  "packing",
  "verifying",
])

/**
 * Derive button disabled states from the current atom values.
 *
 * Centralised here (not inline in the component) so it can be unit-tested
 * independently of React rendering.
 */
export function getVerificationDisabledState(args: {
  keypair: Option.Option<FalconKeypair>
  message: string
  step: VerificationStep
}): VerificationDisabledState {
  const { keypair, message, step } = args

  const isBusy = BUSY_STEPS.has(step.step)
  const canGenerate = !isBusy
  const canSign =
    !isBusy && Option.isSome(keypair) && message.trim().length > 0

  return { isBusy, canGenerate, canSign }
}
