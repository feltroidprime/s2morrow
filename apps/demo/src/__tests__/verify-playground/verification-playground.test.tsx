import { describe, it, expect } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { RegistryProvider } from "@effect-atom/atom-react"
import { Option } from "effect"
import {
  keypairAtom,
  messageAtom,
  verificationStepAtom,
} from "../../atoms/falcon"
import { VerificationPlayground } from "../../components/interactive/VerificationPlayground"
import type { FalconKeypair, VerificationStep } from "../../services/types"

const mockKeypair: FalconKeypair = {
  secretKey: new Uint8Array(1281).fill(1),
  verifyingKey: new Uint8Array(897).fill(2),
  publicKeyNtt: new Int32Array(512).fill(3),
}

function renderPlayground(options?: {
  readonly message?: string
  readonly keypair?: Option.Option<FalconKeypair>
  readonly step?: VerificationStep
}): string {
  const message = options?.message ?? ""
  const keypair = options?.keypair ?? Option.none()
  const step = options?.step ?? { step: "idle" }

  return renderToStaticMarkup(
    React.createElement(
      RegistryProvider,
      {
        initialValues: [
          [messageAtom, message],
          [keypairAtom, keypair],
          [verificationStepAtom, step],
        ],
      },
      React.createElement(VerificationPlayground),
    ),
  )
}

describe("VerificationPlayground", () => {
  it("renders message input and action buttons", () => {
    const html = renderPlayground()

    expect(html).toContain('id="message-input"')
    expect(html).toContain("Generate Keypair")
    expect(html).toContain("Sign &amp; Verify")
  })

  it("adds explicit aria-label attributes to interactive buttons", () => {
    const html = renderPlayground()

    expect(html).toContain('aria-label="Generate Keypair"')
    expect(html).toContain('aria-label="Sign and verify message"')
  })

  it("keeps Sign & Verify disabled without keypair and message", () => {
    const html = renderPlayground()
    const signButton =
      html.match(/<button[^>]*aria-label="Sign and verify message"[^>]*>/)?.[0] ??
      ""

    expect(signButton).toContain('disabled=""')
  })

  it("enables Sign & Verify when keypair and non-empty message are present", () => {
    const html = renderPlayground({
      message: "hello falcon",
      keypair: Option.some(mockKeypair),
    })
    const signButton =
      html.match(/<button[^>]*aria-label="Sign and verify message"[^>]*>/)?.[0] ??
      ""

    expect(signButton).not.toContain('disabled=""')
  })

  it("announces success in a polite live region", () => {
    const html = renderPlayground({
      message: "done",
      keypair: Option.some(mockKeypair),
      step: { step: "complete", valid: true, durationMs: 12 },
    })

    expect(html).toContain('aria-live="polite"')
    expect(html).toContain("Signature valid")
  })

  it("announces errors with alert semantics", () => {
    const html = renderPlayground({
      step: { step: "error", message: "Verification failed" },
    })

    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain("Verification failed")
  })
})
