"use client"

import React, { useEffect, useRef, useState } from "react"

const BARS = [
  { label: "secp256r1 syscall", gas: "~27.4M", width: "100%", accent: false },
  { label: "secp256k1 syscall", gas: "~16.6M", width: "61%", accent: false },
  { label: "Falcon-512", gas: "~9.5M", width: "35%", accent: true },
  { label: "secp256r1 garaga", gas: "~4.6M", width: "17%", accent: false },
  { label: "secp256k1 garaga", gas: "~4.5M", width: "16%", accent: false },
] as const

export function ComparisonChart(): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="mt-12 space-y-5">
      {BARS.map((bar) => (
        <div key={bar.label} className="flex items-center gap-4">
          <span
            className={`w-36 shrink-0 text-right text-[11px] tracking-wide sm:w-44 ${
              bar.accent ? "font-semibold text-falcon-accent/70 text-glow" : "text-falcon-text/70"
            }`}
          >
            {bar.label}
          </span>
          <div className="flex-1">
            <div
              className={`comparison-bar ${
                bar.accent
                  ? "bg-gradient-to-r from-falcon-accent/60 to-falcon-accent/30"
                  : "bg-falcon-text/4"
              }`}
              data-visible={visible}
              style={{ width: visible ? bar.width : undefined }}
            />
          </div>
          <span
            className={`w-20 shrink-0 tabular-nums text-sm font-semibold ${
              bar.accent ? "text-falcon-accent/70 text-glow" : "text-falcon-text/75"
            }`}
          >
            {bar.gas}
          </span>
        </div>
      ))}
      <p className="pt-3 text-center text-[10px] tracking-wider uppercase text-falcon-text/70">
        L2 gas &mdash; signature verification (lower is better)
      </p>
    </div>
  )
}
