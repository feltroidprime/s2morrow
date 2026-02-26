import React from "react"

type StatusVariant = "success" | "error" | "warning" | "info" | "pending"

interface StatusBadgeProps {
  readonly variant: StatusVariant
  readonly children: React.ReactNode
}

const variantStyles: Record<StatusVariant, string> = {
  success: "text-falcon-success/80 bg-falcon-success/10",
  error: "text-falcon-error/80 bg-falcon-error/10",
  warning: "text-yellow-400/80 bg-yellow-400/10",
  info: "text-falcon-accent/80 bg-falcon-accent/10",
  pending: "text-falcon-primary/80 bg-falcon-primary/10",
}

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}>
      {variant === "pending" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {children}
    </span>
  )
}
