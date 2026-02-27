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
    dot: "bg-falcon-accent/10 text-falcon-accent/70",
    text: "text-falcon-accent/40",
    badge: "bg-falcon-accent/6 text-falcon-accent/40 border border-falcon-accent/8",
  },
  validation: {
    dot: "bg-falcon-secondary/10 text-falcon-secondary/70",
    text: "text-falcon-secondary/40",
    badge: "bg-falcon-secondary/6 text-falcon-secondary/40 border border-falcon-secondary/8",
  },
  execution: {
    dot: "bg-falcon-success/10 text-falcon-success/70",
    text: "text-falcon-success/40",
    badge: "bg-falcon-success/6 text-falcon-success/40 border border-falcon-success/8",
  },
  settlement: {
    dot: "bg-falcon-warning/10 text-falcon-warning/70",
    text: "text-falcon-warning/40",
    badge: "bg-falcon-warning/6 text-falcon-warning/40 border border-falcon-warning/8",
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
    <section id="pipeline" className="px-8 py-36 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[0.08em] uppercase text-falcon-text/85 sm:text-4xl">
              What happens on-chain
            </h2>
            <p className="mt-4 text-xs text-falcon-text/75">
              How a Falcon-512 transaction flows through Starknet&apos;s account abstraction model
            </p>
          </div>
        </div>

        {/* Glass toolbar */}
        <div
          className="glass-btn mt-10 inline-flex items-center gap-1 p-1"
        >
          {!playing ? (
            <button
              onClick={handlePlay}
              disabled={allComplete}
              aria-label="Play pipeline animation"
              className="border border-falcon-accent/25 bg-falcon-accent/8 px-5 py-2 text-[11px] font-semibold tracking-wider uppercase text-falcon-accent/80 shadow-[0_0_10px_-3px_rgba(0,255,65,0.1)] transition-all duration-300 hover:bg-falcon-accent/12 hover:border-falcon-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Play
            </button>
          ) : (
            <button
              onClick={handlePause}
              aria-label="Pause pipeline animation"
              className="border border-falcon-accent/25 bg-falcon-accent/8 px-5 py-2 text-[11px] font-semibold tracking-wider uppercase text-falcon-accent/80 shadow-[0_0_10px_-3px_rgba(0,255,65,0.1)] transition-all duration-300 hover:bg-falcon-accent/12 hover:border-falcon-accent/40 active:scale-[0.98]"
            >
              Pause
            </button>
          )}
          <button
            onClick={handleStep}
            disabled={playing || allComplete}
            aria-label="Advance one pipeline step"
            className="px-4 py-2 text-[11px] font-medium tracking-wider uppercase text-falcon-text/55 transition-all duration-300 hover:text-falcon-text/85 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Step
          </button>
          <button
            onClick={handleReset}
            aria-label="Reset pipeline to beginning"
            className="px-4 py-2 text-[11px] font-medium tracking-wider uppercase text-falcon-text/55 transition-all duration-300 hover:text-falcon-text/85"
          >
            Reset
          </button>
        </div>

        {/* Vertical pipeline flow */}
        <div className="relative mt-10 space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-falcon-accent/6" />

          {steps.map((step, i) => {
            const prevPhase = i > 0 ? steps[i - 1].phase : null
            const showPhaseLabel = step.phase && step.phase !== prevPhase
            return (
              <div key={step.id}>
                {showPhaseLabel && (
                  <div className="relative flex items-center gap-3 pb-2 pt-5 first:pt-0">
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center" />
                    <span
                      className={`px-3 py-1 text-[9px] font-semibold tracking-[0.2em] uppercase ${PHASE_COLORS[step.phase!]?.badge ?? "bg-falcon-text/3 text-falcon-text/65 border border-falcon-text/6"}`}
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
          className={`flex h-8 w-8 items-center justify-center text-xs font-semibold transition-all duration-400 ${
            isComplete
              ? "bg-falcon-success/8 text-falcon-success/70 text-glow-success"
              : isActive
                ? `${colors.dot} animate-pulse-glow`
                : "text-falcon-text/65 bg-falcon-muted/4 border border-falcon-muted/8"
          }`}
        >
          {isComplete ? "\u2713" : index + 1}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-3">
          <h3
            className={`text-sm font-semibold transition-colors duration-300 ${
              isActive
                ? "text-falcon-text/85"
                : isComplete
                  ? "text-falcon-text/65"
                  : "text-falcon-text/65"
            }`}
          >
            {step.name}
          </h3>
          {step.stepCount > 0 && (
            <span className="tabular-nums text-[10px] text-falcon-text/40">
              ~{step.stepCount.toLocaleString()} steps
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-falcon-text/55">{step.description}</p>

        {/* Insight — shown when active or complete */}
        {(isActive || isComplete) && step.insight && (
          <div
            className={`mt-4 border px-4 py-3 text-xs leading-relaxed animate-fade-in ${
              isActive
                ? "border-falcon-accent/8 bg-falcon-accent/3 text-falcon-text/65"
                : "border-falcon-accent/4 bg-falcon-accent/2 text-falcon-text/65"
            }`}
          >
            {step.insight}
          </div>
        )}

        {/* I/O detail — shown when active */}
        {isActive && (
          <div className="mt-4 space-y-2 border-t border-falcon-accent/6 pt-3">
            <div className="text-xs">
              <span className="text-[10px] text-falcon-text/65">In: </span>
              <span className="text-falcon-text/45">{step.input}</span>
            </div>
            <div className="text-xs">
              <span className="text-[10px] text-falcon-text/65">Out: </span>
              <span className="text-falcon-text/45">{step.output}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
