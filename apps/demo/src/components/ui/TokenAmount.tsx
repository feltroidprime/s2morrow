import React from "react"

interface TokenAmountProps {
  readonly amount: bigint
  readonly decimals?: number
  readonly symbol?: string
  readonly className?: string
}

export function TokenAmount({ amount, decimals = 18, symbol = "STRK", className = "" }: TokenAmountProps) {
  const formatted = (Number(amount) / 10 ** decimals).toFixed(4)

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {formatted} <span className="text-falcon-text/40">{symbol}</span>
    </span>
  )
}
