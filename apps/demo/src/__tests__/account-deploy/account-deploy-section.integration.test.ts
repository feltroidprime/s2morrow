import { describe, expect, it } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const DEMO_ROOT = path.join(import.meta.dir, "../../../")
const SECTION_PATH = path.join(
  DEMO_ROOT,
  "src/components/interactive/AccountDeploySection.tsx",
)
const FLOW_PATH = path.join(
  DEMO_ROOT,
  "src/components/interactive/AccountDeployFlow.tsx",
)
const PAGE_PATH = path.join(DEMO_ROOT, "src/app/page.tsx")

describe("AccountDeploySection dynamic wrapper", () => {
  it("exists", () => {
    expect(existsSync(SECTION_PATH)).toBe(true)
  })

  it("uses next/dynamic with ssr disabled", () => {
    const source = readFileSync(SECTION_PATH, "utf-8")
    expect(source).toContain("next/dynamic")
    expect(source).toContain("dynamic")
    expect(source).toContain("ssr: false")
  })

  it("provides a skeleton loading fallback", () => {
    const source = readFileSync(SECTION_PATH, "utf-8")
    expect(source).toContain("loading:")
    expect(source).toContain("animate-pulse")
  })
})

describe("page wiring for account deploy section", () => {
  it("imports and renders AccountDeploySection", () => {
    const source = readFileSync(PAGE_PATH, "utf-8")
    expect(source).toContain("AccountDeploySection")
    expect(source).toContain("<AccountDeploySection")
  })

  it("does not render static Account Deploy placeholder heading", () => {
    const source = readFileSync(PAGE_PATH, "utf-8")
    expect(source).not.toContain("Account Deploy Flow")
  })

  it("does not import AccountDeployFlow directly in page.tsx", () => {
    const source = readFileSync(PAGE_PATH, "utf-8")
    expect(source).not.toContain("AccountDeployFlow")
  })
})

describe("AccountDeployFlow component contract", () => {
  it("flow component exists and is client-only", () => {
    expect(existsSync(FLOW_PATH)).toBe(true)
    const source = readFileSync(FLOW_PATH, "utf-8")
    expect(source).toContain('"use client"')
  })
})
