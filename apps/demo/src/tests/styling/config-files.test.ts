/**
 * Styling infrastructure smoke tests
 *
 * Verifies that all config files required for the design system are present
 * and contain the correct configuration.
 */

import { describe, test, expect } from "bun:test"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const DEMO_ROOT = join(import.meta.dir, "../../../")

// ─── Config file existence ─────────────────────────────────────────────────

describe("Config files — presence check", () => {
  test("postcss.config.mjs exists", () => {
    expect(existsSync(join(DEMO_ROOT, "postcss.config.mjs"))).toBe(true)
  })

  test("next.config.mjs exists", () => {
    expect(existsSync(join(DEMO_ROOT, "next.config.mjs"))).toBe(true)
  })

  test("src/app/globals.css exists", () => {
    expect(existsSync(join(DEMO_ROOT, "src/app/globals.css"))).toBe(true)
  })

  test("src/app/layout.tsx exists", () => {
    expect(existsSync(join(DEMO_ROOT, "src/app/layout.tsx"))).toBe(true)
  })

  test("src/components/ThemeToggle.tsx exists", () => {
    expect(existsSync(join(DEMO_ROOT, "src/components/ThemeToggle.tsx"))).toBe(true)
  })
})

// ─── PostCSS config ────────────────────────────────────────────────────────

describe("postcss.config.mjs — Tailwind v4 plugin", () => {
  const content = readFileSync(join(DEMO_ROOT, "postcss.config.mjs"), "utf-8")

  test("uses @tailwindcss/postcss plugin", () => {
    expect(content).toContain("@tailwindcss/postcss")
  })

  test("exports default config object", () => {
    expect(content).toContain("export default")
  })
})

// ─── Next.js config ────────────────────────────────────────────────────────

describe("next.config.mjs — WASM support", () => {
  const content = readFileSync(join(DEMO_ROOT, "next.config.mjs"), "utf-8")

  test("enables asyncWebAssembly webpack experiment", () => {
    expect(content).toContain("asyncWebAssembly")
  })

  test("exports nextConfig", () => {
    expect(content).toContain("export default nextConfig")
  })
})

// ─── Layout.tsx ────────────────────────────────────────────────────────────

describe("layout.tsx — root layout", () => {
  const content = readFileSync(join(DEMO_ROOT, "src/app/layout.tsx"), "utf-8")

  test("imports globals.css", () => {
    expect(content).toContain('./globals.css"')
  })

  test("sets default dark class on <html>", () => {
    expect(content).toContain("dark")
    expect(content).toContain("<html")
  })

  test("applies bg-falcon-bg to body", () => {
    expect(content).toContain("bg-falcon-bg")
  })

  test("applies text-falcon-text to body", () => {
    expect(content).toContain("text-falcon-text")
  })

  test("exports metadata with correct title", () => {
    expect(content).toContain("Falcon-512")
  })
})

// ─── tsconfig.json — Next.js types coverage ───────────────────────────────

describe("tsconfig.json — Next.js typing coverage", () => {
  const tsconfig = JSON.parse(
    readFileSync(join(DEMO_ROOT, "tsconfig.json"), "utf-8"),
  ) as { include?: string[] }

  test("include array contains .next/types/**/*.ts for Next.js type discovery", () => {
    // Next.js 15 generates type stubs under .next/types/.
    // This pattern must be present in tsconfig.include for full type safety.
    const includes = tsconfig.include ?? []
    const hasNextTypes = includes.some((p) => p.includes(".next/types"))
    expect(hasNextTypes).toBe(true)
  })
})

// ─── Package.json — tailwindcss installed ─────────────────────────────────

describe("package.json — Tailwind v4 dependency", () => {
  const pkg = JSON.parse(readFileSync(join(DEMO_ROOT, "package.json"), "utf-8"))

  test("tailwindcss is in dependencies", () => {
    const hasTailwind =
      "tailwindcss" in (pkg.dependencies ?? {}) ||
      "tailwindcss" in (pkg.devDependencies ?? {})
    expect(hasTailwind).toBe(true)
  })

  test("@tailwindcss/postcss is in dependencies", () => {
    const hasPlugin =
      "@tailwindcss/postcss" in (pkg.dependencies ?? {}) ||
      "@tailwindcss/postcss" in (pkg.devDependencies ?? {})
    expect(hasPlugin).toBe(true)
  })

  test("tailwindcss version is v4.x", () => {
    const version: string =
      pkg.dependencies?.tailwindcss ?? pkg.devDependencies?.tailwindcss ?? ""
    // Version string starts with ^4 or 4.x
    expect(version).toMatch(/\^?4\./)
  })
})
