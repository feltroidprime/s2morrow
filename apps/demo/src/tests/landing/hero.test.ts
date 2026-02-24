import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Home from "../../app/page"
import { Hero } from "../../components/landing/Hero"

function renderHero(): string {
  return renderToStaticMarkup(React.createElement(Hero))
}

describe("Hero (RSC)", () => {
  test("renders headline 'Post-Quantum Signatures on Starknet'", () => {
    const html = renderHero()
    expect(html).toContain("Post-Quantum Signatures on Starknet")
  })

  test("renders required stats: 63K steps, 62 calldata felts, 29 storage slots", () => {
    const html = renderHero()
    expect(html).toContain("63K")
    expect(html).toContain("Steps")
    expect(html).toContain("62")
    expect(html).toContain("Calldata felts")
    expect(html).toContain("29")
    expect(html).toContain("Storage slots")
  })

  test("renders CTA anchors for verification and deploy sections", () => {
    const html = renderHero()
    expect(html).toContain('href="#verify"')
    expect(html).toContain("Try Verification")
    expect(html).toContain('href="#deploy"')
    expect(html).toContain("Deploy Account")
    expect(html).toContain("focus-visible:ring-2")
  })

  test("uses semantic stat markup with dl/dt/dd", () => {
    const html = renderHero()
    expect(html).toContain("<dl")
    expect(html).toContain("<dt")
    expect(html).toContain("<dd")
  })

  test("uses mobile-first stats grid and no hardcoded text-white on primary CTA", () => {
    const source = readFileSync(new URL("../../components/landing/Hero.tsx", import.meta.url), "utf-8")
    expect(source).toContain("grid-cols-1")
    expect(source).toContain("sm:grid-cols-3")
    expect(source).not.toContain("text-white")
    expect(source).not.toContain('"use client"')
    expect(source).not.toContain("'use client'")
  })

  test("renders no inline scripts (pure server markup)", () => {
    const html = renderHero()
    expect(html).not.toContain("<script")
  })

  test("is rendered from the landing page route", () => {
    const html = renderToStaticMarkup(React.createElement(Home))
    expect(html).toContain("Post-Quantum Signatures on Starknet")
    expect(html).toContain("Try Verification")
  })

  test("globals.css enables smooth scroll and reduced-motion override", () => {
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8")
    expect(css).toContain("html {")
    expect(css).toContain("scroll-behavior: smooth")
    expect(css).toContain("@media (prefers-reduced-motion: reduce)")
    expect(css).toContain("scroll-behavior: auto")
  })
})
