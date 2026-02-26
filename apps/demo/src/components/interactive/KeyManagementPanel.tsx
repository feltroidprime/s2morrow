"use client"

import React, { useCallback, useState } from "react"
import { Cause, Exit, Layer, ManagedRuntime, Option } from "effect"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { FalconService } from "@/services/FalconService"
import { WasmRuntimeLive } from "@/services/WasmRuntime"
import {
  keypairAtom,
  packedKeyAtom,
  verificationStepAtom,
  wasmStatusAtom,
} from "@/atoms/falcon"
import { exportKeyFile, parseKeyFile } from "@/services/keyfile"
import { HexDisplay } from "./HexDisplay"
import { bytesToHex } from "./verification-utils"

const appRuntime = ManagedRuntime.make(
  FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
)

export function KeyManagementPanel(): React.JSX.Element {
  const keypair = useAtomValue(keypairAtom)
  const packedKey = useAtomValue(packedKeyAtom)
  const step = useAtomValue(verificationStepAtom)
  const setKeypair = useAtomSet(keypairAtom)
  const setPackedKey = useAtomSet(packedKeyAtom)
  const setStep = useAtomSet(verificationStepAtom)
  const setWasmStatus = useAtomSet(wasmStatusAtom)

  const [showNtt, setShowNtt] = useState(false)
  const [showPacked, setShowPacked] = useState(false)

  const isBusy = step.step === "generating-keypair"

  const packPublicKey = useCallback(
    async (pkNtt: Int32Array) => {
      const pkNtt16 = new Uint16Array(pkNtt.length)
      for (let i = 0; i < pkNtt.length; i++) pkNtt16[i] = pkNtt[i]
      const exit = await appRuntime.runPromiseExit(
        FalconService.packPublicKey(pkNtt16),
      )
      if (Exit.isSuccess(exit)) {
        setPackedKey(Option.some(exit.value))
      }
    },
    [setPackedKey],
  )

  const handleGenerate = useCallback(async () => {
    setStep({ step: "generating-keypair" })
    setPackedKey(Option.none())
    const seed = crypto.getRandomValues(new Uint8Array(32))

    const exit = await appRuntime.runPromiseExit(
      FalconService.generateKeypair(seed),
    )

    if (Exit.isSuccess(exit)) {
      setKeypair(Option.some(exit.value))
      setWasmStatus("ready")
      setStep({ step: "idle" })
      await packPublicKey(exit.value.publicKeyNtt)
    } else {
      const errOpt = Cause.failureOption(exit.cause)
      const msg = Option.match(errOpt, {
        onNone: () => "Keypair generation failed",
        onSome: (e) => e.message,
      })
      setStep({ step: "error", message: msg })
    }
  }, [setKeypair, setPackedKey, setStep, setWasmStatus, packPublicKey])

  const handleImport = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const exit = await appRuntime.runPromiseExit(parseKeyFile(text))

      if (Exit.isSuccess(exit)) {
        setKeypair(Option.some(exit.value.keypair))
        setPackedKey(Option.some(exit.value.packedPublicKey))
        setWasmStatus("ready")
        setStep({ step: "idle" })
      } else {
        const errOpt = Cause.failureOption(exit.cause)
        const msg = Option.match(errOpt, {
          onNone: () => "Failed to parse key file",
          onSome: (e) => e.message,
        })
        setStep({ step: "error", message: msg })
      }
    }
    input.click()
  }, [setKeypair, setPackedKey, setWasmStatus, setStep])

  const handleExport = useCallback(() => {
    const kp = Option.match(keypair, { onNone: () => null, onSome: (k) => k })
    const pk = Option.match(packedKey, { onNone: () => null, onSome: (p) => p })
    if (!kp || !pk) return

    const json = exportKeyFile(kp, pk)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "falcon-keypair.json"
    a.click()
    URL.revokeObjectURL(url)
  }, [keypair, packedKey])

  const hasKeypair = Option.isSome(keypair)
  const hasPacked = Option.isSome(packedKey)

  const keypairHex = Option.match(keypair, {
    onNone: () => null,
    onSome: (kp) => "0x" + bytesToHex(kp.verifyingKey),
  })

  const nttCoeffs = Option.match(keypair, {
    onNone: () => null,
    onSome: (kp) => Array.from(kp.publicKeyNtt),
  })

  const packedSlots = Option.match(packedKey, {
    onNone: () => null,
    onSome: (pk) => pk.slots,
  })

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold tracking-tight text-falcon-text/90">Key Management</h3>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleGenerate}
          disabled={isBusy}
          className="rounded-xl bg-gradient-to-b from-falcon-primary to-falcon-primary/80 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-falcon-primary/15 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-falcon-primary/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {isBusy ? "Generating..." : "Generate"}
        </button>
        <button
          onClick={handleImport}
          disabled={isBusy}
          className="glass-btn rounded-xl px-5 py-2.5 text-sm font-medium text-falcon-text/60 transition-all duration-200 hover:scale-[1.02] hover:text-falcon-text/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Import
        </button>
        <button
          onClick={handleExport}
          disabled={!hasKeypair || !hasPacked}
          className="glass-btn rounded-xl px-5 py-2.5 text-sm font-medium text-falcon-text/60 transition-all duration-200 hover:scale-[1.02] hover:text-falcon-text/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export
        </button>
      </div>

      {keypairHex !== null && (
        <div className="space-y-4">
          <HexDisplay
            label="Verifying Key (896-byte h polynomial)"
            value={keypairHex}
            truncate={{ head: 18, tail: 8 }}
          />

          {nttCoeffs !== null && (
            <div>
              <button
                onClick={() => setShowNtt(!showNtt)}
                className="flex items-center gap-1.5 text-xs font-medium text-falcon-text/30 transition-colors duration-200 hover:text-falcon-text/60"
              >
                <span className="text-[10px]">{showNtt ? "\u25BC" : "\u25B6"}</span>
                NTT Coefficients ({nttCoeffs.length})
              </button>
              {showNtt && (
                <div className="glass-display mt-2 max-h-32 overflow-y-auto rounded-lg px-3 py-2 font-mono text-xs text-falcon-accent/50">
                  [{nttCoeffs.slice(0, 20).join(", ")}
                  {nttCoeffs.length > 20 && `, ... ${nttCoeffs.length - 20} more`}]
                </div>
              )}
            </div>
          )}

          {packedSlots !== null && (
            <div>
              <button
                onClick={() => setShowPacked(!showPacked)}
                className="flex items-center gap-1.5 text-xs font-medium text-falcon-text/30 transition-colors duration-200 hover:text-falcon-text/60"
              >
                <span className="text-[10px]">{showPacked ? "\u25BC" : "\u25B6"}</span>
                Packed Public Key ({packedSlots.length} felt252 slots)
              </button>
              {showPacked && (
                <HexDisplay
                  label=""
                  value={packedSlots}
                  maxRows={29}
                  truncate={{ head: 18, tail: 8 }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
