"use client"

/**
 * VerificationPlayground — interactive Falcon-512 signature demo.
 *
 * Lets the user:
 *   1. Generate a Falcon-512 keypair in-browser via WASM
 *   2. Type a message to sign
 *   3. Run sign + verify and see the result with timing
 *
 * Architecture:
 * - Atom state (keypairAtom, verificationStepAtom, messageAtom, etc.) drives
 *   all UI updates — no local useState.
 * - FalconService methods are run via a ManagedRuntime (singleton defined
 *   outside the component) so the WASM layer is loaded at most once.
 * - All Option values are handled via Option.match (never getOrThrow).
 * - Hex display uses bytesToHex (browser-safe, no Buffer.from).
 */

import React, { useCallback } from "react"
import { Cause, Exit, Layer, ManagedRuntime, Option } from "effect"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { FalconService } from "@/services/FalconService"
import { WasmRuntimeLive } from "@/services/WasmRuntime"
import {
  keypairAtom,
  messageAtom,
  signatureAtom,
  verificationStepAtom,
  wasmStatusAtom,
} from "@/atoms/falcon"
import { HexDisplay } from "./HexDisplay"
import { bytesToHex, getVerificationDisabledState } from "./verification-utils"

// ─── Service runtime (singleton — WASM loaded lazily, at most once) ──────────

const appRuntime = ManagedRuntime.make(
  FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
)
// Intentionally process-lifetime scoped for SPA usage; disposing would drop
// loaded WASM state and force a reload with no functional benefit here.

// ─── Component ────────────────────────────────────────────────────────────────

export function VerificationPlayground(): React.JSX.Element {
  // ── Atom reads ──────────────────────────────────────────────────────────
  const message = useAtomValue(messageAtom)
  const keypair = useAtomValue(keypairAtom)
  const step = useAtomValue(verificationStepAtom)

  // ── Atom writes ─────────────────────────────────────────────────────────
  const setMessage = useAtomSet(messageAtom)
  const setKeypair = useAtomSet(keypairAtom)
  const setStep = useAtomSet(verificationStepAtom)
  const setSignature = useAtomSet(signatureAtom)
  const setWasmStatus = useAtomSet(wasmStatusAtom)

  // ── Derived disabled state ───────────────────────────────────────────────
  const { isBusy, canGenerate, canSign } = getVerificationDisabledState({
    keypair,
    message,
    step,
  })

  // ── Handler: Generate Keypair ────────────────────────────────────────────
  const handleGenerateKeypair = useCallback(async () => {
    setStep({ step: "generating-keypair" })
    const seed = crypto.getRandomValues(new Uint8Array(32))

    const exit = await appRuntime.runPromiseExit(
      FalconService.generateKeypair(seed),
    )

    if (Exit.isSuccess(exit)) {
      setKeypair(Option.some(exit.value))
      setWasmStatus("ready")
      setStep({ step: "idle" })
    } else {
      const errOpt = Cause.failureOption(exit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Keypair generation failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
    }
  }, [setKeypair, setStep, setWasmStatus])

  // ── Handler: Sign & Verify ───────────────────────────────────────────────
  const handleSignAndVerify = useCallback(async () => {
    // Extract keypair via Option.match — never getOrThrow
    const kp = Option.match(keypair, {
      onNone: () => null,
      onSome: (k) => k,
    })
    if (!kp) return

    const startTime = Date.now()
    const messageBytes = new TextEncoder().encode(message)

    // ── Sign ──────────────────────────────────────────────────────────────
    setStep({ step: "signing" })
    const signExit = await appRuntime.runPromiseExit(
      FalconService.sign(kp.secretKey, messageBytes),
    )

    if (Exit.isFailure(signExit)) {
      const errOpt = Cause.failureOption(signExit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Signing failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
      return
    }

    const sigResult = signExit.value
    setSignature(Option.some(sigResult))

    // ── Verify ────────────────────────────────────────────────────────────
    setStep({ step: "verifying", substep: "verify" })
    const verifyExit = await appRuntime.runPromiseExit(
      FalconService.verify(kp.verifyingKey, messageBytes, sigResult.signature),
    )

    if (Exit.isFailure(verifyExit)) {
      const errOpt = Cause.failureOption(verifyExit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Verification failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
      return
    }

    const durationMs = Date.now() - startTime
    setStep({ step: "complete", valid: verifyExit.value, durationMs })
  }, [keypair, message, setSignature, setStep])

  // ── Derived display values ───────────────────────────────────────────────
  // Use bytesToHex (browser-safe, no Buffer.from) + Option.match (no getOrThrow)
  const keypairHexPreview = Option.match(keypair, {
    onNone: () => null,
    onSome: (kp) => "0x" + bytesToHex(kp.verifyingKey),
  })

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <section id="verify" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Section header */}
        <h2 className="text-3xl font-bold tracking-tight text-falcon-text">
          Verification Playground
        </h2>
        <p className="mt-4 text-falcon-muted">
          Generate a Falcon-512 keypair in-browser via WASM, sign a message,
          and verify the signature. All crypto runs locally — no server
          involvement.
        </p>

        <div className="mt-8 space-y-6">
          {/* Message input */}
          <div>
            <label
              htmlFor="message-input"
              className="block text-sm font-medium text-falcon-text"
            >
              Message
            </label>
            <input
              id="message-input"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isBusy}
              placeholder="Enter a message to sign…"
              className="mt-1 w-full rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 font-mono text-sm text-falcon-text placeholder-falcon-muted focus:outline-none focus:ring-2 focus:ring-falcon-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleGenerateKeypair}
              aria-label="Generate Keypair"
              disabled={!canGenerate}
              className="rounded-lg bg-falcon-primary px-6 py-2.5 text-sm font-semibold text-falcon-text transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step.step === "generating-keypair"
                ? "Generating..."
                : "Generate Keypair"}
            </button>

            <button
              onClick={handleSignAndVerify}
              aria-label="Sign and verify message"
              disabled={!canSign}
              className="rounded-lg bg-falcon-accent px-6 py-2.5 text-sm font-semibold text-falcon-text transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step.step === "signing" || step.step === "verifying"
                ? "Running…"
                : "Sign & Verify"}
            </button>
          </div>

          {/* Keypair hex preview — uses bytesToHex, no Buffer.from */}
          {keypairHexPreview !== null && (
            <HexDisplay
              label="Verifying Key (preview)"
              value={keypairHexPreview}
              truncate={{ head: 18, tail: 8 }}
            />
          )}

          {/* Success result */}
          {step.step === "complete" && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border p-4 ${
                step.valid
                  ? "border-falcon-success/30 bg-falcon-success/10"
                  : "border-falcon-error/30 bg-falcon-error/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xl font-bold ${
                    step.valid ? "text-falcon-success" : "text-falcon-error"
                  }`}
                >
                  {step.valid ? "✓" : "✗"}
                </span>
                <span className="font-semibold text-falcon-text">
                  {step.valid ? "Signature valid" : "Signature invalid"}
                </span>
                <span className="ml-auto text-sm text-falcon-muted">
                  {step.durationMs}ms
                </span>
              </div>
            </div>
          )}

          {/* Error state */}
          {step.step === "error" && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-falcon-error/30 bg-falcon-error/10 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl font-bold text-falcon-error">✗</span>
                <div className="flex-1">
                  <p className="font-semibold text-falcon-error">Error</p>
                  <p className="mt-1 break-all text-sm text-falcon-muted">
                    {step.message}
                  </p>
                </div>
                <button
                  onClick={() => setStep({ step: "idle" })}
                  aria-label="Reset verification state"
                  className="ml-auto rounded-lg border border-falcon-muted/30 px-3 py-1 text-xs text-falcon-muted hover:bg-falcon-surface"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
