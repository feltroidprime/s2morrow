"use client"

import React, { useCallback, useEffect, useState } from "react"
import { Cause, Exit, Layer, ManagedRuntime, Option } from "effect"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { hash } from "starknet"
import { FalconService } from "@/services/FalconService"
import { WasmRuntimeLive } from "@/services/WasmRuntime"
import {
  keypairAtom,
  packedKeyAtom,
  verificationStepAtom,
  wasmStatusAtom,
  persistKeypair,
  persistPackedKey,
  getExportedFlag,
  setExportedFlag,
} from "@/atoms/falcon"
import { networkAtom } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import { exportKeyFile, parseKeyFile } from "@/services/keyfile"
import type { PackedPublicKey } from "@/services/types"
import { HexDisplay } from "./HexDisplay"
import { bytesToHex } from "./verification-utils"
import { QuantumShield } from "@/components/ui/QuantumShield"
import { LatticeGrid } from "@/components/ui/LatticeGrid"
import { EntropyStrip } from "@/components/ui/EntropyStrip"
import { AddressDisplay } from "@/components/ui/AddressDisplay"
import { StarknetService } from "@/services/StarknetService"
import { TokenAmount } from "@/components/ui/TokenAmount"

const appRuntime = ManagedRuntime.make(
  FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
)

function createStarknetRuntime(rpcUrl: string, classHash: string) {
  return ManagedRuntime.make(
    Layer.mergeAll(
      FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
      StarknetService.make(rpcUrl, classHash),
    ),
  )
}

function deriveAddress(packedPk: PackedPublicKey, classHash: string): string {
  const constructorCalldata = [...packedPk.slots]
  return hash.calculateContractAddressFromHash("0x1", classHash, constructorCalldata, 0)
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return addr.slice(0, 10) + "..." + addr.slice(-6)
}

export function KeyManagementPanel(): React.JSX.Element {
  const keypair = useAtomValue(keypairAtom)
  const packedKey = useAtomValue(packedKeyAtom)
  const step = useAtomValue(verificationStepAtom)
  const setKeypair = useAtomSet(keypairAtom)
  const setPackedKey = useAtomSet(packedKeyAtom)
  const setStep = useAtomSet(verificationStepAtom)
  const setWasmStatus = useAtomSet(wasmStatusAtom)
  const networkId = useAtomValue(networkAtom)
  const networkConfig = NETWORKS[networkId]

  const [hasExported, setHasExported] = useState(getExportedFlag)
  const [confirmReplace, setConfirmReplace] = useState<{
    currentAddr: string
    newAddr: string
    proceed: () => void
  } | null>(null)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [isDeployedOnChain, setIsDeployedOnChain] = useState<boolean | null>(null)
  const [onChainBalance, setOnChainBalance] = useState<bigint | null>(null)

  // Sync exported flag from localStorage when keypair changes
  useEffect(() => {
    setHasExported(getExportedFlag())
  }, [keypair])

  const isBusy = step.step === "generating-keypair"

  // Derive address from current packed key for display
  const currentAddress = Option.match(packedKey, {
    onNone: () => null,
    onSome: (pk) => {
      if (networkConfig.classHash === "0x0") return null
      return deriveAddress(pk, networkConfig.classHash)
    },
  })

  // Query on-chain deployed status + balance
  useEffect(() => {
    if (!currentAddress) {
      setIsDeployedOnChain(null)
      setOnChainBalance(null)
      return
    }
    let cancelled = false
    const rt = createStarknetRuntime(networkConfig.rpcUrl, networkConfig.classHash)
    const check = async () => {
      const [depExit, balExit] = await Promise.all([
        rt.runPromiseExit(StarknetService.isDeployed(currentAddress)),
        rt.runPromiseExit(StarknetService.getBalance(currentAddress)),
      ])
      if (cancelled) return
      if (Exit.isSuccess(depExit)) setIsDeployedOnChain(depExit.value)
      if (Exit.isSuccess(balExit)) setOnChainBalance(balExit.value)
    }
    check()
    return () => { cancelled = true }
  }, [currentAddress, networkConfig.rpcUrl, networkConfig.classHash])

  const packPublicKey = useCallback(
    async (pkNtt: Int32Array) => {
      const pkNtt16 = new Uint16Array(pkNtt.length)
      for (let i = 0; i < pkNtt.length; i++) pkNtt16[i] = pkNtt[i]
      const exit = await appRuntime.runPromiseExit(
        FalconService.packPublicKey(pkNtt16),
      )
      if (Exit.isSuccess(exit)) {
        setPackedKey(Option.some(exit.value))
        persistPackedKey(Option.some(exit.value))
      }
    },
    [setPackedKey],
  )

  const doGenerate = useCallback(async () => {
    setConfirmGenerate(false)
    setStep({ step: "generating-keypair" })
    setPackedKey(Option.none())
    persistPackedKey(Option.none())
    const seed = crypto.getRandomValues(new Uint8Array(32))

    const startTime = Date.now()
    const exit = await appRuntime.runPromiseExit(
      FalconService.generateKeypair(seed),
    )

    // Ensure lattice animation plays for at least 1s
    const elapsed = Date.now() - startTime
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed))
    }

    if (Exit.isSuccess(exit)) {
      const kpOption = Option.some(exit.value)
      setKeypair(kpOption)
      persistKeypair(kpOption)
      setExportedFlag(false)
      setHasExported(false)
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

  const handleGenerate = useCallback(() => {
    // Guard: if keypair already exists, show inline confirmation
    if (Option.isSome(keypair) && Option.isSome(packedKey) && currentAddress) {
      setConfirmGenerate(true)
      return
    }
    doGenerate()
  }, [keypair, packedKey, currentAddress, doGenerate])

  const applyImport = useCallback(
    async (text: string) => {
      const exit = await appRuntime.runPromiseExit(parseKeyFile(text))

      if (Exit.isSuccess(exit)) {
        const kpOption = Option.some(exit.value.keypair)
        const pkOption = Option.some(exit.value.packedPublicKey)
        setKeypair(kpOption)
        setPackedKey(pkOption)
        persistKeypair(kpOption)
        persistPackedKey(pkOption)
        setExportedFlag(true) // imported from file = effectively backed up
        setHasExported(true)
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
    },
    [setKeypair, setPackedKey, setWasmStatus, setStep],
  )

  const handleImport = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()

      // Parse the imported key to check for address mismatch
      const parseExit = await appRuntime.runPromiseExit(parseKeyFile(text))
      if (Exit.isFailure(parseExit)) {
        applyImport(text) // let applyImport show the error
        return
      }

      const importedPk = parseExit.value.packedPublicKey
      const hasExisting = Option.isSome(packedKey)

      if (hasExisting && networkConfig.classHash !== "0x0") {
        const existingPk = Option.getOrThrow(packedKey)
        const existingAddr = deriveAddress(existingPk, networkConfig.classHash)
        const importedAddr = deriveAddress(importedPk, networkConfig.classHash)

        if (existingAddr !== importedAddr) {
          setConfirmReplace({
            currentAddr: existingAddr,
            newAddr: importedAddr,
            proceed: () => {
              setConfirmReplace(null)
              applyImport(text)
            },
          })
          return
        }
      }

      applyImport(text)
    }
    input.click()
  }, [packedKey, networkConfig.classHash, applyImport])

  const handleExport = useCallback(() => {
    const kp = Option.match(keypair, { onNone: () => null, onSome: (k) => k })
    const pk = Option.match(packedKey, { onNone: () => null, onSome: (p) => p })
    if (!kp || !pk) return

    const json = exportKeyFile(kp, pk, currentAddress)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "falcon-keypair.json"
    a.click()
    URL.revokeObjectURL(url)
    setExportedFlag(true)
    setHasExported(true)
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 2000)
  }, [keypair, packedKey, currentAddress])

  const hasKeypair = Option.isSome(keypair)
  const hasPacked = Option.isSome(packedKey)

  const keypairHex = Option.match(keypair, {
    onNone: () => null,
    onSome: (kp) => "0x" + bytesToHex(kp.verifyingKey),
  })

  return (
    <div className="space-y-5">
      <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-falcon-text/90">
        <QuantumShield size="sm" />
        Quantum Key Vault
      </h3>

      {/* Backup warning */}
      {hasKeypair && !hasExported && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-amber-400 text-sm">&#9888;</span>
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-300/90">
              Wallet not backed up
            </p>
            <p className="mt-0.5 text-xs text-amber-300/50">
              Export your key file now to avoid losing access to your funds.
            </p>
          </div>
          <button
            onClick={handleExport}
            className="shrink-0 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300/90 transition-colors hover:bg-amber-500/25"
          >
            Export Now
          </button>
        </div>
      )}

      {/* Generate replacement confirmation */}
      {confirmGenerate && currentAddress && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3 animate-fade-in">
          <p className="text-xs font-medium text-amber-300/90">
            Replace existing quantum wallet?
          </p>
          <p className="text-xs text-amber-300/60">
            You already have a wallet at <span className="font-mono text-amber-300/80">{truncateAddress(currentAddress)}</span>.
            Generating a new key will replace it. Make sure you&apos;ve exported your current key first.
          </p>
          <div className="flex gap-2">
            <button
              onClick={doGenerate}
              className="rounded-lg bg-amber-500/15 px-4 py-1.5 text-xs font-medium text-amber-300/90 transition-colors hover:bg-amber-500/25"
            >
              Replace Wallet
            </button>
            <button
              onClick={() => setConfirmGenerate(false)}
              className="glass-btn rounded-lg px-4 py-1.5 text-xs font-medium text-falcon-text/40 transition-colors hover:text-falcon-text/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Import mismatch confirmation dialog */}
      {confirmReplace && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
          <p className="text-xs font-medium text-red-300/90">
            Address mismatch detected
          </p>
          <p className="text-xs text-red-300/60">
            Your current wallet is at <span className="font-mono text-red-300/80">{truncateAddress(confirmReplace.currentAddr)}</span>.
            The imported key maps to a different address: <span className="font-mono text-red-300/80">{truncateAddress(confirmReplace.newAddr)}</span>.
          </p>
          <p className="text-xs text-red-300/60">
            Importing will replace your current wallet. Any funds at the old address will only be accessible if you have a backup.
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmReplace.proceed}
              className="rounded-lg bg-red-500/15 px-4 py-1.5 text-xs font-medium text-red-300/90 transition-colors hover:bg-red-500/25"
            >
              Replace Wallet
            </button>
            <button
              onClick={() => setConfirmReplace(null)}
              className="glass-btn rounded-lg px-4 py-1.5 text-xs font-medium text-falcon-text/40 transition-colors hover:text-falcon-text/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="relative">
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
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 ${
              exportSuccess
                ? "glass-btn text-falcon-success/80"
                : hasKeypair && !hasExported
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-300/90 hover:bg-amber-500/15"
                  : "glass-btn text-falcon-text/60 hover:text-falcon-text/80"
            }`}
          >
            {exportSuccess ? "\u2713 Exported" : "Export"}
          </button>
        </div>
        {isBusy && (
          <div className="mt-3 space-y-2">
            <LatticeGrid active={isBusy} />
            <EntropyStrip active={isBusy} />
          </div>
        )}
      </div>

      {keypairHex !== null && (
        <div className="space-y-4">
          <HexDisplay
            label="Quantum-Resistant Verifying Key"
            value={keypairHex}
            truncate={{ head: 18, tail: 8 }}
          />

          {currentAddress && (
            <>
              <AddressDisplay
                address={currentAddress}
                full
                label="Your Quantum-Protected Address"
                explorerBaseUrl={networkConfig.explorerBaseUrl}
              />

              {/* Deployed + balance status */}
              <div className="flex flex-wrap items-center gap-3">
                {isDeployedOnChain != null && (
                  isDeployedOnChain ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-falcon-success/10 px-2.5 py-1 text-xs font-medium text-falcon-success/80">
                      <span className="status-dot-protected" />
                      Deployed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-falcon-muted/10 px-2.5 py-1 text-xs font-medium text-falcon-text/40">
                      Not deployed
                    </span>
                  )
                )}
                {onChainBalance != null && (
                  <TokenAmount amount={onChainBalance} className="text-xs text-falcon-text/55" />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
