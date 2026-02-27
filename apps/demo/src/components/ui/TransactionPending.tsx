"use client"

import React, { useEffect, useState } from "react"

interface TransactionPendingProps {
  readonly title: string
  readonly subtitle: string
  readonly startTime?: number
  readonly hint?: string
}

export function TransactionPending({ title, subtitle, startTime, hint }: TransactionPendingProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (startTime == null) return
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-card-static glass-card-active mt-8 overflow-hidden rounded-2xl animate-fade-in"
    >
      {/* Indeterminate progress bar */}
      <div className="relative h-[2px] w-full overflow-hidden bg-falcon-accent/10">
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-falcon-accent/60 to-transparent animate-progress-indeterminate" />
      </div>

      <div className="flex items-center gap-4 px-6 py-5">
        {/* Apple-style ring spinner */}
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <svg
            className="animate-spin-ring"
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
          >
            <circle
              cx="14"
              cy="14"
              r="11"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-falcon-accent/10"
            />
            <circle
              cx="14"
              cy="14"
              r="11"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="52"
              strokeDashoffset="36"
              className="text-falcon-accent"
            />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-falcon-text/80">
            {title}
            {startTime != null && (
              <span className="ml-2 font-mono tabular-nums text-xs text-falcon-text/30">
                ({elapsed}s)
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-falcon-text/30 animate-text-breathe">{subtitle}</p>
          {hint && (
            <p className="mt-1 text-[11px] text-falcon-text/20">{hint}</p>
          )}
        </div>
      </div>
    </div>
  )
}
