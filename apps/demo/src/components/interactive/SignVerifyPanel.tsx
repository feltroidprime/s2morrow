"use client"

import React, { useCallback } from "react"
import { Cause, Effect, Exit, Layer, ManagedRuntime, Option } from "effect"
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
import { QuantumShield } from "@/components/ui/QuantumShield"

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

    const messageBytes = new TextEncoder().encode(message)

    const pkNtt16 = new Uint16Array(kp.publicKeyNtt.length)
    for (let i = 0; i < kp.publicKeyNtt.length; i++) {
      pkNtt16[i] = kp.publicKeyNtt[i]
    }

    // Run sign + pack + verify in a single Effect fiber to avoid
    // per-fiber scheduling overhead inflating the measured time.
    const pipeline = Effect.gen(function* () {
      const sigResult = yield* FalconService.sign(kp.secretKey, messageBytes)
      const packedPk = yield* FalconService.packPublicKey(pkNtt16)
      const valid = yield* FalconService.verify(kp.verifyingKey, messageBytes, sigResult.signature)
      return { sigResult, packedPk, valid }
    })

    setStep({ step: "signing" })
    const t0 = performance.now()
    const exit = await appRuntime.runPromiseExit(pipeline)
    const durationMs = Math.round(performance.now() - t0)

    if (Exit.isFailure(exit)) {
      const errOpt = Cause.failureOption(exit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Sign & verify failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
      return
    }

    const { sigResult, packedPk, valid } = exit.value
    setSignature(Option.some(sigResult))
    setPackedKey(Option.some(packedPk))
    setStep({ step: "complete", valid, durationMs })
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
      <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-falcon-text/90">
        <QuantumShield size="sm" />
        Quantum Sign & Verify
      </h3>

      <div>
        <label
          htmlFor="message-input"
          className="block text-xs font-medium text-falcon-text/50"
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
          className="glass-input mt-2 w-full px-4 py-3 font-mono text-sm text-falcon-text/80 placeholder-falcon-text/35"
        />
      </div>

      <button
        onClick={handleSignAndVerify}
        aria-label="Sign and verify message"
        disabled={!canSign}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-falcon-accent to-falcon-accent/80 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-falcon-accent/15 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-falcon-accent/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
      >
        {step.step === "signing" ? (
          <>
            <svg className="animate-spin-ring" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-20" />
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="33" strokeDashoffset="23" />
              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="40" strokeDashoffset="30" className="opacity-30" style={{ animation: "spin-ring 1.8s cubic-bezier(0.5, 0, 0.5, 1) infinite reverse" }} />
            </svg>
            Quantum-signing...
          </>
        ) : (
          "Quantum-Sign & Verify"
        )}
      </button>

      {!canSign && step.step !== "signing" && (
        <p className="text-xs text-falcon-text/40">
          {!Option.isSome(keypair)
            ? "Generate a keypair first to enable signing."
            : message.trim().length === 0
              ? "Enter a message above to sign."
              : null}
        </p>
      )}

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
          className={`glass-card-static rounded-2xl p-5 animate-fade-in ${step.valid ? "glass-card-success shield-protected" : "glass-card-error"}`}
        >
          <div className="flex items-center gap-3">
            <span className={`text-lg font-semibold ${step.valid ? "text-falcon-success" : "text-falcon-error"}`}>
              {step.valid ? "\u2713" : "\u2717"}
            </span>
            <span className="text-sm font-medium text-falcon-text/80">
              {step.valid ? "Quantum-safe signature verified" : "Signature invalid"}
            </span>
            <span className="ml-auto font-mono tabular-nums text-xs text-falcon-text/50">{step.durationMs}ms</span>
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
              <p className="mt-1 break-all text-xs text-falcon-text/50">{step.message}</p>
              {step.message.toLowerCase().includes("wasm") && (
                <p className="mt-1 text-xs text-falcon-text/35">Try refreshing the page.</p>
              )}
            </div>
            <button
              onClick={() => setStep({ step: "idle" })}
              className="glass-btn ml-auto rounded-lg px-3 py-1 text-xs text-falcon-text/40 hover:text-falcon-text/70"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
