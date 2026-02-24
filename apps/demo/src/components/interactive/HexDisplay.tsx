/**
 * HexDisplay — a client component for rendering hex strings and felt252 arrays.
 *
 * Used in the Verification Playground to show the packed public key slots,
 * salt, and signature preview values. Supports:
 * - Single string values
 * - Arrays of strings with optional `maxRows` clamping
 * - Optional `truncate` prop to shorten long hex values
 */

import React from "react"
import { truncateHex } from "./verification-utils"

export interface HexDisplayProps {
  /** Section label shown above the value(s). */
  readonly label: string
  /** A single hex/felt string, or an array of them. */
  readonly value: string | ReadonlyArray<string>
  /**
   * Maximum number of rows to display when `value` is an array.
   * Excess rows are replaced with a "... N more" indicator.
   */
  readonly maxRows?: number
  /**
   * If provided, each displayed value is truncated to
   * `head` characters + "..." + `tail` characters.
   */
  readonly truncate?: { readonly head: number; readonly tail: number }
}

export function HexDisplay(props: HexDisplayProps): React.JSX.Element {
  const { label, value, maxRows, truncate } = props

  const display = (v: string): string =>
    truncate ? truncateHex(v, truncate.head, truncate.tail) : v

  if (typeof value === "string") {
    return (
      <div>
        <span className="block text-sm font-medium text-falcon-muted">
          {label}
        </span>
        <code className="mt-1 block break-all font-mono text-sm text-falcon-accent">
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
      <span className="block text-sm font-medium text-falcon-muted">
        {label}
      </span>
      <div className="mt-1 space-y-0.5">
        {shown.map((v) => {
          const nextCount = (keyCounts.get(v) ?? 0) + 1
          keyCounts.set(v, nextCount)
          const stableKey = nextCount === 1 ? v : `${v}-${nextCount}`
          return (
            <code
              key={stableKey}
              className="block break-all font-mono text-sm text-falcon-accent"
            >
              {display(v)}
            </code>
          )
        })}
        {overflow > 0 && (
          <span className="text-xs text-falcon-muted">
            ... {overflow} more
          </span>
        )}
      </div>
    </div>
  )
}
