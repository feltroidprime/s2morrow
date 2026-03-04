import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Footer } from "../../components/landing/Footer"

function renderFooter(): string {
  return renderToStaticMarkup(React.createElement(Footer))
}

describe("Footer (RSC)", () => {
  test("renders semantic footer root with border-t separator", () => {
    const html = renderFooter()
    expect(html).toContain("<footer")
    expect(html).toContain("border-t")
  })

  test("renders GitHub link with exact URL", () => {
    const html = renderFooter()
    expect(html).toContain(">GitHub<")
    expect(html).toContain('href="https://github.com/feltroidprime/s2morrow"')
  })

  test("renders Starknet Docs link with exact URL", () => {
    const html = renderFooter()
    expect(html).toContain(">Starknet Docs<")
    expect(html).toContain('href="https://docs.starknet.io"')
  })

  test("sets target and rel security attributes on both external links", () => {
    const html = renderFooter()
    expect(html.match(/target="_blank"/g)?.length).toBe(2)
    expect(html.match(/rel="noopener noreferrer"/g)?.length).toBe(2)
  })

  test("adds descriptive aria-labels on both links", () => {
    const html = renderFooter()
    expect(html).toContain('aria-label="View source on GitHub"')
    expect(html).toContain('aria-label="Read Starknet documentation"')
  })

  test("contains no use client directive and no rendered script tags", () => {
    const source = readFileSync(new URL("../../components/landing/Footer.tsx", import.meta.url), "utf-8")
    expect(source).not.toContain('"use client"')
    expect(source).not.toContain("'use client'")

    const html = renderFooter()
    expect(html).not.toContain("<script")
  })
})
