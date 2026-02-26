"use client"

import React, { useCallback, useEffect, useRef } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import {
  pipelineStepsAtom,
  pipelineActiveStepAtom,
  pipelinePlayingAtom,
  INITIAL_PIPELINE_STEPS,
} from "@/atoms/pipeline"
import type { PipelineStep } from "@/services/types"

const PHASE_LABELS: Record<string, string> = {
  client: "Client",
  validation: "Validation Phase",
  execution: "Execution Phase",
  settlement: "Settlement",
}

const PHASE_COLORS: Record<string, { dot: string; text: string; badge: string }> = {
  client: {
    dot: "bg-falcon-accent/15 text-falcon-accent",
    text: "text-falcon-accent/60",
    badge: "bg-falcon-accent/10 text-falcon-accent/70",
  },
  validation: {
    dot: "bg-falcon-primary/15 text-falcon-primary",
    text: "text-falcon-primary/60",
    badge: "bg-falcon-primary/10 text-falcon-primary/70",
  },
  execution: {
    dot: "bg-falcon-success/15 text-falcon-success",
    text: "text-falcon-success/60",
    badge: "bg-falcon-success/10 text-falcon-success/70",
  },
  settlement: {
    dot: "bg-amber-500/15 text-amber-500",
    text: "text-amber-500/60",
    badge: "bg-amber-500/10 text-amber-500/70",
  },
}

export function PipelineVisualizer(): React.JSX.Element {
  const steps = useAtomValue(pipelineStepsAtom)
  const activeStep = useAtomValue(pipelineActiveStepAtom)
  const playing = useAtomValue(pipelinePlayingAtom)

  const setSteps = useAtomSet(pipelineStepsAtom)
  const setActiveStep = useAtomSet(pipelineActiveStepAtom)
  const setPlaying = useAtomSet(pipelinePlayingAtom)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setActiveStep((prev) => {
        const next = prev + 1
        if (next >= steps.length) {
          setPlaying(false)
          setSteps((s) =>
            s.map((step, i) =>
              i === prev ? { ...step, status: "complete" as const } : step,
            ),
          )
          return prev
        }
        setSteps((s) =>
          s.map((step, i) => {
            if (i === prev) return { ...step, status: "complete" as const }
            if (i === next) return { ...step, status: "active" as const }
            return step
          }),
        )
        return next
      })
    }, 2500)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playing, steps.length, setActiveStep, setSteps, setPlaying])

  const handlePlay = useCallback(() => {
    if (activeStep === -1) {
      setSteps((s) =>
        s.map((step, i) =>
          i === 0
            ? { ...step, status: "active" as const }
            : { ...step, status: "pending" as const },
        ),
      )
      setActiveStep(0)
    }
    setPlaying(true)
  }, [activeStep, setSteps, setActiveStep, setPlaying])

  const handlePause = useCallback(() => {
    setPlaying(false)
  }, [setPlaying])

  const handleStep = useCallback(() => {
    setPlaying(false)
    setActiveStep((prev) => {
      const next = prev + 1
      if (next >= steps.length) {
        setSteps((s) =>
          s.map((step, i) =>
            i === prev ? { ...step, status: "complete" as const } : step,
          ),
        )
        return prev
      }
      if (prev === -1) {
        setSteps((s) =>
          s.map((step, i) =>
            i === 0
              ? { ...step, status: "active" as const }
              : { ...step, status: "pending" as const },
          ),
        )
        return 0
      }
      setSteps((s) =>
        s.map((step, i) => {
          if (i === prev) return { ...step, status: "complete" as const }
          if (i === next) return { ...step, status: "active" as const }
          return step
        }),
      )
      return next
    })
  }, [steps.length, setActiveStep, setSteps, setPlaying])

  const handleReset = useCallback(() => {
    setPlaying(false)
    setActiveStep(-1)
    setSteps(INITIAL_PIPELINE_STEPS)
  }, [setPlaying, setActiveStep, setSteps])

  const allComplete = steps.every((s) => s.status === "complete")

  return (
    <section id="pipeline" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
              What happens on-chain
            </h2>
            <p className="mt-3 text-sm text-falcon-text/50">
              How a Falcon-512 transaction flows through Starknet&apos;s account abstraction model
            </p>
          </div>
        </div>

        {/* Glass toolbar */}
        <div
          className="glass-btn mt-8 inline-flex items-center gap-1 rounded-full p-1"
        >
          {!playing ? (
            <button
              onClick={handlePlay}
              disabled={allComplete}
              aria-label="Play pipeline animation"
              className="rounded-full bg-gradient-to-b from-falcon-primary to-falcon-primary/80 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Play
            </button>
          ) : (
            <button
              onClick={handlePause}
              aria-label="Pause pipeline animation"
              className="rounded-full bg-gradient-to-b from-falcon-primary to-falcon-primary/80 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-primary/40"
            >
              Pause
            </button>
          )}
          <button
            onClick={handleStep}
            disabled={playing || allComplete}
            aria-label="Advance one pipeline step"
            className="rounded-full px-4 py-2 text-xs font-medium text-falcon-text/50 transition-all duration-200 hover:text-falcon-text/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Step
          </button>
          <button
            onClick={handleReset}
            aria-label="Reset pipeline to beginning"
            className="rounded-full px-4 py-2 text-xs font-medium text-falcon-text/50 transition-all duration-200 hover:text-falcon-text/80"
          >
            Reset
          </button>
        </div>

        {/* Vertical pipeline flow */}
        <div className="relative mt-8 space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-falcon-muted/15" />

          {steps.map((step, i) => {
            const prevPhase = i > 0 ? steps[i - 1].phase : null
            const showPhaseLabel = step.phase && step.phase !== prevPhase
            return (
              <div key={step.id}>
                {showPhaseLabel && (
                  <div className="relative flex items-center gap-3 pb-2 pt-4 first:pt-0">
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center" />
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold tracking-widest uppercase ${PHASE_COLORS[step.phase!]?.badge ?? "bg-falcon-text/5 text-falcon-text/40"}`}
                    >
                      {PHASE_LABELS[step.phase!] ?? step.phase}
                    </span>
                  </div>
                )}
                <PipelineStepCard step={step} index={i} />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PipelineStepCard({ step, index }: { step: PipelineStep; index: number }): React.JSX.Element {
  const isActive = step.status === "active"
  const isComplete = step.status === "complete"
  const phase = step.phase ?? "validation"
  const colors = PHASE_COLORS[phase] ?? PHASE_COLORS.validation

  return (
    <div className="relative flex items-start gap-5 py-3">
      {/* Step dot on the line */}
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
            isComplete
              ? "bg-falcon-success/15 text-falcon-success"
              : isActive
                ? `${colors.dot} shadow-[0_0_12px_rgba(99,102,241,0.3)]`
                : "text-falcon-text/40 bg-falcon-muted/10 border border-falcon-muted/20"
          }`}
        >
          {isComplete ? "\u2713" : index + 1}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-3">
          <h3
            className={`font-mono text-sm font-semibold transition-colors duration-200 ${
              isActive
                ? "text-falcon-text"
                : isComplete
                  ? "text-falcon-text/60"
                  : "text-falcon-text/40"
            }`}
          >
            {step.name}
          </h3>
          {step.stepCount > 0 && (
            <span className="tabular-nums font-mono text-[10px] text-falcon-text/25">
              ~{step.stepCount.toLocaleString()} steps
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-falcon-text/30">{step.description}</p>

        {/* Insight — shown when active or complete */}
        {(isActive || isComplete) && step.insight && (
          <div
            className={`mt-3 rounded-xl border px-4 py-3 text-xs leading-relaxed animate-fade-in ${
              isActive
                ? "border-[var(--glass-border-hover)] bg-[var(--glass-bg-heavy)] text-falcon-text/60"
                : "border-[var(--glass-border)] bg-[var(--glass-bg)] text-falcon-text/40"
            }`}
          >
            {step.insight}
          </div>
        )}

        {/* I/O detail — shown when active */}
        {isActive && (
          <div className="mt-3 space-y-1.5 border-t border-[var(--glass-border)] pt-3">
            <div className="text-xs">
              <span className="text-falcon-text/25">In: </span>
              <span className="font-mono text-falcon-text/50">{step.input}</span>
            </div>
            <div className="text-xs">
              <span className="text-falcon-text/25">Out: </span>
              <span className="font-mono text-falcon-text/50">{step.output}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
