/**
 * Tests for package.json scaffold requirements.
 *
 * Requirements (VP-001):
 * - package.json has required scripts: dev, build, start, typecheck
 * - package.json includes all required runtime dependencies:
 *   next, react, react-dom, effect, @effect-atom/atom, @effect-atom/atom-react,
 *   tailwindcss, @tailwindcss/postcss, starknet
 *
 * These are regression-guard tests — they pass on a correct scaffold and fail
 * if someone removes required entries.
 */

import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const DEMO_ROOT = join(import.meta.dir, "../../../")
const pkgRaw = readFileSync(join(DEMO_ROOT, "package.json"), "utf-8")
const pkg = JSON.parse(pkgRaw) as unknown

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!isObjectRecord(value)) {
    return {}
  }

  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      result[key] = entry
    }
  }
  return result
}

function getProperty(source: unknown, key: string): unknown {
  if (!isObjectRecord(source)) {
    return undefined
  }
  return source[key]
}

/**
 * Merge dependencies and devDependencies into a flat record.
 * Used to check whether a package appears anywhere in pkg.json.
 */
function getDependencies(p: unknown): Record<string, string> {
  return {
    ...toStringRecord(getProperty(p, "dependencies")),
    ...toStringRecord(getProperty(p, "devDependencies")),
  }
}

// ─── Required scripts ─────────────────────────────────────────────────────

describe("package.json — required scripts", () => {
  const scripts = toStringRecord(getProperty(pkg, "scripts"))

  test("has dev script", () => {
    expect(scripts["dev"]).toBeTruthy()
  })

  test("has build script", () => {
    expect(scripts["build"]).toBeTruthy()
  })

  test("has start script", () => {
    expect(scripts["start"]).toBeTruthy()
  })

  test("has typecheck script", () => {
    expect(scripts["typecheck"]).toBeTruthy()
  })
})

// ─── Required runtime dependencies ────────────────────────────────────────

describe("package.json — required runtime dependencies", () => {
  const deps = getDependencies(pkg)

  const REQUIRED_DEPS = [
    "next",
    "react",
    "react-dom",
    "effect",
    "@effect-atom/atom",
    "@effect-atom/atom-react",
    "tailwindcss",
    "@tailwindcss/postcss",
    "starknet",
  ] as const

  for (const dep of REQUIRED_DEPS) {
    test(`'${dep}' is in dependencies`, () => {
      expect(deps[dep]).toBeTruthy()
    })
  }
})
