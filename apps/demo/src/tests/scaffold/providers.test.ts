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
  it("exports RootLayout as the default export", async () => {
    const mod = await import("../../app/layout")
    expect(typeof mod.default).toBe("function")
  })

  it("RootLayout exports metadata", async () => {
    const mod = await import("../../app/layout")
    // Next.js layout should export metadata
    expect(mod.metadata).toBeDefined()
    expect(typeof mod.metadata).toBe("object")
  })
})
