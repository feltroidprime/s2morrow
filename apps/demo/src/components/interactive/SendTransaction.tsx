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
import type { ContractAddress } from "@/services/types"
import type { ManagedRuntime } from "effect"
import type { FalconService } from "@/services/FalconService"

type TxPhase =
  | { phase: "idle" }
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
  const [txPhase, setTxPhase] = useState<TxPhase>({ phase: "idle" })

  const timingRef = useRef({ signMs: 0, networkStartedAt: 0 })

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
    }
  }, [deployRuntime, deployedAddress])

  useEffect(() => {
    doPrefetch()
  }, [doPrefetch])

  const handleSend = useCallback(async () => {
    const kp = Option.match(keypair, { onNone: () => null, onSome: (k) => k })
    if (!kp) return

    const prefetched = prefetchRef.current
    if (!prefetched) {
      setTxPhase({ phase: "error", message: "Network data not ready. Please try again." })
      doPrefetch()
      return
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
      setTxPhase({ phase: "error", message: extractUserMessage(submitExit, "Transaction failed") })
      doPrefetch()
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
    txPhase.phase === "confirming"

  return (
    <div className="glass-card-static mt-8 rounded-2xl p-6">
      <h3 className="text-base font-semibold tracking-tight text-falcon-text/90">Test Your Falcon Account</h3>
      <p className="mt-1.5 text-xs text-falcon-text/30">
        Send STRK using your post-quantum account.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="tx-recipient" className="block text-xs font-medium text-falcon-text/30">
            Recipient
          </label>
          <input
            id="tx-recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="glass-input mt-2 w-full px-4 py-3 font-mono text-sm text-falcon-text/80"
          />
        </div>

        <div>
          <label htmlFor="tx-amount" className="block text-xs font-medium text-falcon-text/30">
            Amount (STRK)
          </label>
          <input
            id="tx-amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="glass-input mt-2 w-full px-4 py-3 font-mono text-sm text-falcon-text/80"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={isBusy || !Option.isSome(keypair)}
          className="rounded-xl bg-gradient-to-b from-falcon-accent to-falcon-accent/80 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-falcon-accent/15 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-falcon-accent/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {isBusy ? "Sending..." : "Send STRK"}
        </button>
      </div>

      {isBusy && (
        <TransactionPhases
          phase={txPhase.phase as "signing" | "submitting" | "confirming"}
          signMs={"signMs" in txPhase ? txPhase.signMs : undefined}
        />
      )}

      {txPhase.phase === "done" && (
        <div className="glass-card-static glass-card-success mt-5 rounded-2xl p-5 animate-fade-in">
          <p className="text-sm font-medium text-falcon-success/80">Transaction Confirmed</p>
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
          <p className="text-sm text-falcon-error/80">{txPhase.message}</p>
        </div>
      )}
    </div>
  )
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
