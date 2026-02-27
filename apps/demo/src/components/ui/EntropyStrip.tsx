"use client"

import React, { useEffect, useState } from "react"

interface EntropyStripProps {
  readonly active: boolean
}

function randomHex(length: number): string {
  const chars = "0123456789ABCDEF"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)]
  }
  return result
}

export function EntropyStrip({ active }: EntropyStripProps) {
  const [hex, setHex] = useState(() => randomHex(8))

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      setHex(randomHex(8))
    }, 60)
    return () => clearInterval(interval)
  }, [active])

  if (!active) return null

  return (
    <div className="font-mono text-[10px] tracking-wider text-falcon-accent/30" aria-hidden="true">
      0x{hex.slice(0, 4)}...{hex.slice(4)}
    </div>
  )
}
