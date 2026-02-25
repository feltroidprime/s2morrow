"use client"

import React, { useCallback } from "react"
import { Cause, Exit, Layer, ManagedRuntime, Option } from "effect"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { FalconService } from "@/services/FalconService"
import { WasmRuntimeLive } from "@/services/WasmRuntime"
import {
  keypairAtom,
  messageAtom,
  packedKeyAtom,
  signatureAtom,
  verificationStepAtom,
} from "@/atoms/falcon"
import { HexDisplay } from "./HexDisplay"
import { bytesToHex, getVerificationDisabledState } from "./verification-utils"

const appRuntime = ManagedRuntime.make(
  FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
)

export function SignVerifyPanel(): React.JSX.Element {
  const message = useAtomValue(messageAtom)
  const keypair = useAtomValue(keypairAtom)
  const step = useAtomValue(verificationStepAtom)
  const signature = useAtomValue(signatureAtom)

  const setMessage = useAtomSet(messageAtom)
  const setStep = useAtomSet(verificationStepAtom)
  const setSignature = useAtomSet(signatureAtom)
  const setPackedKey = useAtomSet(packedKeyAtom)

  const { isBusy, canSign } = getVerificationDisabledState({
    keypair,
    message,
    step,
  })

  const handleSignAndVerify = useCallback(async () => {
    const kp = Option.match(keypair, {
      onNone: () => null,
      onSome: (k) => k,
    })
    if (!kp) return

    const startTime = Date.now()
    const messageBytes = new TextEncoder().encode(message)

    // Sign
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

    // Pack Public Key
    setStep({ step: "packing" })
    const pkNtt16 = new Uint16Array(kp.publicKeyNtt.length)
    for (let i = 0; i < kp.publicKeyNtt.length; i++) {
      pkNtt16[i] = kp.publicKeyNtt[i]
    }
    const packExit = await appRuntime.runPromiseExit(
      FalconService.packPublicKey(pkNtt16),
    )

    if (Exit.isFailure(packExit)) {
      const errOpt = Cause.failureOption(packExit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Packing failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
      return
    }

    setPackedKey(Option.some(packExit.value))

    // Verify
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
  }, [keypair, message, setPackedKey, setSignature, setStep])

  const signatureHex = Option.match(signature, {
    onNone: () => null,
    onSome: (s) => "0x" + bytesToHex(s.signature),
  })

  const saltHex = Option.match(signature, {
    onNone: () => null,
    onSome: (s) => "0x" + bytesToHex(s.salt),
  })

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-falcon-text">Sign & Verify</h3>

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
          placeholder="Enter a message to sign..."
          className="mt-1 w-full rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 font-mono text-sm text-falcon-text placeholder-falcon-muted focus:outline-none focus:ring-2 focus:ring-falcon-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <button
        onClick={handleSignAndVerify}
        aria-label="Sign and verify message"
        disabled={!canSign}
        className="rounded-lg bg-falcon-accent px-6 py-2.5 text-sm font-semibold text-falcon-text transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {step.step === "signing" || step.step === "packing" || step.step === "verifying"
          ? "Running..."
          : "Sign & Verify"}
      </button>

      {signatureHex !== null && step.step === "complete" && (
        <div className="space-y-3">
          <HexDisplay
            label={`Signature (${Option.match(signature, { onNone: () => 0, onSome: (s) => s.signature.length })} bytes)`}
            value={signatureHex}
            truncate={{ head: 18, tail: 8 }}
          />
          {saltHex !== null && (
            <HexDisplay
              label={`Salt (${Option.match(signature, { onNone: () => 0, onSome: (s) => s.salt.length })} bytes)`}
              value={saltHex}
              truncate={{ head: 18, tail: 8 }}
            />
          )}
        </div>
      )}

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
            <span className={`text-xl font-bold ${step.valid ? "text-falcon-success" : "text-falcon-error"}`}>
              {step.valid ? "\u2713" : "\u2717"}
            </span>
            <span className="font-semibold text-falcon-text">
              {step.valid ? "Signature valid" : "Signature invalid"}
            </span>
            <span className="ml-auto text-sm text-falcon-muted">{step.durationMs}ms</span>
          </div>
        </div>
      )}

      {step.step === "error" && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-falcon-error/30 bg-falcon-error/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl font-bold text-falcon-error">{"\u2717"}</span>
            <div className="flex-1">
              <p className="font-semibold text-falcon-error">Error</p>
              <p className="mt-1 break-all text-sm text-falcon-muted">{step.message}</p>
            </div>
            <button
              onClick={() => setStep({ step: "idle" })}
              className="ml-auto rounded-lg border border-falcon-muted/30 px-3 py-1 text-xs text-falcon-muted hover:bg-falcon-surface"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
