"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Exit, Layer, ManagedRuntime, Option } from "effect"
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
import { extractUserMessage } from "@/services/error-messages"
import { AddressDisplay } from "@/components/ui/AddressDisplay"
import { ExplorerLink } from "@/components/ui/ExplorerLink"
import { TokenAmount } from "@/components/ui/TokenAmount"
import { TransactionPending } from "@/components/ui/TransactionPending"
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


export function AccountDeployFlow(): React.JSX.Element {
  const keypair = useAtomValue(keypairAtom)
  const deployStep = useAtomValue(deployStepAtom)
  const setKeypair = useAtomSet(keypairAtom)
  const setDeployStep = useAtomSet(deployStepAtom)
  const setDeployedAddress = useAtomSet(deployedAddressAtom)
  const setDeployTxHash = useAtomSet(deployTxHashAtom)
  const networkId = useAtomValue(networkAtom)
  const networkConfig = NETWORKS[networkId]

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

  useEffect(() => {
    setDeployStep({ step: "idle" })
    setPreparedDeploy(Option.none())
    setBalance(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId])

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
        message: extractUserMessage(prepareExit, "Failed to prepare deployment"),
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
        message: extractUserMessage(deployExit, "Account deployment failed"),
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

  const DEPLOY_STEPS = [
    { number: 1, title: "Generate Keypair", description: "Create or reuse a Falcon-512 keypair.", active: stepFlags.step1Active, complete: stepFlags.step1Complete },
    { number: 2, title: "Pack Public Key", description: "Compress public key into 29 felt252 slots.", active: stepFlags.step2Active, complete: stepFlags.step2Complete },
    { number: 3, title: "Compute Address", description: "Compute the counterfactual address.", active: stepFlags.step3Active, complete: stepFlags.step3Complete },
    { number: 4, title: "Fund Account", description: "Send STRK to the pre-computed address.", active: stepFlags.step4Active, complete: stepFlags.step4Complete },
    { number: 5, title: "Deploy", description: "Broadcast and confirm deploy transaction.", active: stepFlags.step5Active, complete: stepFlags.step5Complete },
  ]

  return (
    <section id="deploy" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">Account Deploy Flow</h2>
        <p className="mt-4 text-sm leading-relaxed text-falcon-text/40">
          Deploy a Falcon-powered account to Starknet {networkConfig.name} with the same keypair used in
          the verification playground.
        </p>
        {networkConfig.classHash === "0x0" && (
          <div className="glass-card-static glass-card-warning mt-6 rounded-2xl p-5">
            <p className="text-sm text-yellow-400/80">
              FalconAccount not declared on {networkConfig.name}.
              Run: <code className="glass-display rounded-md px-1.5 py-0.5 font-mono text-xs">./bin/declare.sh {networkConfig.id}</code>
            </p>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {liveStatus}
        </p>

        {/* Vertical progress line with step cards */}
        <div className="relative mt-10 space-y-0">
          {/* Vertical line */}
          <div
            className="absolute left-[19px] top-4 bottom-4 w-px bg-falcon-muted/15"
          />

          {DEPLOY_STEPS.map((s, i) => (
            <div key={s.number} className="relative flex items-start gap-5 py-3">
              {/* Step dot/check on the line */}
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                    s.complete
                      ? "bg-falcon-success/15 text-falcon-success"
                      : s.active
                        ? "bg-falcon-primary/15 text-falcon-primary shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                        : "text-falcon-text/40 bg-falcon-muted/10 border border-falcon-muted/20"
                  }`}
                >
                  {s.complete ? "\u2713" : s.number}
                </div>
              </div>

              {/* Step content */}
              <div className="flex-1 pb-2">
                <h3 className={`text-sm font-semibold transition-colors duration-200 ${
                  s.active ? "text-falcon-text" : s.complete ? "text-falcon-text/60" : "text-falcon-text/40"
                }`}>
                  {s.title}
                </h3>
                <p className="mt-0.5 text-xs text-falcon-text/25">{s.description}</p>

                {/* Fund Account expanded content */}
                {s.number === 4 && deployStep.step === "awaiting-funds" && (
                  <div className="mt-4 space-y-3">
                    <div className="glass-card-static rounded-xl p-4">
                      <p className="text-[10px] font-medium tracking-widest text-falcon-text/20 uppercase">Send STRK to</p>
                      <AddressDisplay
                        address={deployStep.address}
                        explorerBaseUrl={networkConfig.explorerBaseUrl}
                        className="mt-2"
                      />
                    </div>
                    {networkConfig.isTestnet && !networkConfig.isDevnet && (
                      <a
                        href="https://starknet-faucet.vercel.app/"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-block text-xs text-falcon-accent/60 transition-colors duration-200 hover:text-falcon-accent"
                      >
                        Get testnet STRK from the Starknet Faucet &rarr;
                      </a>
                    )}
                    {balance !== null && (
                      <div className="flex items-center gap-2 text-xs text-falcon-text/30">
                        <span>Balance:</span>
                        <TokenAmount amount={balance} className={balance > 0n ? "text-falcon-success/80" : "text-falcon-text/30"} />
                        {balance > 0n && (
                          <span className="text-falcon-success/60">Ready to deploy</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          {networkConfig.isDevnet && devnetAccounts.length > 0 ? (
            <div>
              <label htmlFor="devnet-account" className="block text-xs font-medium text-falcon-text/30">
                Deployer Account
              </label>
              <select
                id="devnet-account"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="glass-select mt-2 w-full px-4 py-3 font-mono text-sm text-falcon-text/80"
              >
                {devnetAccounts.map((acc, i) => (
                  <option key={acc.address} value={acc.private_key}>
                    Account #{i} ({acc.address.slice(0, 10)}...{acc.address.slice(-4)})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {deployStep.step === "idle" && (() => {
            const classHashValid = networkConfig.classHash !== "0x0"
            return (
              <button
                onClick={handlePrepare}
                disabled={!classHashValid}
                className={`rounded-xl px-7 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-primary/40 ${
                  classHashValid
                    ? "bg-gradient-to-b from-falcon-primary to-falcon-primary/80 text-white shadow-md shadow-falcon-primary/15 hover:scale-[1.02] hover:shadow-lg hover:shadow-falcon-primary/20"
                    : "glass-btn cursor-not-allowed opacity-40 text-falcon-text/40"
                }`}
              >
                Prepare Deploy
              </button>
            )
          })()}

          {deployStep.step === "awaiting-funds" && (
            <button
              onClick={handleDeploy}
              className="rounded-xl bg-gradient-to-b from-falcon-accent to-falcon-accent/80 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-falcon-accent/15 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-falcon-accent/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent/40"
            >
              Deploy Account
            </button>
          )}
        </div>

        {deployStep.step === "deploying" && (
          <TransactionPending
            title="Deploying account..."
            subtitle={`Signing with Falcon-512 and submitting to ${networkConfig.name}`}
          />
        )}

        {deployStep.step === "deployed" && (
          <>
            <div
              role="status"
              aria-live="polite"
              className="glass-card-static glass-card-success mt-8 rounded-2xl p-6 animate-fade-in"
            >
              <h3 className="text-sm font-semibold text-falcon-success/80">Account Deployed</h3>
              <AddressDisplay
                label="Address"
                address={deployStep.address}
                explorerBaseUrl={networkConfig.explorerBaseUrl}
                className="mt-3"
              />
              <p className="mt-2 break-all font-mono tabular-nums text-xs text-falcon-text/50">
                Tx: {deployStep.txHash}
              </p>
              <ExplorerLink baseUrl={networkConfig.explorerBaseUrl} txHash={deployStep.txHash} className="mt-3" />
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
            className="glass-card-static glass-card-error mt-8 rounded-2xl p-6 animate-fade-in"
          >
            <p className="text-sm text-falcon-error/80">{deployStep.message}</p>
            <button
              onClick={handleReset}
              className="glass-btn mt-4 rounded-lg px-4 py-1.5 text-xs text-falcon-text/40 hover:text-falcon-text/70"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
