"use client"

import React, { useCallback, useState } from "react"
import { Cause, Exit, Option } from "effect"
import { useAtomValue } from "@effect-atom/atom-react"
import { keypairAtom } from "@/atoms/falcon"
import { networkAtom } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import { StarknetService } from "@/services/StarknetService"
import { FalconSigner } from "@/services/FalconSigner"
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
      const errOpt = Cause.failureOption(exit.cause)
      setError(
        Option.match(errOpt, {
          onNone: () => "Transaction failed",
          onSome: (e) => e.message,
        }),
      )
    }
  }, [keypair, deployedAddress, recipient, amount, deployRuntime, falconRuntime])

  return (
    <div className="mt-6 rounded-xl border border-falcon-muted/20 bg-falcon-surface p-5">
      <h3 className="font-semibold text-falcon-text">Test Your Falcon Account</h3>
      <p className="mt-1 text-sm text-falcon-muted">
        Send STRK using your post-quantum account.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="tx-recipient" className="block text-sm font-medium text-falcon-text">
            Recipient
          </label>
          <input
            id="tx-recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="mt-1 w-full rounded-lg border border-falcon-muted/30 bg-falcon-bg px-4 py-2 font-mono text-sm text-falcon-text focus:outline-none focus:ring-2 focus:ring-falcon-primary"
          />
        </div>

        <div>
          <label htmlFor="tx-amount" className="block text-sm font-medium text-falcon-text">
            Amount (STRK)
          </label>
          <input
            id="tx-amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-falcon-muted/30 bg-falcon-bg px-4 py-2 font-mono text-sm text-falcon-text focus:outline-none focus:ring-2 focus:ring-falcon-primary"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !Option.isSome(keypair)}
          className="rounded-lg bg-falcon-accent px-6 py-2.5 text-sm font-semibold text-falcon-text hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send STRK"}
        </button>
      </div>

      {result !== null && (
        <div className="mt-4 rounded-xl border border-falcon-success/30 bg-falcon-success/10 p-4">
          <p className="font-semibold text-falcon-success">Transaction Confirmed</p>
          <p className="mt-1 break-all font-mono text-xs text-falcon-text">
            Tx: {result.txHash}
          </p>
          {networkConfig.explorerBaseUrl && (
            <a
              href={`${networkConfig.explorerBaseUrl}/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-block text-sm text-falcon-accent hover:underline"
            >
              View on Voyager
            </a>
          )}
        </div>
      )}

      {error !== null && (
        <div className="mt-4 rounded-xl border border-falcon-error/30 bg-falcon-error/10 p-4">
          <p className="text-sm text-falcon-error">{error}</p>
        </div>
      )}
    </div>
  )
}
