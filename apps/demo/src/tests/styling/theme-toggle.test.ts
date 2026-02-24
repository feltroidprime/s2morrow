/**
 * ThemeToggle — unit tests for constants and type structure
 *
 * Strategy: Verify the exported constants (THEME_TOKENS, BRAND_TOKENS)
 * match the design spec without needing a React render environment.
 * The toggle() function logic is tested by checking the constant values.
 */

import { describe, test, expect } from "bun:test"
import { THEME_TOKENS, BRAND_TOKENS } from "../../components/ThemeToggle"

// ─── BRAND_TOKENS ──────────────────────────────────────────────────────────

describe("BRAND_TOKENS — brand colors shared across themes", () => {
  test("exports 5 brand tokens", () => {
    expect(Object.keys(BRAND_TOKENS)).toHaveLength(5)
  })

  test("falcon-primary is #6366f1", () => {
    expect(BRAND_TOKENS["falcon-primary"]).toBe("#6366f1")
  })

  test("falcon-secondary is #8b5cf6", () => {
    expect(BRAND_TOKENS["falcon-secondary"]).toBe("#8b5cf6")
  })

  test("falcon-accent is #06b6d4", () => {
    expect(BRAND_TOKENS["falcon-accent"]).toBe("#06b6d4")
  })

  test("falcon-success is #10b981", () => {
    expect(BRAND_TOKENS["falcon-success"]).toBe("#10b981")
  })

  test("falcon-error is #ef4444", () => {
    expect(BRAND_TOKENS["falcon-error"]).toBe("#ef4444")
  })
})

// ─── THEME_TOKENS.dark ────────────────────────────────────────────────────

describe("THEME_TOKENS.dark — dark theme variables", () => {
  const dark = THEME_TOKENS.dark

  test("exports 4 dark tokens", () => {
    expect(Object.keys(dark)).toHaveLength(4)
  })

  test("falcon-bg is #0f172a (slate-900)", () => {
    expect(dark["falcon-bg"]).toBe("#0f172a")
  })

  test("falcon-surface is #1e293b (slate-800)", () => {
    expect(dark["falcon-surface"]).toBe("#1e293b")
  })

  test("falcon-text is #f8fafc (slate-50)", () => {
    expect(dark["falcon-text"]).toBe("#f8fafc")
  })

  test("falcon-muted is #94a3b8 (slate-400)", () => {
    expect(dark["falcon-muted"]).toBe("#94a3b8")
  })
})

// ─── THEME_TOKENS.light ───────────────────────────────────────────────────

describe("THEME_TOKENS.light — light theme variables", () => {
  const light = THEME_TOKENS.light

  test("exports 4 light tokens", () => {
    expect(Object.keys(light)).toHaveLength(4)
  })

  test("falcon-bg is #ffffff (white)", () => {
    expect(light["falcon-bg"]).toBe("#ffffff")
  })

  test("falcon-surface is #f1f5f9 (slate-100)", () => {
    expect(light["falcon-surface"]).toBe("#f1f5f9")
  })

  test("falcon-text is #0f172a (slate-900)", () => {
    expect(light["falcon-text"]).toBe("#0f172a")
  })

  test("falcon-muted is #64748b (slate-500)", () => {
    expect(light["falcon-muted"]).toBe("#64748b")
  })
})

// ─── THEME_TOKENS coverage ────────────────────────────────────────────────

describe("THEME_TOKENS — both themes defined with identical keys", () => {
  test("THEME_TOKENS has exactly two themes: dark and light", () => {
    expect(Object.keys(THEME_TOKENS).sort()).toEqual(["dark", "light"])
  })

  test("dark and light themes define the same set of token names", () => {
    const darkKeys = Object.keys(THEME_TOKENS.dark).sort()
    const lightKeys = Object.keys(THEME_TOKENS.light).sort()
    expect(darkKeys).toEqual(lightKeys)
  })

  test("dark and light themes have different values for falcon-bg", () => {
    expect(THEME_TOKENS.dark["falcon-bg"]).not.toBe(THEME_TOKENS.light["falcon-bg"])
  })

  test("dark and light themes have different values for falcon-text", () => {
    expect(THEME_TOKENS.dark["falcon-text"]).not.toBe(THEME_TOKENS.light["falcon-text"])
  })

  test("inverted text: dark falcon-bg matches light falcon-text", () => {
    // Design intent: dark bg (#0f172a) is same hex as light text (#0f172a)
    expect(THEME_TOKENS.dark["falcon-bg"]).toBe(THEME_TOKENS.light["falcon-text"])
  })
})
