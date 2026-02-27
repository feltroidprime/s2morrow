"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Exit, Option } from "effect"
import { useAtomValue } from "@effect-atom/atom-react"
import { transaction } from "starknet"
import type { InvocationsSignerDetails, constants } from "starknet"
import { keypairAtom } from "@/atoms/falcon"
import { networkAtom } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import { StarknetService, STRK_TOKEN_ADDRESS } from "@/services/StarknetService"
import type { FalconResourceBounds } from "@/services/StarknetService"
import { FalconSigner } from "@/services/FalconSigner"
import { extractUserMessage } from "@/services/error-messages"
import { ExplorerLink } from "@/components/ui/ExplorerLink"
import { TransactionPhases } from "@/components/ui/TransactionPhases"
import { QuantumShield } from "@/components/ui/QuantumShield"
import { ParticleBurst } from "@/components/ui/ParticleBurst"
import type { ContractAddress } from "@/services/types"
import type { ManagedRuntime } from "effect"
import type { FalconService } from "@/services/FalconService"

type TxPhase =
  | { phase: "idle" }
  | { phase: "prefetching" }
  | { phase: "signing" }
  | { phase: "submitting"; signMs: number }
  | { phase: "confirming"; signMs: number; txHash: string }
  | { phase: "done"; signMs: number; networkMs: number; txHash: string }
  | { phase: "error"; message: string }

interface Prefetched {
  nonce: string
  chainId: string
  resourceBounds: FalconResourceBounds
}

interface SendTransactionProps {
  readonly deployedAddress: ContractAddress
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly deployRuntime: ManagedRuntime.ManagedRuntime<FalconService | StarknetService, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly falconRuntime: ManagedRuntime.ManagedRuntime<FalconService, any>
}

/** Yield to the browser so it can paint before we continue. */
const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0))

export function SendTransaction({
  deployedAddress,
  deployRuntime,
  falconRuntime,
}: SendTransactionProps): React.JSX.Element {
  const keypair = useAtomValue(keypairAtom)
  const networkId = useAtomValue(networkAtom)
  const networkConfig = NETWORKS[networkId]

  const [recipient, setRecipient] = useState(deployedAddress as string)
  const [amount, setAmount] = useState("0.001")
  const [txPhase, setTxPhase] = useState<TxPhase>({ phase: "prefetching" })
  const [recipientTouched, setRecipientTouched] = useState(false)
  const [accountBalance, setAccountBalance] = useState<bigint | null>(null)

  const timingRef = useRef({ signMs: 0, networkStartedAt: 0 })

  // Fetch balance on mount
  useEffect(() => {
    let cancelled = false
    const fetchBal = async () => {
      const exit = await deployRuntime.runPromiseExit(
        StarknetService.getBalance(deployedAddress as string),
      )
      if (!cancelled && Exit.isSuccess(exit)) {
        setAccountBalance(exit.value)
      }
    }
    fetchBal()
    return () => { cancelled = true }
  }, [deployRuntime, deployedAddress])

  // Address validation — validate while typing after 4+ chars
  const recipientValid = /^0x[0-9a-fA-F]{1,64}$/.test(recipient)
  const showRecipientError = (recipientTouched || recipient.length >= 4) && !recipientValid && recipient.length > 0
  const isSelf = (deployedAddress as string) === recipient

  // Amount validation
  const parsedAmount = parseFloat(amount)
  const amountWei = isNaN(parsedAmount) ? 0n : BigInt(Math.floor(parsedAmount * 1e18))
  const exceedsBalance = accountBalance != null && amountWei > accountBalance
  const overHalf = accountBalance != null && accountBalance > 0n && amountWei > accountBalance / 2n && !exceedsBalance

  // Prefetch nonce + chainId + resource bounds so send goes straight to signing
  const prefetchRef = useRef<Prefetched | null>(null)

  const doPrefetch = useCallback(async () => {
    prefetchRef.current = null
    const [nonceExit, chainExit, rbExit] = await Promise.all([
      deployRuntime.runPromiseExit(StarknetService.getNonce(deployedAddress as string)),
      deployRuntime.runPromiseExit(StarknetService.getChainId()),
      deployRuntime.runPromiseExit(StarknetService.getResourceBounds()),
    ])
    if (Exit.isSuccess(nonceExit) && Exit.isSuccess(chainExit) && Exit.isSuccess(rbExit)) {
      prefetchRef.current = {
        nonce: nonceExit.value,
        chainId: chainExit.value,
        resourceBounds: rbExit.value,
      }
      return true
    }
    return false
  }, [deployRuntime, deployedAddress])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      // Retry prefetch up to 3 times with delay for post-deploy nonce propagation
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return
        const ok = await doPrefetch()
        if (ok) {
          if (!cancelled) setTxPhase({ phase: "idle" })
          return
        }
        // Wait a bit for the node to update nonce after deploy
        await new Promise((r) => setTimeout(r, 1500))
      }
      if (!cancelled) {
        setTxPhase({ phase: "idle" }) // show UI even if prefetch partially failed
      }
    }
    init()
    return () => { cancelled = true }
  }, [doPrefetch])

  const handleSend = useCallback(async () => {
    const kp = Option.match(keypair, { onNone: () => null, onSome: (k) => k })
    if (!kp) return

    let prefetched = prefetchRef.current
    if (!prefetched) {
      setTxPhase({ phase: "prefetching" })
      const ok = await doPrefetch()
      prefetched = prefetchRef.current
      if (!ok || !prefetched) {
        setTxPhase({ phase: "error", message: "Network data not ready. Please try again." })
        return
      }
    }

    // ── Phase 1: Sign ───────────────────────────────────────────────
    setTxPhase({ phase: "signing" })

    const signer = new FalconSigner(kp.secretKey, kp.publicKeyNtt, falconRuntime)

    const calls = [{
      contractAddress: STRK_TOKEN_ADDRESS,
      entrypoint: "transfer",
      calldata: [recipient, BigInt(Math.floor(parseFloat(amount) * 1e18)).toString(), "0"],
    }]

    const signerDetails: InvocationsSignerDetails = {
      walletAddress: deployedAddress as string,
      chainId: prefetched.chainId as constants.StarknetChainId,
      cairoVersion: "1",
      version: "0x3",
      nonce: prefetched.nonce,
      resourceBounds: prefetched.resourceBounds,
      tip: "0x0",
      paymasterData: [],
      accountDeploymentData: [],
      nonceDataAvailabilityMode: "L1",
      feeDataAvailabilityMode: "L1",
    }

    const signStart = performance.now()
    let signature: string[]
    try {
      signature = await signer.signTransaction(calls, signerDetails) as string[]
    } catch (err) {
      setTxPhase({ phase: "error", message: String(err) })
      return
    }
    const signMs = performance.now() - signStart

    // Update UI and yield so the browser paints the signing badge
    timingRef.current = { signMs, networkStartedAt: performance.now() }
    setTxPhase({ phase: "submitting", signMs })
    await yieldToBrowser()

    // ── Phase 2: Submit ─────────────────────────────────────────────
    const compiledCalldata = transaction.getExecuteCalldata(calls, signerDetails.cairoVersion)

    const submitExit = await deployRuntime.runPromiseExit(
      StarknetService.submitSignedInvoke(
        deployedAddress as string,
        compiledCalldata as string[],
        signature,
        prefetched.nonce,
        prefetched.resourceBounds,
      ),
    )

    if (Exit.isFailure(submitExit)) {
      const msg = extractUserMessage(submitExit, "Transaction failed")
      // If nonce conflict, refetch and let user retry
      if (msg.toLowerCase().includes("nonce")) {
        await doPrefetch()
        setTxPhase({ phase: "error", message: "Transaction nonce conflict. Wait for your previous transaction to confirm, then try again." })
      } else {
        setTxPhase({ phase: "error", message: msg })
        doPrefetch()
      }
      return
    }

    const { txHash } = submitExit.value
    setTxPhase({ phase: "confirming", signMs, txHash })

    // ── Phase 3: Confirm ────────────────────────────────────────────
    const waitExit = await deployRuntime.runPromiseExit(
      StarknetService.waitForTx(txHash),
    )

    // Refetch nonce for next transaction
    doPrefetch()

    if (Exit.isFailure(waitExit)) {
      setTxPhase({ phase: "error", message: extractUserMessage(waitExit, "Transaction confirmation failed") })
      return
    }

    const networkMs = performance.now() - timingRef.current.networkStartedAt
    setTxPhase({ phase: "done", signMs, networkMs, txHash })
  }, [keypair, deployedAddress, recipient, amount, deployRuntime, falconRuntime, doPrefetch])

  const isBusy =
    txPhase.phase === "signing" ||
    txPhase.phase === "submitting" ||
    txPhase.phase === "confirming" ||
    txPhase.phase === "prefetching"

  return (
    <div className="glass-card-static mt-8 rounded-2xl p-6">
      <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-falcon-text/90">
        <QuantumShield size="sm" />
        Test Your Quantum-Safe Account
      </h3>
      <p className="mt-1.5 text-xs text-falcon-text/50">
        Send a small amount of STRK to yourself to verify your post-quantum account works correctly.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="tx-recipient" className="block text-xs font-medium text-falcon-text/50">
            Recipient
            {isSelf && (
              <span className="ml-2 inline-flex items-center rounded-md bg-falcon-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-falcon-primary/70">
                You
              </span>
            )}
          </label>
          <div className="relative mt-2">
            <input
              id="tx-recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onBlur={() => setRecipientTouched(true)}
              className={`glass-input w-full px-4 py-3 pr-10 font-mono text-sm text-falcon-text/80 ${
                showRecipientError ? "!border-falcon-error/30" : ""
              }`}
            />
            {(recipientTouched || recipient.length >= 4) && recipient.length > 0 && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${
                recipientValid ? "text-falcon-success/70" : "text-falcon-error/70"
              }`}>
                {recipientValid ? "\u2713" : "\u2717"}
              </span>
            )}
          </div>
          {showRecipientError && (
            <p className="mt-1 text-[11px] text-falcon-error/60">
              Must be a hex address starting with 0x (up to 66 characters)
            </p>
          )}
        </div>

        <div>
          <label htmlFor="tx-amount" className="flex items-baseline gap-2 text-xs font-medium text-falcon-text/50">
            <span>Amount (STRK)</span>
            {accountBalance != null && (
              <span className="ml-auto flex items-center gap-2 text-[10px] text-falcon-text/45 tabular-nums">
                Available: {formatStrk(accountBalance)}
                <button
                  type="button"
                  onClick={() => {
                    if (accountBalance == null) return
                    const reserve = 10n ** 16n // ~0.01 STRK for gas
                    const max = accountBalance > reserve ? accountBalance - reserve : 0n
                    const whole = max / 10n ** 18n
                    const frac = max % 10n ** 18n
                    const fracStr = frac.toString().padStart(18, "0").slice(0, 4)
                    setAmount(`${whole}.${fracStr}`)
                  }}
                  className="rounded bg-falcon-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-falcon-accent/70 transition-colors hover:bg-falcon-accent/20"
                >
                  Max
                </button>
              </span>
            )}
          </label>
          <input
            id="tx-amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`glass-input mt-2 w-full px-4 py-3 font-mono text-sm text-falcon-text/80 ${
              exceedsBalance ? "!border-falcon-error/30" : ""
            }`}
          />
          {exceedsBalance && accountBalance != null && (
            <p className="mt-1 text-[11px] text-falcon-error/60">
              Insufficient balance &mdash; need {formatStrk(amountWei - accountBalance)} more
            </p>
          )}
          {overHalf && (
            <p className="mt-1 text-[11px] text-amber-400/60">This is more than half your balance</p>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={isBusy || !Option.isSome(keypair) || !recipientValid || exceedsBalance}
          className="rounded-xl bg-gradient-to-b from-falcon-accent to-falcon-accent/80 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-falcon-accent/15 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-falcon-accent/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {txPhase.phase === "prefetching" ? "Preparing..." : isBusy ? "Quantum-signing..." : "Quantum-Sign & Send"}
        </button>
      </div>

      {(txPhase.phase === "signing" || txPhase.phase === "submitting" || txPhase.phase === "confirming") && (
        <TransactionPhases
          phase={txPhase.phase}
          signMs={"signMs" in txPhase ? txPhase.signMs : undefined}
        />
      )}

      {txPhase.phase === "done" && (
        <div className="glass-card-static glass-card-success shield-protected relative mt-5 overflow-hidden rounded-2xl p-5 animate-fade-in animate-success-shimmer">
          <ParticleBurst trigger={txPhase.phase === "done"} />
          <p className="relative z-10 text-sm font-medium text-falcon-success/80">Quantum-Safe Transaction Confirmed</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-falcon-success/10 px-2.5 py-1 text-xs font-medium tabular-nums text-falcon-success/80">
              Signed in {formatMs(txPhase.signMs)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-falcon-accent/10 px-2.5 py-1 text-xs font-medium tabular-nums text-falcon-accent/80">
              Network in {formatMs(txPhase.networkMs)}
            </span>
          </div>
          <p className="mt-3 break-all font-mono tabular-nums text-xs text-falcon-text/50">
            Tx: {txPhase.txHash}
          </p>
          <ExplorerLink baseUrl={networkConfig.explorerBaseUrl} txHash={txPhase.txHash} className="mt-3" />
        </div>
      )}

      {txPhase.phase === "error" && (
        <div className="glass-card-static glass-card-error mt-5 rounded-2xl p-5 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-falcon-error/80">{txPhase.message}</p>
              {txPhase.message.toLowerCase().includes("wasm") && (
                <p className="mt-1 text-xs text-falcon-text/35">Try refreshing the page.</p>
              )}
            </div>
            <button
              onClick={() => setTxPhase({ phase: "idle" })}
              className="glass-btn shrink-0 rounded-lg px-3 py-1 text-xs text-falcon-text/40 hover:text-falcon-text/70"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatStrk(wei: bigint): string {
  const whole = wei / 10n ** 18n
  const frac = wei % 10n ** 18n
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4)
  return `${whole}.${fracStr} STRK`
}
