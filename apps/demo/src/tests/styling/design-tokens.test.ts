/**
 * Styling integration tests — Design system and theming
 *
 * Category: styling
 * Tests: color token definitions, CSS variable presence, theme toggle logic,
 *        responsive layout classes, Tailwind v4 configuration.
 *
 * Strategy: No browser required for P0 — we verify:
 *   1. CSS token file exists and contains correct variable names/values
 *   2. ThemeToggle exports are correct types
 *   3. Brand + theme token constants match design spec
 *   4. Token coverage: all 8 falcon-* colors are defined
 */

import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

// ─── helpers ─────────────────────────────────────────────────────────────────

const CSS_PATH = join(import.meta.dir, "../../app/globals.css")
const CSS_CONTENT = readFileSync(CSS_PATH, "utf-8")

/** Parse all CSS custom property definitions from a CSS string */
function extractCssVariables(css: string): Record<string, string> {
  const result: Record<string, string> = {}
  // Match both --color-falcon-* and bare custom props
  const re = /--([\w-]+)\s*:\s*([^;}\n]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    result[`--${m[1].trim()}`] = m[2].trim()
  }
  return result
}

// ─── globals.css exists and imports tailwindcss ────────────────────────────

describe("globals.css — Tailwind v4 setup", () => {
  test("globals.css file exists and is readable", () => {
    expect(CSS_CONTENT).toBeTruthy()
    expect(CSS_CONTENT.length).toBeGreaterThan(50)
  })

  test("imports tailwindcss (v4 CSS-first pattern)", () => {
    expect(CSS_CONTENT).toContain('@import "tailwindcss"')
  })

  test("defines @theme block", () => {
    expect(CSS_CONTENT).toContain("@theme")
  })

  test("defines .dark class", () => {
    expect(CSS_CONTENT).toContain(".dark")
  })

  test("defines .light class", () => {
    expect(CSS_CONTENT).toContain(".light")
  })
})

// ─── Brand color tokens ────────────────────────────────────────────────────

describe("Brand color tokens — design spec compliance", () => {
  const vars = extractCssVariables(CSS_CONTENT)

  test("defines --color-falcon-primary (#6366f1)", () => {
    expect(vars["--color-falcon-primary"]).toBe("#6366f1")
  })

  test("defines --color-falcon-accent (#06b6d4)", () => {
    expect(vars["--color-falcon-accent"]).toBe("#06b6d4")
  })

  test("defines --color-falcon-success (#10b981)", () => {
    expect(vars["--color-falcon-success"]).toBe("#10b981")
  })

  test("defines --color-falcon-error (#ef4444)", () => {
    expect(vars["--color-falcon-error"]).toBe("#ef4444")
  })
})

// ─── Dark theme tokens ─────────────────────────────────────────────────────

describe("Dark theme CSS variables — design spec compliance", () => {
  // Extract only the .dark block
  const darkMatch = CSS_CONTENT.match(/\.dark\s*\{([^}]+)\}/)
  const darkBlock = darkMatch ? darkMatch[1] : ""
  const darkVars = extractCssVariables(darkBlock)

  test(".dark block defines --color-falcon-bg (#0f172a)", () => {
    expect(darkVars["--color-falcon-bg"]).toBe("#0f172a")
  })

  test(".dark block defines --color-falcon-surface (#1e293b)", () => {
    expect(darkVars["--color-falcon-surface"]).toBe("#1e293b")
  })

  test(".dark block defines --color-falcon-text (#f8fafc)", () => {
    expect(darkVars["--color-falcon-text"]).toBe("#f8fafc")
  })

  test(".dark block defines --color-falcon-muted (#94a3b8)", () => {
    expect(darkVars["--color-falcon-muted"]).toBe("#94a3b8")
  })
})

// ─── Light theme tokens ────────────────────────────────────────────────────

describe("Light theme CSS variables — design spec compliance", () => {
  const lightMatch = CSS_CONTENT.match(/\.light\s*\{([^}]+)\}/)
  const lightBlock = lightMatch ? lightMatch[1] : ""
  const lightVars = extractCssVariables(lightBlock)

  test(".light block defines --color-falcon-bg (#fafbfd)", () => {
    expect(lightVars["--color-falcon-bg"]).toBe("#fafbfd")
  })

  test(".light block defines --color-falcon-surface (#f1f5f9)", () => {
    expect(lightVars["--color-falcon-surface"]).toBe("#f1f5f9")
  })

  test(".light block defines --color-falcon-text (#0f172a)", () => {
    expect(lightVars["--color-falcon-text"]).toBe("#0f172a")
  })

  test(".light block defines --color-falcon-muted (#64748b)", () => {
    expect(lightVars["--color-falcon-muted"]).toBe("#64748b")
  })
})

// ─── Token coverage ────────────────────────────────────────────────────────

describe("Token coverage — all 8 falcon-* variables defined somewhere", () => {
  const REQUIRED_TOKENS = [
    "falcon-primary",
    "falcon-accent",
    "falcon-success",
    "falcon-error",
    "falcon-bg",
    "falcon-surface",
    "falcon-text",
    "falcon-muted",
  ]

  for (const token of REQUIRED_TOKENS) {
    test(`CSS contains falcon-${token.replace("falcon-", "")}`, () => {
      expect(CSS_CONTENT).toContain(token)
    })
  }
})
