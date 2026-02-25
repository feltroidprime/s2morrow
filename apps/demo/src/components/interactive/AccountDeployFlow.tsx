"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Cause, Exit, Layer, ManagedRuntime, Option } from "effect"
import { keypairAtom } from "@/atoms/falcon"
import {
  deployStepAtom,
  deployedAddressAtom,
  deployTxHashAtom,
  networkAtom,
} from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import type { NetworkConfig } from "@/config/networks"
import { FalconService } from "@/services/FalconService"
import { FalconSigner } from "@/services/FalconSigner"
import { StarknetService } from "@/services/StarknetService"
import { WasmRuntimeLive } from "@/services/WasmRuntime"
import type { DevnetAccount } from "@/services/types"
import { SendTransaction } from "./SendTransaction"
import type { PreparedAccountDeploy } from "./accountDeployPipeline"
import {
  deployAccountEffect,
  prepareAccountDeployEffect,
} from "./accountDeployPipeline"

const falconRuntime = ManagedRuntime.make(
  FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
)

function createDeployRuntime(config: NetworkConfig) {
  return ManagedRuntime.make(
    Layer.mergeAll(
      FalconService.Default.pipe(Layer.provide(WasmRuntimeLive)),
      StarknetService.make(config.rpcUrl, config.classHash),
    ),
  )
}

const extractFailureMessage = <A, E extends { readonly message: string }>(
  exit: Exit.Exit<A, E>,
  fallback: string,
): string => {
  if (Exit.isSuccess(exit)) {
    return fallback
  }
  const failure = Cause.failureOption(exit.cause)
  return Option.match(failure, {
    onNone: () => fallback,
    onSome: (error) => error.message,
  })
}

export function AccountDeployFlow(): React.JSX.Element {
  const keypair = useAtomValue(keypairAtom)
  const deployStep = useAtomValue(deployStepAtom)
  const setKeypair = useAtomSet(keypairAtom)
  const setDeployStep = useAtomSet(deployStepAtom)
  const setDeployedAddress = useAtomSet(deployedAddressAtom)
  const setDeployTxHash = useAtomSet(deployTxHashAtom)
  const networkId = useAtomValue(networkAtom)
  const networkConfig = NETWORKS[networkId]

  // Runtime ref — rebuild synchronously when network changes
  const deployRuntimeRef = useRef(createDeployRuntime(networkConfig))
  const prevNetworkRef = useRef(networkId)
  if (prevNetworkRef.current !== networkId) {
    prevNetworkRef.current = networkId
    deployRuntimeRef.current = createDeployRuntime(networkConfig)
  }

  const [privateKey, setPrivateKey] = useState("")
  const [devnetAccounts, setDevnetAccounts] = useState<DevnetAccount[]>([])
  const [preparedDeploy, setPreparedDeploy] =
    useState<Option.Option<PreparedAccountDeploy>>(Option.none())
  const [balance, setBalance] = useState<bigint | null>(null)

  // Reset deploy state when network changes
  useEffect(() => {
    setDeployStep({ step: "idle" })
    setPreparedDeploy(Option.none())
    setBalance(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId])

  // Fetch prefunded accounts on devnet
  useEffect(() => {
    if (!networkConfig.isDevnet) {
      setDevnetAccounts([])
      return
    }
    let cancelled = false
    const fetchAccounts = async () => {
      const exit = await deployRuntimeRef.current.runPromiseExit(
        StarknetService.fetchPrefundedAccounts(),
      )
      if (!cancelled && Exit.isSuccess(exit)) {
        setDevnetAccounts(exit.value)
        if (exit.value.length > 0) {
          setPrivateKey(exit.value[0].private_key)
        }
      }
    }
    fetchAccounts()
    return () => { cancelled = true }
  }, [networkConfig.isDevnet])

  const hasKeypair = Option.isSome(keypair)

  useEffect(() => {
    if (deployStep.step !== "awaiting-funds") {
      setBalance(null)
      return
    }

    let cancelled = false

    const poll = async () => {
      const exit = await deployRuntimeRef.current.runPromiseExit(
        StarknetService.getBalance(deployStep.address),
      )
      if (!cancelled && Exit.isSuccess(exit)) {
        setBalance(exit.value)
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [deployStep])

  const handlePrepare = useCallback(async () => {
    setDeployStep({ step: hasKeypair ? "packing" : "generating-keypair" })
    setDeployTxHash(Option.none())
    setDeployedAddress(Option.none())
    setPreparedDeploy(Option.none())

    const prepareExit = await deployRuntimeRef.current.runPromiseExit(
      prepareAccountDeployEffect({
        privateKey,
        existingKeypair: keypair,
      }),
    )

    if (Exit.isFailure(prepareExit)) {
      setDeployStep({
        step: "error",
        message: extractFailureMessage(prepareExit, "Failed to prepare deployment"),
      })
      return
    }

    const prepared = prepareExit.value
    setPreparedDeploy(Option.some(prepared))
    setKeypair(Option.some(prepared.keypair))
    setDeployStep({ step: "awaiting-funds", address: prepared.address })
  }, [
    hasKeypair,
    keypair,
    privateKey,
    setDeployStep,
    setDeployTxHash,
    setDeployedAddress,
    setKeypair,
  ])

  const handleDeploy = useCallback(async () => {
    const prepared = Option.match(preparedDeploy, {
      onNone: () => null,
      onSome: (value) => value,
    })
    if (prepared === null) {
      setDeployStep({
        step: "error",
        message: "Prepare the deployment before submitting.",
      })
      return
    }

    setDeployStep({ step: "deploying", address: prepared.address })
    const signer = new FalconSigner(
      prepared.keypair.secretKey,
      prepared.keypair.publicKeyNtt,
      falconRuntime,
    )
    const deployExit = await deployRuntimeRef.current.runPromiseExit(
      deployAccountEffect({
        address: prepared.address,
        packedPublicKey: prepared.packedPublicKey,
        signer,
        salt: prepared.salt,
        requiredBalance: 1n,
      }),
    )

    if (Exit.isFailure(deployExit)) {
      setDeployStep({
        step: "error",
        message: extractFailureMessage(deployExit, "Account deployment failed"),
      })
      return
    }

    setDeployTxHash(Option.some(deployExit.value.txHash))
    setDeployedAddress(Option.some(deployExit.value.address))
    setDeployStep({
      step: "deployed",
      txHash: deployExit.value.txHash,
      address: deployExit.value.address,
    })
  }, [preparedDeploy, setDeployStep, setDeployTxHash, setDeployedAddress])

  const handleReset = useCallback(() => {
    setPreparedDeploy(Option.none())
    setDeployTxHash(Option.none())
    setDeployedAddress(Option.none())
    setDeployStep({ step: "idle" })
  }, [setDeployStep, setDeployTxHash, setDeployedAddress])

  const stepFlags = useMemo(() => {
    const stepName = deployStep.step

    const step1Complete =
      hasKeypair ||
      stepName === "packing" ||
      stepName === "computing-address" ||
      stepName === "awaiting-funds" ||
      stepName === "deploying" ||
      stepName === "deployed"

    const step2Complete =
      stepName === "computing-address" ||
      stepName === "awaiting-funds" ||
      stepName === "deploying" ||
      stepName === "deployed"

    const step3Complete =
      stepName === "awaiting-funds" ||
      stepName === "deploying" ||
      stepName === "deployed"

    const step4Complete = stepName === "deploying" || stepName === "deployed"
    const step5Complete = stepName === "deployed"

    return {
      step1Active: stepName === "generating-keypair",
      step2Active: stepName === "packing",
      step3Active: stepName === "computing-address",
      step4Active: stepName === "awaiting-funds",
      step5Active: stepName === "deploying",
      step1Complete,
      step2Complete,
      step3Complete,
      step4Complete,
      step5Complete,
    }
  }, [deployStep.step, hasKeypair])

  const liveStatus = useMemo(() => {
    switch (deployStep.step) {
      case "idle":
        return "Account deploy flow is idle."
      case "generating-keypair":
        return "Generating Falcon keypair."
      case "packing":
        return "Packing Falcon public key."
      case "computing-address":
        return "Computing Starknet deploy address."
      case "awaiting-funds":
        return `Waiting for funds at ${deployStep.address}.`
      case "deploying":
        return "Deploying account transaction."
      case "deployed":
        return `Account deployed with transaction hash ${deployStep.txHash}.`
      case "error":
        return deployStep.message
    }
  }, [deployStep])

  return (
    <section id="deploy" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight text-falcon-text">Account Deploy Flow</h2>
        <p className="mt-4 text-falcon-muted">
          Deploy a Falcon-powered account to Starknet {networkConfig.name} with the same keypair used in
          the verification playground.
        </p>
        {networkConfig.classHash === "0x0" && (
          <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-400">
              FalconAccount not declared on {networkConfig.name}.
              Run: <code className="rounded bg-falcon-bg px-1 font-mono text-xs">./bin/declare.sh {networkConfig.id}</code>
            </p>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {liveStatus}
        </p>

        <div className="mt-8 space-y-4">
          <DeployStepIndicator
            number={1}
            title="Generate Keypair"
            description="Create or reuse a Falcon-512 keypair."
            active={stepFlags.step1Active}
            complete={stepFlags.step1Complete}
          />
          <DeployStepIndicator
            number={2}
            title="Pack Public Key"
            description="Compress public key coefficients into 29 felt252 slots."
            active={stepFlags.step2Active}
            complete={stepFlags.step2Complete}
          />
          <DeployStepIndicator
            number={3}
            title="Compute Address"
            description="Compute the account counterfactual address."
            active={stepFlags.step3Active}
            complete={stepFlags.step3Complete}
          />
          <DeployStepIndicator
            number={4}
            title="Fund Account"
            description="Send STRK to the pre-computed address."
            active={stepFlags.step4Active}
            complete={stepFlags.step4Complete}
          >
            {deployStep.step === "awaiting-funds" && (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg bg-falcon-bg p-3">
                  <p className="text-xs uppercase tracking-wide text-falcon-muted">Send STRK to</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all font-mono text-sm text-falcon-accent">
                      {deployStep.address}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(deployStep.address)}
                      className="shrink-0 rounded border border-falcon-muted/30 px-2 py-1 text-xs text-falcon-muted hover:bg-falcon-surface"
                      title="Copy address"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                {networkConfig.isTestnet && !networkConfig.isDevnet && (
                  <a
                    href="https://starknet-faucet.vercel.app/"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-block text-sm text-falcon-accent hover:underline"
                  >
                    Get testnet STRK from the Starknet Faucet &rarr;
                  </a>
                )}
                {balance !== null && (
                  <p className="text-sm text-falcon-muted">
                    Current balance:{" "}
                    <span className={balance > 0n ? "text-falcon-success" : "text-falcon-muted"}>
                      {(Number(balance) / 1e18).toFixed(4)} STRK
                    </span>
                    {balance > 0n && (
                      <span className="ml-2 text-falcon-success">— Ready to deploy!</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </DeployStepIndicator>
          <DeployStepIndicator
            number={5}
            title="Deploy"
            description="Broadcast and confirm deploy transaction."
            active={stepFlags.step5Active}
            complete={stepFlags.step5Complete}
          />
        </div>

        <div className="mt-8 space-y-3">
          {networkConfig.isDevnet && devnetAccounts.length > 0 ? (
            <div>
              <label htmlFor="devnet-account" className="block text-sm font-medium text-falcon-text">
                Deployer Account
              </label>
              <select
                id="devnet-account"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="mt-1 w-full rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 font-mono text-sm text-falcon-text focus:outline-none focus:ring-2 focus:ring-falcon-primary"
              >
                {devnetAccounts.map((acc, i) => (
                  <option key={acc.address} value={acc.private_key}>
                    Account #{i} ({acc.address.slice(0, 10)}...{acc.address.slice(-4)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="deploy-private-key" className="block text-sm font-medium text-falcon-text">
                Deployer Private Key
              </label>
              <input
                id="deploy-private-key"
                type="password"
                autoComplete="off"
                value={privateKey}
                onChange={(event) => setPrivateKey(event.target.value)}
                placeholder="0x..."
                className="w-full rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 font-mono text-sm text-falcon-text placeholder-falcon-muted focus:outline-none focus:ring-2 focus:ring-falcon-primary"
              />
            </div>
          )}

          {deployStep.step === "idle" && (() => {
            const classHashValid = networkConfig.classHash !== "0x0"
            return (
              <button
                onClick={handlePrepare}
                disabled={!classHashValid}
                className={`rounded-lg px-6 py-2.5 text-sm font-semibold ${
                  classHashValid
                    ? "bg-falcon-primary text-falcon-text hover:opacity-90"
                    : "cursor-not-allowed bg-falcon-muted/20 text-falcon-muted"
                }`}
              >
                Prepare Deploy
              </button>
            )
          })()}

          {deployStep.step === "awaiting-funds" && (
            <button
              onClick={handleDeploy}
              className="rounded-lg bg-falcon-accent px-6 py-2.5 text-sm font-semibold text-falcon-text hover:opacity-90"
            >
              Deploy Account
            </button>
          )}
        </div>

        {deployStep.step === "deployed" && (
          <>
            <div
              role="status"
              aria-live="polite"
              className="mt-6 rounded-xl border border-falcon-success/30 bg-falcon-success/10 p-5"
            >
              <h3 className="font-semibold text-falcon-success">Account Deployed</h3>
              <p className="mt-2 break-all font-mono text-xs text-falcon-text">
                Address: {deployStep.address}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-falcon-text">Tx: {deployStep.txHash}</p>
              {networkConfig.explorerBaseUrl && (
                <a
                  href={`${networkConfig.explorerBaseUrl}/tx/${deployStep.txHash}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-block text-sm text-falcon-accent hover:underline"
                >
                  View on Voyager
                </a>
              )}
            </div>
            <SendTransaction
              deployedAddress={deployStep.address}
              deployRuntime={deployRuntimeRef.current}
              falconRuntime={falconRuntime}
            />
          </>
        )}

        {deployStep.step === "error" && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-6 rounded-xl border border-falcon-error/30 bg-falcon-error/10 p-5"
          >
            <p className="text-sm text-falcon-error">{deployStep.message}</p>
            <button
              onClick={handleReset}
              className="mt-3 rounded-lg border border-falcon-muted/30 px-3 py-1 text-xs text-falcon-muted hover:bg-falcon-surface"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

interface DeployStepIndicatorProps {
  readonly number: number
  readonly title: string
  readonly description: string
  readonly active: boolean
  readonly complete: boolean
  readonly children?: React.ReactNode
}

function DeployStepIndicator({
  number,
  title,
  description,
  active,
  complete,
  children,
}: DeployStepIndicatorProps): React.JSX.Element {
  const containerClass = active
    ? "border-falcon-primary ring-2 ring-falcon-primary/20"
    : complete
      ? "border-falcon-success/40"
      : "border-falcon-muted/20"

  const badgeClass = complete
    ? "bg-falcon-success/20 text-falcon-success"
    : active
      ? "bg-falcon-primary/20 text-falcon-primary"
      : "bg-falcon-muted/10 text-falcon-muted"

  return (
    <div className={`rounded-xl border bg-falcon-surface p-4 transition-all ${containerClass}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${badgeClass}`}>
          {complete ? "✓" : number}
        </span>
        <div>
          <h3 className="font-semibold text-falcon-text">{title}</h3>
          <p className="text-sm text-falcon-muted">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
