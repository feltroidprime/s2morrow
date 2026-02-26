"use client"

import React, { useCallback, useState } from "react"
import { Exit, Option } from "effect"
import { useAtomValue } from "@effect-atom/atom-react"
import { keypairAtom } from "@/atoms/falcon"
import { networkAtom } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import { StarknetService } from "@/services/StarknetService"
import { FalconSigner } from "@/services/FalconSigner"
import { extractUserMessage } from "@/services/error-messages"
import { ExplorerLink } from "@/components/ui/ExplorerLink"
import type { ContractAddress } from "@/services/types"
import type { ManagedRuntime } from "effect"
import type { FalconService } from "@/services/FalconService"

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
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ txHash: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSend = useCallback(async () => {
    const kp = Option.match(keypair, { onNone: () => null, onSome: (k) => k })
    if (!kp) return

    setSending(true)
    setError(null)
    setResult(null)

    const signer = new FalconSigner(kp.secretKey, kp.publicKeyNtt, falconRuntime)
    const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18))

    const exit = await deployRuntime.runPromiseExit(
      StarknetService.sendTransaction(
        deployedAddress as string,
        signer,
        recipient,
        amountWei,
      ),
    )

    setSending(false)

    if (Exit.isSuccess(exit)) {
      setResult({ txHash: exit.value.txHash })
    } else {
      setError(extractUserMessage(exit, "Transaction failed"))
    }
  }, [keypair, deployedAddress, recipient, amount, deployRuntime, falconRuntime])

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
          disabled={sending || !Option.isSome(keypair)}
          className="rounded-xl bg-gradient-to-b from-falcon-accent to-falcon-accent/80 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-falcon-accent/15 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-falcon-accent/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {sending ? "Sending..." : "Send STRK"}
        </button>
      </div>

      {sending && (
        <div className="glass-card-static glass-card-active mt-5 rounded-2xl p-5 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 animate-pulse-glow rounded-full bg-falcon-accent" />
            <p className="text-sm font-medium text-falcon-text/80">Sending STRK...</p>
          </div>
          <p className="mt-2 text-xs text-falcon-text/30">
            Signing with your Falcon key and submitting to the network.
          </p>
        </div>
      )}

      {result !== null && (
        <div className="glass-card-static glass-card-success mt-5 rounded-2xl p-5 animate-fade-in">
          <p className="text-sm font-medium text-falcon-success/80">Transaction Confirmed</p>
          <p className="mt-2 break-all font-mono tabular-nums text-xs text-falcon-text/50">
            Tx: {result.txHash}
          </p>
          <ExplorerLink baseUrl={networkConfig.explorerBaseUrl} txHash={result.txHash} className="mt-3" />
        </div>
      )}

      {error !== null && (
        <div className="glass-card-static glass-card-error mt-5 rounded-2xl p-5 animate-fade-in">
          <p className="text-sm text-falcon-error/80">{error}</p>
        </div>
      )}
    </div>
  )
}
