import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Home from "../../app/page"

function renderHomePage(): string {
  return renderToStaticMarkup(React.createElement(Home))
}

describe("Home Footer integration", () => {
  test("renders footer content with GitHub and Starknet Docs labels", () => {
    const html = renderHomePage()
    expect(html).toContain("<footer")
    expect(html).toContain(">GitHub<")
    expect(html).toContain(">Starknet Docs<")
  })

  test("renders required external footer URLs", () => {
    const html = renderHomePage()
    expect(html).toContain('href="https://github.com/feltroidprime/s2morrow"')
    expect(html).toContain('href="https://docs.starknet.io"')
  })

  test("preserves secure external-link attributes on both anchors", () => {
    const html = renderHomePage()
    expect(html.match(/target="_blank"/g)?.length).toBe(2)
    expect(html.match(/rel="noopener noreferrer"/g)?.length).toBe(2)
  })
})
