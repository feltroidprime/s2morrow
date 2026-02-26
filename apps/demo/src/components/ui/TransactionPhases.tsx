import React from "react"

interface TransactionPhasesProps {
  /** Current active phase */
  readonly phase: "signing" | "submitting" | "confirming"
  /** Duration of signing phase in ms (set when signing completes) */
  readonly signMs?: number
  /** Duration of submit phase in ms (set when confirming starts) */
  readonly submitMs?: number
}

const PHASES = [
  { key: "signing", label: "Falcon-512 Signing", icon: "key" },
  { key: "submitting", label: "Submitting to Network", icon: "send" },
  { key: "confirming", label: "Awaiting Confirmation", icon: "check" },
] as const

const PHASE_ORDER = { signing: 0, submitting: 1, confirming: 2 }

export function TransactionPhases({ phase, signMs, submitMs }: TransactionPhasesProps) {
  const activeIdx = PHASE_ORDER[phase]

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-card-static glass-card-active mt-5 overflow-hidden rounded-2xl animate-fade-in"
    >
      {/* Indeterminate progress bar */}
      <div className="relative h-[2px] w-full overflow-hidden bg-falcon-accent/10">
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-falcon-accent/60 to-transparent animate-progress-indeterminate" />
      </div>

      <div className="px-5 py-4 space-y-0">
        {PHASES.map((p, i) => {
          const isDone = i < activeIdx
          const isActive = i === activeIdx
          const isPending = i > activeIdx

          const durationLabel =
            isDone && i === 0 && signMs != null ? formatMs(signMs) :
            isDone && i === 1 && submitMs != null ? formatMs(submitMs) :
            null

          return (
            <div
              key={p.key}
              className={`flex items-center gap-3 py-2 transition-opacity duration-300 ${
                isPending ? "opacity-25" : "opacity-100"
              }`}
            >
              {/* Phase indicator */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                {isDone ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-falcon-success/15 text-falcon-success animate-scale-in">
                    <PhaseIcon type="done" />
                  </div>
                ) : isActive ? (
                  <svg
                    className="animate-spin-ring"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <circle
                      cx="10" cy="10" r="7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="text-falcon-accent/10"
                    />
                    <circle
                      cx="10" cy="10" r="7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="33"
                      strokeDashoffset="23"
                      className="text-falcon-accent"
                    />
                  </svg>
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-falcon-text/15" />
                )}
              </div>

              {/* Label */}
              <span className={`text-sm transition-colors duration-200 ${
                isActive
                  ? "font-medium text-falcon-text/80"
                  : isDone
                    ? "text-falcon-text/50"
                    : "text-falcon-text/25"
              }`}>
                {p.label}
              </span>

              {/* Duration badge */}
              {isDone && durationLabel != null && (
                <span className="ml-auto rounded-md bg-falcon-success/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-falcon-success/80 animate-fade-in">
                  {durationLabel}
                </span>
              )}

              {/* Active breathing indicator */}
              {isActive && (
                <span className="ml-auto text-[11px] tabular-nums text-falcon-text/25 animate-text-breathe">
                  {p.key === "signing" ? "signing..." : p.key === "submitting" ? "broadcasting..." : "waiting..."}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PhaseIcon({ type }: { type: "done" }) {
  if (type === "done") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M2 5.5L4 7.5L8 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return null
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
