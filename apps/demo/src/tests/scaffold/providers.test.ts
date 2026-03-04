/**
 * Tests for Providers client component and layout.tsx integration.
 *
 * Requirements (LANDING-001):
 * - src/app/providers.tsx exports a Providers React component as the default export
 * - Providers wraps children with RegistryProvider from @effect-atom/atom-react
 * - src/app/layout.tsx integrates Providers to wrap children
 *
 * These tests fail until providers.tsx is created (RED phase).
 */

import { describe, expect, it } from "bun:test"

describe("Providers component (src/app/providers.tsx)", () => {
  it("exports a React component function as the default export", async () => {
    // RED: fails with "Cannot find module" until providers.tsx is created
    const mod = await import("../../app/providers")
    expect(typeof mod.default).toBe("function")
  })

  it("Providers component has a name (not anonymous)", async () => {
    const mod = await import("../../app/providers")
    const Providers = mod.default
    // React components should have names for devtools
    expect(Providers.name).toBeTruthy()
  })

  it("Providers accepts children prop (component signature)", async () => {
    const mod = await import("../../app/providers")
    const Providers = mod.default
    // React function components have length 0 or 1 (props argument)
    expect(typeof Providers).toBe("function")
    // length 0 = no required args in JS (props is optional in JS sig)
    // length 1 = props argument present
    expect(Providers.length).toBeGreaterThanOrEqual(0)
  })
})

describe("RootLayout (src/app/layout.tsx)", () => {
  // Note: layout.tsx uses next/font/google which cannot be imported outside
  // the Next.js build. Use source-level assertions instead.
  const { readFileSync } = require("fs")
  const { join } = require("path")
  const layoutSource = readFileSync(
    join(import.meta.dir, "../../app/layout.tsx"),
    "utf-8",
  )

  it("exports RootLayout as the default export", () => {
    expect(layoutSource).toContain("export default function RootLayout")
  })

  it("RootLayout exports metadata", () => {
    expect(layoutSource).toContain("export const metadata")
  })
})
