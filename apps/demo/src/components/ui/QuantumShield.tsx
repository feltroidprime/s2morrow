import React from "react"

interface QuantumShieldProps {
  readonly size?: "sm" | "md" | "lg"
  readonly animate?: boolean
  readonly className?: string
}

const SIZES = {
  sm: { width: 16, height: 18, dotR: 0.3, spacing: 3 },
  md: { width: 24, height: 28, dotR: 0.4, spacing: 4 },
  lg: { width: 36, height: 42, dotR: 0.5, spacing: 5 },
} as const

export function QuantumShield({ size = "md", animate = false, className = "" }: QuantumShieldProps) {
  const s = SIZES[size]
  const patternId = `lattice-${size}`

  return (
    <svg
      width={s.width}
      height={s.height}
      viewBox={`0 0 ${s.width} ${s.height}`}
      fill="none"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} width={s.spacing} height={s.spacing} patternUnits="userSpaceOnUse">
          <circle cx={s.spacing / 2} cy={s.spacing / 2} r={s.dotR} fill="rgba(99, 102, 241, 0.4)" />
          <circle cx={0} cy={0} r={s.dotR} fill="rgba(6, 182, 212, 0.3)" />
        </pattern>
        <clipPath id={`shield-clip-${size}`}>
          <path d={shieldPath(s.width, s.height)} />
        </clipPath>
      </defs>

      {/* Shield outline */}
      <path
        d={shieldPath(s.width, s.height)}
        stroke="currentColor"
        strokeWidth={size === "sm" ? 1 : 1.5}
        strokeLinejoin="round"
        className={`text-falcon-primary/60 ${animate ? "animate-shield-draw" : ""}`}
        fill="none"
      />

      {/* Lattice fill */}
      <rect
        width={s.width}
        height={s.height}
        fill={`url(#${patternId})`}
        clipPath={`url(#shield-clip-${size})`}
        className={animate ? "animate-fade-in stagger-delay-3" : ""}
        opacity={0.6}
      />
    </svg>
  )
}

function shieldPath(w: number, h: number): string {
  const cx = w / 2
  const top = h * 0.05
  const bottom = h * 0.95
  const mid = h * 0.55
  return `M ${cx} ${top} L ${w * 0.95} ${mid * 0.45} L ${w * 0.95} ${mid} Q ${w * 0.95} ${bottom * 0.85} ${cx} ${bottom} Q ${w * 0.05} ${bottom * 0.85} ${w * 0.05} ${mid} L ${w * 0.05} ${mid * 0.45} Z`
}
