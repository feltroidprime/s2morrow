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
    <div className="space-y-5">
      <h3 className="text-base font-semibold tracking-tight text-falcon-text/90">Sign & Verify</h3>

      <div>
        <label
          htmlFor="message-input"
          className="block text-xs font-medium text-falcon-text/30"
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
          className="glass-input mt-2 w-full px-4 py-3 font-mono text-sm text-falcon-text/80 placeholder-falcon-text/20"
        />
      </div>

      <button
        onClick={handleSignAndVerify}
        aria-label="Sign and verify message"
        disabled={!canSign}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-falcon-accent to-falcon-accent/80 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-falcon-accent/15 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-falcon-accent/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
      >
        {(step.step === "signing" || step.step === "packing" || step.step === "verifying") ? (
          <>
            <svg className="animate-spin-ring" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-20" />
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="33" strokeDashoffset="23" />
            </svg>
            {step.step === "signing" ? "Signing..." : step.step === "packing" ? "Packing..." : "Verifying..."}
          </>
        ) : (
          "Sign & Verify"
        )}
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
          className={`glass-card-static rounded-2xl p-5 animate-fade-in ${step.valid ? "glass-card-success" : "glass-card-error"}`}
        >
          <div className="flex items-center gap-3">
            <span className={`text-lg font-semibold ${step.valid ? "text-falcon-success" : "text-falcon-error"}`}>
              {step.valid ? "\u2713" : "\u2717"}
            </span>
            <span className="text-sm font-medium text-falcon-text/80">
              {step.valid ? "Signature valid" : "Signature invalid"}
            </span>
            <span className="ml-auto font-mono tabular-nums text-xs text-falcon-text/30">{step.durationMs}ms</span>
          </div>
        </div>
      )}

      {step.step === "error" && (
        <div
          role="alert"
          aria-live="polite"
          className="glass-card-static glass-card-error rounded-2xl p-5 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <span className="text-lg font-semibold text-falcon-error">{"\u2717"}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-falcon-error/80">Error</p>
              <p className="mt-1 break-all text-xs text-falcon-text/30">{step.message}</p>
            </div>
            <button
              onClick={() => setStep({ step: "idle" })}
              className="glass-btn ml-auto rounded-lg px-3 py-1 text-xs text-falcon-text/40 hover:text-falcon-text/70"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
