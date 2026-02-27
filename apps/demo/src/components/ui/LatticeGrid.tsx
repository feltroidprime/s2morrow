"use client"

import React, { useMemo } from "react"

interface LatticeGridProps {
  readonly active: boolean
}

const COLS = 22
const ROWS = 24
const CENTER_X = COLS / 2
const CENTER_Y = ROWS / 2
const MAX_DIST = Math.sqrt(CENTER_X * CENTER_X + CENTER_Y * CENTER_Y)
const RING_DELAY_MS = 40

export function LatticeGrid({ active }: LatticeGridProps) {
  const dots = useMemo(() => {
    const result: { key: number; delay: number }[] = []
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const dx = col - CENTER_X
        const dy = row - CENTER_Y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const normalizedDist = dist / MAX_DIST
        const delay = Math.floor(normalizedDist * 20) * RING_DELAY_MS
        result.push({ key: row * COLS + col, delay })
      }
    }
    return result
  }, [])

  return (
    <div
      className="grid gap-[3px] opacity-60"
      style={{
        gridTemplateColumns: `repeat(${COLS}, 4px)`,
      }}
      aria-hidden="true"
    >
      {dots.map((dot) => (
        <div
          key={dot.key}
          className="h-1 w-1 rounded-full transition-all duration-500"
          style={{
            background: active
              ? "rgba(99, 102, 241, 0.3)"
              : "rgba(99, 102, 241, 0.05)",
            transitionDelay: active ? `${dot.delay}ms` : "0ms",
            transform: active ? "scale(1)" : "scale(0.5)",
          }}
        />
      ))}
    </div>
  )
}
