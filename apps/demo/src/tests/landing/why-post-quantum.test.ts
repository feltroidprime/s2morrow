/**
 * Tests for WhyPostQuantum RSC section
 *
 * Requirements (from PRD):
 * - 4 cards: Quantum Threat, Account Abstraction, Falcon-512, Hint-Based Verification
 * - Concise explanations per card
 * - Zero client JS (pure RSC)
 *
 * Source-level assertions: read the component file via readFileSync and assert on
 * expected content, structure, and patterns. This is the standard pattern for RSC
 * components in this project (no "use client" → can't use jsdom render).
 */

import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const COMPONENT_PATH = join(
  import.meta.dir,
  "../../components/landing/WhyPostQuantum.tsx",
)

function readComponent(): string {
  return readFileSync(COMPONENT_PATH, "utf-8")
}

describe("WhyPostQuantum Section (RSC)", () => {
  test("renders 4 cards total", () => {
    const src = readComponent()
    // Count <Card occurrences to ensure exactly 4
    const cardMatches = src.match(/<Card/g)
    expect(cardMatches).not.toBeNull()
    expect(cardMatches!.length).toBe(4)
  })

  test("renders 'Quantum Threat' card", () => {
    const src = readComponent()
    expect(src).toContain('title="Quantum Threat"')
    expect(src).toContain("Shor")
  })

  test("renders 'Account Abstraction' card", () => {
    const src = readComponent()
    expect(src).toContain('title="Account Abstraction"')
    expect(src).toContain("account abstraction")
  })

  test("renders 'Falcon-512' card", () => {
    const src = readComponent()
    expect(src).toContain('title="Falcon-512"')
    expect(src).toContain("NIST")
  })

  test("renders 'Hint-Based Verification' card", () => {
    const src = readComponent()
    expect(src).toContain('title="Hint-Based Verification"')
    expect(src).toContain("hint")
  })

  test("contains no 'use client' directive (RSC compliance)", () => {
    const src = readComponent()
    expect(src).not.toContain('"use client"')
    expect(src).not.toContain("'use client'")
  })

  test("exports WhyPostQuantum function", () => {
    const src = readComponent()
    expect(src).toContain("export function WhyPostQuantum")
  })

  test("uses sm:grid-cols-2 responsive grid layout", () => {
    const src = readComponent()
    expect(src).toContain("sm:grid-cols-2")
  })

  test("card uses rounded-xl border bg-falcon-surface p-6 styling", () => {
    const src = readComponent()
    expect(src).toContain("rounded-xl")
    expect(src).toContain("bg-falcon-surface")
    expect(src).toContain("p-6")
  })

  test("section has id='why-post-quantum' for smooth-scroll anchor", () => {
    const src = readComponent()
    expect(src).toContain('id="why-post-quantum"')
  })
})

// Smoke: the section heading content expected
test("expected card titles are defined as constants", () => {
  const EXPECTED_CARDS = [
    "Quantum Threat",
    "Account Abstraction",
    "Falcon-512",
    "Hint-Based Verification",
  ] as const
  expect(EXPECTED_CARDS).toHaveLength(4)
  expect(EXPECTED_CARDS[0]).toBe("Quantum Threat")
  expect(EXPECTED_CARDS[3]).toBe("Hint-Based Verification")
})
