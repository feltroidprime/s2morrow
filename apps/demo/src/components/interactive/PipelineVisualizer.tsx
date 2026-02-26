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

const TOTAL_STEPS = INITIAL_PIPELINE_STEPS.reduce(
  (sum, s) => sum + s.stepCount,
  0,
)

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
    }, 2000)

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
              Verification Pipeline
            </h2>
            <p className="mt-3 text-sm text-falcon-text/40">
              Step through the 6-stage Falcon-512 on-chain verification
            </p>
          </div>
          <span className="font-mono text-xs text-falcon-accent/50">
            ~{TOTAL_STEPS.toLocaleString()} total steps
          </span>
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

        {/* Pipeline step cards */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <PipelineStepCard key={step.id} step={step} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PipelineStepCard({ step }: { step: PipelineStep }): React.JSX.Element {
  const isActive = step.status === "active"
  const isComplete = step.status === "complete"

  return (
    <div
      className={`glass-card-static rounded-3xl p-6 transition-all duration-300 ${isActive ? "glass-card-active" : isComplete ? "glass-card-success" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span>
          {isComplete ? (
            <span className="text-sm text-falcon-success">&#10003;</span>
          ) : isActive ? (
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-falcon-primary shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-falcon-text/10" />
          )}
        </span>
        <h3 className="font-mono text-xs font-semibold text-falcon-text/80">
          {step.name}
        </h3>
        <span className="ml-auto tabular-nums font-mono text-[10px] text-falcon-text/25">
          ~{step.stepCount.toLocaleString()}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-falcon-text/30">{step.description}</p>

      {isActive && (
        <div className="mt-4 space-y-1.5 border-t border-[var(--glass-border)] pt-4">
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
  )
}
