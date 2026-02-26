"use client"

import React, { useCallback, useRef, useState } from "react"
import { Exit, Option } from "effect"
import { useAtomValue } from "@effect-atom/atom-react"
import { keypairAtom } from "@/atoms/falcon"
import { networkAtom } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import { StarknetService } from "@/services/StarknetService"
import { FalconSigner } from "@/services/FalconSigner"
import { extractUserMessage } from "@/services/error-messages"
import { ExplorerLink } from "@/components/ui/ExplorerLink"
import { TransactionPhases } from "@/components/ui/TransactionPhases"
import type { ContractAddress } from "@/services/types"
import type { ManagedRuntime } from "effect"
import type { FalconService } from "@/services/FalconService"

type TxPhase =
  | { phase: "idle" }
  | { phase: "signing"; startedAt: number }
  | { phase: "submitting"; signMs: number; startedAt: number }
  | { phase: "confirming"; signMs: number; submitMs: number; txHash: string; startedAt: number }
  | { phase: "done"; signMs: number; confirmMs: number; txHash: string }
  | { phase: "error"; message: string }

interface SendTransactionProps {
  readonly deployedAddress: ContractAddress
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly deployRuntime: ManagedRuntime.ManagedRuntime<FalconService | StarknetService, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly falconRuntime: ManagedRuntime.ManagedRuntime<FalconService, any>
}

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

  // Use ref so the signer callback can update phase without stale closures
  const phaseRef = useRef(txPhase)
  phaseRef.current = txPhase

  const handleSend = useCallback(async () => {
    const kp = Option.match(keypair, { onNone: () => null, onSome: (k) => k })
    if (!kp) return

    const t0 = performance.now()
    setTxPhase({ phase: "signing", startedAt: t0 })

    const signer = new FalconSigner(
      kp.secretKey,
      kp.publicKeyNtt,
      falconRuntime,
      (signMs) => {
        setTxPhase({ phase: "submitting", signMs, startedAt: performance.now() })
      },
    )

    const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18))

    // Phase 1+2: sign + submit (account.execute does both internally)
    const executeExit = await deployRuntime.runPromiseExit(
      StarknetService.executeTransaction(
        deployedAddress as string,
        signer,
        recipient,
        amountWei,
      ),
    )

    if (Exit.isFailure(executeExit)) {
      setTxPhase({ phase: "error", message: extractUserMessage(executeExit, "Transaction failed") })
      return
    }

    const { txHash } = executeExit.value
    const current = phaseRef.current
    const signMs = current.phase === "submitting" ? current.signMs : performance.now() - t0
    const submitMs = current.phase === "submitting" ? performance.now() - current.startedAt : 0
    const confirmStart = performance.now()

    setTxPhase({ phase: "confirming", signMs, submitMs, txHash, startedAt: confirmStart })

    // Phase 3: wait for on-chain confirmation
    const waitExit = await deployRuntime.runPromiseExit(
      StarknetService.waitForTx(txHash),
    )

    if (Exit.isFailure(waitExit)) {
      setTxPhase({ phase: "error", message: extractUserMessage(waitExit, "Transaction confirmation failed") })
      return
    }

    const confirmMs = performance.now() - confirmStart
    setTxPhase({ phase: "done", signMs, confirmMs, txHash })
  }, [keypair, deployedAddress, recipient, amount, deployRuntime, falconRuntime])

  const isBusy = txPhase.phase === "signing" || txPhase.phase === "submitting" || txPhase.phase === "confirming"

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
          signMs={txPhase.phase !== "signing" && "signMs" in txPhase ? txPhase.signMs : undefined}
          submitMs={txPhase.phase === "confirming" ? txPhase.submitMs : undefined}
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
              Confirmed in {formatMs(txPhase.confirmMs)}
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
