"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Exit, Layer, ManagedRuntime, Option } from "effect"
import { keypairAtom, packedKeyAtom } from "@/atoms/falcon"
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
import { QuantumShield } from "@/components/ui/QuantumShield"
import { ParticleBurst } from "@/components/ui/ParticleBurst"
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
  const packedKey = useAtomValue(packedKeyAtom)
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
  const [postDeployBalance, setPostDeployBalance] = useState<bigint | null>(null)
  const [autoRestoring, setAutoRestoring] = useState(false)
  const [deployStartTime, setDeployStartTime] = useState<number | null>(null)
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [justDeployed, setJustDeployed] = useState(false)

  // ── Auto-restore: if keypair+packedKey exist in localStorage, restore flow state ──
  const autoRestoreRan = useRef(false)
  useEffect(() => {
    if (autoRestoreRan.current) return
    if (!Option.isSome(keypair) || !Option.isSome(packedKey)) return
    if (deployStep.step !== "idle") return
    if (networkConfig.classHash === "0x0") return

    autoRestoreRan.current = true
    setAutoRestoring(true)

    const restore = async () => {
      // Prepare using existing keypair
      const prepareExit = await deployRuntimeRef.current.runPromiseExit(
        prepareAccountDeployEffect({
          privateKey: "",
          existingKeypair: keypair,
        }),
      )

      if (Exit.isFailure(prepareExit)) {
        setAutoRestoring(false)
        return
      }

      const prepared = prepareExit.value
      setPreparedDeploy(Option.some(prepared))

      // Check if already deployed on-chain
      const deployedExit = await deployRuntimeRef.current.runPromiseExit(
        StarknetService.isDeployed(prepared.address),
      )

      if (Exit.isSuccess(deployedExit) && deployedExit.value) {
        // Already deployed — skip straight to deployed state
        setDeployedAddress(Option.some(prepared.address))
        setDeployTxHash(Option.some("already-deployed" as any))
        setDeployStep({
          step: "deployed",
          txHash: "already-deployed" as any,
          address: prepared.address,
        })
        setAutoRestoring(false)
        return
      }

      // Not deployed — check balance and go to awaiting-funds
      setDeployStep({ step: "awaiting-funds", address: prepared.address })
      setAutoRestoring(false)
    }

    restore()
  }, [keypair, packedKey, deployStep.step, networkConfig.classHash, setDeployStep, setDeployedAddress, setDeployTxHash])

  // Reset on network change
  useEffect(() => {
    setDeployStep({ step: "idle" })
    setPreparedDeploy(Option.none())
    setBalance(null)
    autoRestoreRan.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId])

  // Reset on keypair change (wallet import/generate)
  const packedKeyValue = Option.getOrUndefined(packedKey)
  useEffect(() => {
    if (!packedKeyValue) return
    setDeployStep({ step: "idle" })
    setPreparedDeploy(Option.none())
    setBalance(null)
    autoRestoreRan.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packedKeyValue])

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

  const pollBalance = useCallback(async (address: string) => {
    const exit = await deployRuntimeRef.current.runPromiseExit(
      StarknetService.getBalance(address),
    )
    if (Exit.isSuccess(exit)) {
      setBalance(exit.value)
      setLastChecked(Date.now())
    }
  }, [])

  useEffect(() => {
    if (deployStep.step !== "awaiting-funds") {
      setBalance(null)
      setLastChecked(null)
      return
    }

    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      await pollBalance(deployStep.address)
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [deployStep, pollBalance])

  const handleRefreshBalance = useCallback(async () => {
    if (deployStep.step !== "awaiting-funds") return
    setIsRefreshing(true)
    await pollBalance(deployStep.address)
    setIsRefreshing(false)
  }, [deployStep, pollBalance])

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
    setDeployStartTime(Date.now())
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
    setDeployStartTime(null)
    setJustDeployed(true)

    // Fetch remaining balance after deploy
    const balExit = await deployRuntimeRef.current.runPromiseExit(
      StarknetService.getBalance(deployExit.value.address),
    )
    if (Exit.isSuccess(balExit)) {
      setPostDeployBalance(balExit.value)
    }

    // Smooth scroll to send section
    setTimeout(() => {
      document.getElementById("send-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 300)
  }, [preparedDeploy, setDeployStep, setDeployTxHash, setDeployedAddress])

  const handleReset = useCallback(() => {
    setPreparedDeploy(Option.none())
    setDeployTxHash(Option.none())
    setDeployedAddress(Option.none())
    setDeployStep({ step: "idle" })
    autoRestoreRan.current = false
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
        return "Generating quantum-safe Falcon keypair."
      case "packing":
        return "Packing Falcon public key."
      case "computing-address":
        return "Computing Starknet deploy address."
      case "awaiting-funds":
        return `Waiting for funds at ${deployStep.address}.`
      case "deploying":
        return "Deploying quantum-safe account."
      case "deployed":
        return `Quantum account deployed with transaction hash ${deployStep.txHash}.`
      case "error":
        return deployStep.message
    }
  }, [deployStep])

  const isAlreadyDeployed = deployStep.step === "deployed" && deployStep.txHash === "already-deployed"

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
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">Deploy your own quantum-safe account</h2>
        <p className="mt-4 text-sm leading-relaxed text-falcon-text/50">
          Deploy a Falcon-powered account to Starknet {networkConfig.name} &mdash; takes about 60 seconds.
          Uses the same keypair from the playground above.
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

        {/* Auto-restore loading state */}
        {autoRestoring && (
          <div className="mt-8 flex items-center gap-3 text-sm text-falcon-text/40">
            <QuantumShield size="sm" />
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-falcon-primary/30 border-t-falcon-primary" />
            Restoring your quantum-safe wallet...
          </div>
        )}

        {/* Vertical progress line with step cards */}
        {!autoRestoring && (
          <div className="relative mt-10 space-y-0">
            {/* Vertical energy conduit */}
            <div
              className="absolute left-[19px] top-4 bottom-4 energy-conduit"
            />

            {DEPLOY_STEPS.map((s) => (
              <div key={s.number} className="relative flex items-start gap-5 py-3">
                {/* Step dot/check on the line */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                      s.complete
                        ? "bg-falcon-success/15 text-falcon-success animate-node-complete animate-pop-in"
                        : s.active
                          ? "bg-falcon-primary/15 text-falcon-primary shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                          : "text-falcon-text/40 bg-falcon-muted/10 border border-falcon-muted/20"
                    }`}
                  >
                    {s.complete ? "\u2713" : s.number}
                  </div>
                  {s.active && <span className="quantum-scan-line" />}
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
                          <button
                            onClick={handleRefreshBalance}
                            disabled={isRefreshing}
                            className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-falcon-text/25 transition-colors hover:text-falcon-text/50 disabled:opacity-40"
                            title="Refresh balance"
                          >
                            {isRefreshing ? (
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-falcon-text/20 border-t-falcon-text/50" />
                            ) : (
                              "Refresh"
                            )}
                          </button>
                          {lastChecked != null && (
                            <LastCheckedAgo timestamp={lastChecked} />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!autoRestoring && (
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
        )}

        {deployStep.step === "deploying" && (
          <TransactionPending
            title="Deploying quantum-safe account..."
            subtitle="Falcon-512 post-quantum signature in progress..."
            startTime={deployStartTime ?? undefined}
            hint="Quantum-safe verification takes ~30-60s on testnet"
          />
        )}

        {deployStep.step === "deployed" && (
          <>
            <div
              role="status"
              aria-live="polite"
              className="glass-card-static glass-card-success shield-protected relative mt-8 overflow-hidden rounded-2xl p-6 animate-fade-in animate-success-shimmer"
            >
              <ParticleBurst trigger={justDeployed} />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <QuantumShield animate={!isAlreadyDeployed} />
                  <h3 className="text-sm font-semibold text-falcon-success/80">
                    {isAlreadyDeployed ? "Quantum Account Already Deployed" : "Quantum Account Deployed"}
                  </h3>
                  <span className="status-dot-protected" />
                </div>
                <AddressDisplay
                  label="Address"
                  address={deployStep.address}
                  explorerBaseUrl={networkConfig.explorerBaseUrl}
                  full
                  className="mt-3"
                />
                {!isAlreadyDeployed && (
                  <>
                    <p className="mt-2 break-all font-mono tabular-nums text-xs text-falcon-text/50">
                      Tx: {deployStep.txHash}
                    </p>
                    <ExplorerLink baseUrl={networkConfig.explorerBaseUrl} txHash={deployStep.txHash} className="mt-3" />
                  </>
                )}
                {postDeployBalance != null && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-falcon-text/30">
                    <span>Remaining balance:</span>
                    <TokenAmount amount={postDeployBalance} className="text-falcon-text/50" />
                  </div>
                )}
              </div>
            </div>
            <div id="send-section">
              <SendTransaction
                deployedAddress={deployStep.address}
                deployRuntime={deployRuntimeRef.current}
                falconRuntime={falconRuntime}
              />
            </div>
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

function LastCheckedAgo({ timestamp }: { timestamp: number }) {
  const [ago, setAgo] = useState(0)

  useEffect(() => {
    const tick = () => setAgo(Math.floor((Date.now() - timestamp) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [timestamp])

  return (
    <span className="text-[10px] text-falcon-text/20 tabular-nums">
      {ago}s ago
    </span>
  )
}
