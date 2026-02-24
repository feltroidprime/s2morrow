/**
 * Integration tests for page.tsx dynamic loading contract.
 *
 * These tests verify that:
 * 1. PlaygroundSection.tsx (the dynamic loader wrapper) exists and has correct
 *    next/dynamic config: ssr: false + skeleton loading fallback.
 * 2. page.tsx uses PlaygroundSection as its interactive section mount point.
 * 3. VerificationPlayground.tsx is a client component with 'use client'.
 *
 * These tests are mostly GREEN once PlaygroundSection exists and VerificationPlayground
 * has the 'use client' directive.
 */

import { describe, it, expect } from "bun:test"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

const DEMO_ROOT = path.join(import.meta.dir, "../../../")

describe("PlaygroundSection — dynamic loading wrapper", () => {
  it("PlaygroundSection.tsx exists", () => {
    const p = path.join(DEMO_ROOT, "src/components/interactive/PlaygroundSection.tsx")
    expect(existsSync(p)).toBe(true)
  })

  it("uses next/dynamic import", () => {
    const source = readFileSync(
      path.join(DEMO_ROOT, "src/components/interactive/PlaygroundSection.tsx"),
      "utf-8",
    )
    expect(source).toContain("next/dynamic")
    expect(source).toContain("dynamic")
  })

  it("enforces ssr: false", () => {
    const source = readFileSync(
      path.join(DEMO_ROOT, "src/components/interactive/PlaygroundSection.tsx"),
      "utf-8",
    )
    expect(source).toContain("ssr: false")
  })

  it("has skeleton loading fallback with animate-pulse", () => {
    const source = readFileSync(
      path.join(DEMO_ROOT, "src/components/interactive/PlaygroundSection.tsx"),
      "utf-8",
    )
    expect(source).toContain("animate-pulse")
    expect(source).toContain("loading:")
  })

  it("is itself a 'use client' component", () => {
    const source = readFileSync(
      path.join(DEMO_ROOT, "src/components/interactive/PlaygroundSection.tsx"),
      "utf-8",
    )
    expect(source).toContain('"use client"')
  })
})

describe("page.tsx — uses PlaygroundSection as verify section", () => {
  it("imports PlaygroundSection", () => {
    const source = readFileSync(
      path.join(DEMO_ROOT, "src/app/page.tsx"),
      "utf-8",
    )
    expect(source).toContain("PlaygroundSection")
  })

  it("renders PlaygroundSection in JSX", () => {
    const source = readFileSync(
      path.join(DEMO_ROOT, "src/app/page.tsx"),
      "utf-8",
    )
    expect(source).toContain("<PlaygroundSection")
  })

  it("does not import VerificationPlayground directly (uses dynamic wrapper)", () => {
    const source = readFileSync(
      path.join(DEMO_ROOT, "src/app/page.tsx"),
      "utf-8",
    )
    // page.tsx must go through PlaygroundSection, not directly import VP
    expect(source).not.toContain("VerificationPlayground")
  })
})

describe("VerificationPlayground.tsx — client component contract", () => {
  it("VerificationPlayground.tsx exists", () => {
    const p = path.join(
      DEMO_ROOT,
      "src/components/interactive/VerificationPlayground.tsx",
    )
    expect(existsSync(p)).toBe(true)
  })

  it("has 'use client' directive", () => {
    const source = readFileSync(
      path.join(DEMO_ROOT, "src/components/interactive/VerificationPlayground.tsx"),
      "utf-8",
    )
    expect(source).toContain('"use client"')
  })

  it("is loaded through PlaygroundSection's dynamic() call", () => {
    const source = readFileSync(
      path.join(DEMO_ROOT, "src/components/interactive/PlaygroundSection.tsx"),
      "utf-8",
    )
    expect(source).toContain("VerificationPlayground")
  })
})
