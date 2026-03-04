/**
 * Unit/component tests for HexDisplay.
 *
 * RED phase: these tests fail until HexDisplay.tsx is implemented.
 *
 * Coverage:
 * - Renders label and single string value
 * - Renders list values
 * - Clamps list to maxRows with "... N more" indicator
 * - Applies truncation via truncate prop
 */

import { describe, it, expect } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { HexDisplay } from "../../components/interactive/HexDisplay"

describe("HexDisplay — single string value", () => {
  it("renders the label", () => {
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, {
        label: "Public Key",
        value: "0xdeadbeef",
      }),
    )
    expect(html).toContain("Public Key")
  })

  it("renders the hex value", () => {
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, {
        label: "Public Key",
        value: "0xdeadbeef",
      }),
    )
    expect(html).toContain("0xdeadbeef")
  })

  it("renders a short felt252 value unchanged", () => {
    const felt = "0x1a2b3c4d"
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, { label: "Felt", value: felt }),
    )
    expect(html).toContain(felt)
  })
})

describe("HexDisplay — list values", () => {
  it("renders all values when no maxRows set", () => {
    const slots = ["0x0001", "0x0002", "0x0003"]
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, { label: "Slots", value: slots }),
    )
    expect(html).toContain("Slots")
    expect(html).toContain("0x0001")
    expect(html).toContain("0x0002")
    expect(html).toContain("0x0003")
  })

  it("renders only maxRows items when list exceeds limit", () => {
    const slots = Array.from({ length: 10 }, (_, i) => `0x${i.toString().padStart(4, "0")}`)
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, {
        label: "PK Slots",
        value: slots,
        maxRows: 5,
      }),
    )
    // First 5 items rendered
    expect(html).toContain("0x0000")
    expect(html).toContain("0x0004")
    // Item 6+ not rendered
    expect(html).not.toContain("0x0005")
    expect(html).not.toContain("0x0009")
  })

  it("shows '... N more' indicator when list is clamped", () => {
    const slots = Array.from({ length: 10 }, (_, i) => `0x${i.toString().padStart(4, "0")}`)
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, {
        label: "PK Slots",
        value: slots,
        maxRows: 5,
      }),
    )
    // 10 - 5 = 5 more
    expect(html).toContain("5 more")
  })

  it("does not show overflow indicator when all items fit within maxRows", () => {
    const slots = ["0x0001", "0x0002", "0x0003"]
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, {
        label: "Slots",
        value: slots,
        maxRows: 5,
      }),
    )
    expect(html).not.toContain("more")
  })
})

describe("HexDisplay — truncation", () => {
  it("truncates long hex values when truncate prop is provided", () => {
    const longHex = "0x" + "a".repeat(64)
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, {
        label: "Long",
        value: longHex,
        truncate: { head: 8, tail: 4 },
      }),
    )
    expect(html).toContain("...")
    // Original full string should not appear
    expect(html).not.toContain("0x" + "a".repeat(64))
  })

  it("does not truncate short values even with truncate prop", () => {
    const shortHex = "0x1234"
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, {
        label: "Short",
        value: shortHex,
        truncate: { head: 8, tail: 4 },
      }),
    )
    expect(html).toContain("0x1234")
    expect(html).not.toContain("...")
  })

  it("applies truncation to each item in list mode", () => {
    const slots = ["0x" + "f".repeat(64), "0x" + "e".repeat(64)]
    const html = renderToStaticMarkup(
      React.createElement(HexDisplay, {
        label: "Slots",
        value: slots,
        truncate: { head: 8, tail: 4 },
      }),
    )
    expect(html).toContain("...")
    // Full 64-char strings should not appear
    expect(html).not.toContain("f".repeat(64))
    expect(html).not.toContain("e".repeat(64))
  })
})
