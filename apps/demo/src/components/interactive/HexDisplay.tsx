/**
 * HexDisplay — renders hex strings and felt252 arrays as subtle glass pills.
 */

import React from "react"
import { truncateHex } from "./verification-utils"

export interface HexDisplayProps {
  readonly label: string
  readonly value: string | ReadonlyArray<string>
  readonly maxRows?: number
  readonly truncate?: { readonly head: number; readonly tail: number }
}

export function HexDisplay(props: HexDisplayProps): React.JSX.Element {
  const { label, value, maxRows, truncate } = props

  const display = (v: string): string =>
    truncate ? truncateHex(v, truncate.head, truncate.tail) : v

  if (typeof value === "string") {
    return (
      <div>
        {label && (
          <span className="block text-xs font-medium text-falcon-text/50">
            {label}
          </span>
        )}
        <code className="glass-display mt-1.5 block break-all rounded-lg px-3 py-2 font-mono text-xs text-falcon-accent/60">
          {display(value)}
        </code>
      </div>
    )
  }

  const items = Array.from(value)
  const shown = maxRows !== undefined ? items.slice(0, maxRows) : items
  const overflow =
    maxRows !== undefined ? Math.max(0, items.length - maxRows) : 0
  const keyCounts = new Map<string, number>()

  return (
    <div>
      {label && (
        <span className="block text-xs font-medium text-falcon-text/30">
          {label}
        </span>
      )}
      <div className="glass-display mt-1.5 space-y-0.5 rounded-lg px-3 py-2">
        {shown.map((v) => {
          const nextCount = (keyCounts.get(v) ?? 0) + 1
          keyCounts.set(v, nextCount)
          const stableKey = nextCount === 1 ? v : `${v}-${nextCount}`
          return (
            <code
              key={stableKey}
              className="block break-all font-mono text-xs text-falcon-accent/60"
            >
              {display(v)}
            </code>
          )
        })}
        {overflow > 0 && (
          <span className="text-xs text-falcon-text/20">
            ... {overflow} more
          </span>
        )}
      </div>
    </div>
  )
}
