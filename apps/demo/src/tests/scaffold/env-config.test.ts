/**
 * Tests for scaffold environment configuration.
 *
 * Requirements (VP-001):
 * - apps/demo/.env.local exists
 * - Contains NEXT_PUBLIC_STARKNET_RPC_URL
 * - Does NOT contain private key or secret key style variables
 *
 * These tests fail until .env.local is created (RED phase).
 */

import { describe, test, expect } from "bun:test"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

const DEMO_ROOT = join(import.meta.dir, "../../../")
const ENV_LOCAL_PATH = join(DEMO_ROOT, ".env.local")

/**
 * Parse a .env file content into key-value pairs.
 * Ignores blank lines and comments.
 */
function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return result
}

describe(".env.local — scaffold environment file", () => {
  test(".env.local exists in apps/demo/", () => {
    // RED: fails until .env.local is created
    expect(existsSync(ENV_LOCAL_PATH)).toBe(true)
  })

  test("contains NEXT_PUBLIC_STARKNET_RPC_URL with a non-empty value", () => {
    // Requires .env.local to exist — skip gracefully if not (first test covers it)
    if (!existsSync(ENV_LOCAL_PATH)) {
      // Let first test report the real failure
      expect(existsSync(ENV_LOCAL_PATH)).toBe(true)
      return
    }
    const content = readFileSync(ENV_LOCAL_PATH, "utf-8")
    const env = parseEnv(content)
    expect(env["NEXT_PUBLIC_STARKNET_RPC_URL"]).toBeTruthy()
  })

  test("does not contain private key or secret key style variables", () => {
    // VP-001 guardrail: no signing secrets in scaffold env
    if (!existsSync(ENV_LOCAL_PATH)) {
      expect(existsSync(ENV_LOCAL_PATH)).toBe(true)
      return
    }
    const content = readFileSync(ENV_LOCAL_PATH, "utf-8")
    const env = parseEnv(content)

    const FORBIDDEN_PATTERNS = [
      /PRIVATE_KEY/i,
      /SECRET_KEY/i,
      /SIGNING_KEY/i,
      /WALLET_KEY/i,
      /MNEMONIC/i,
    ]

    for (const key of Object.keys(env)) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(key).not.toMatch(pattern)
      }
    }
  })
})
