"use client"

/**
 * PipelineVisualizer — step-through of the 6-stage Falcon-512 verification.
 *
 * Shows the on-chain verification pipeline with play/pause/step/reset
 * controls. Each step card shows name, description, step count, and
 * expands to show input/output when active.
 *
 * All state lives in atoms (pipelineStepsAtom, pipelineActiveStepAtom,
 * pipelinePlayingAtom) — no local useState.
 */

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

  // ── Auto-advance logic ──────────────────────────────────────────────
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

  // ── Handlers ────────────────────────────────────────────────────────
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
    <section id="pipeline" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-falcon-text">
              Verification Pipeline
            </h2>
            <p className="mt-2 text-falcon-muted">
              Step through the 6-stage Falcon-512 on-chain verification
            </p>
          </div>
          <span className="font-mono text-sm text-falcon-accent">
            ~{TOTAL_STEPS.toLocaleString()} total steps
          </span>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap gap-3">
          {!playing ? (
            <button
              onClick={handlePlay}
              disabled={allComplete}
              aria-label="Play pipeline animation"
              className="rounded-lg bg-falcon-primary px-4 py-2 text-sm font-semibold text-falcon-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Play
            </button>
          ) : (
            <button
              onClick={handlePause}
              aria-label="Pause pipeline animation"
              className="rounded-lg bg-falcon-primary px-4 py-2 text-sm font-semibold text-falcon-text transition-opacity hover:opacity-90"
            >
              Pause
            </button>
          )}
          <button
            onClick={handleStep}
            disabled={playing || allComplete}
            aria-label="Advance one pipeline step"
            className="rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 text-sm font-medium text-falcon-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Step
          </button>
          <button
            onClick={handleReset}
            aria-label="Reset pipeline to beginning"
            className="rounded-lg border border-falcon-muted/30 bg-falcon-surface px-4 py-2 text-sm font-medium text-falcon-text transition-opacity hover:opacity-90"
          >
            Reset
          </button>
        </div>

        {/* Pipeline step cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <PipelineStepCard key={step.id} step={step} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function PipelineStepCard({ step }: { step: PipelineStep }): React.JSX.Element {
  const isActive = step.status === "active"
  const isComplete = step.status === "complete"

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        isActive
          ? "border-falcon-primary/50 bg-falcon-primary/10 ring-2 ring-falcon-primary/30"
          : isComplete
            ? "border-falcon-success/30 bg-falcon-surface"
            : "border-falcon-muted/20 bg-falcon-surface"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">
          {isComplete ? (
            <span className="text-falcon-success">&#10003;</span>
          ) : isActive ? (
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-falcon-primary" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-falcon-muted/40" />
          )}
        </span>
        <h3 className="font-mono text-sm font-semibold text-falcon-text">
          {step.name}
        </h3>
        <span className="ml-auto font-mono text-xs text-falcon-muted">
          ~{step.stepCount.toLocaleString()}
        </span>
      </div>

      <p className="mt-2 text-xs text-falcon-muted">{step.description}</p>

      {isActive && (
        <div className="mt-3 space-y-1 border-t border-falcon-muted/20 pt-3">
          <div className="text-xs">
            <span className="font-medium text-falcon-muted">In: </span>
            <span className="font-mono text-falcon-text">{step.input}</span>
          </div>
          <div className="text-xs">
            <span className="font-medium text-falcon-muted">Out: </span>
            <span className="font-mono text-falcon-text">{step.output}</span>
          </div>
        </div>
      )}
    </div>
  )
}
