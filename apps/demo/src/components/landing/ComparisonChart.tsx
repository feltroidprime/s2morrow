"use client"

import React, { useEffect, useRef, useState } from "react"

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
    <div ref={ref} className="mt-10 space-y-4">
      {/* secp256r1 bar */}
      <div className="flex items-center gap-4">
        <span className="w-36 shrink-0 text-right text-xs text-falcon-text/40 sm:w-44">
          secp256r1 (ECDSA)
        </span>
        <div className="flex-1">
          <div
            className="comparison-bar bg-falcon-text/10"
            data-visible={visible}
            style={{ width: visible ? "100%" : undefined }}
          />
        </div>
        <span className="w-20 shrink-0 tabular-nums text-sm font-semibold text-falcon-text/50">
          ~230K
        </span>
      </div>
      {/* Falcon bar */}
      <div className="flex items-center gap-4">
        <span className="w-36 shrink-0 text-right text-xs font-semibold text-falcon-accent/70 sm:w-44">
          Falcon-512
        </span>
        <div className="flex-1">
          <div
            className="comparison-bar bg-gradient-to-r from-falcon-primary to-falcon-accent"
            data-visible={visible}
            style={{ width: visible ? "57%" : undefined }}
          />
        </div>
        <span className="w-20 shrink-0 tabular-nums text-sm font-semibold text-falcon-accent">
          132K
        </span>
      </div>
      <p className="pt-2 text-center text-xs text-falcon-text/30">Cairo steps (lower is better)</p>
    </div>
  )
}
