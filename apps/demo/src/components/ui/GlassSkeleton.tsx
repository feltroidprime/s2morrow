import React from "react"

interface GlassSkeletonProps {
  readonly className?: string
  readonly lines?: number
}

export function GlassSkeleton({ className = "", lines = 3 }: GlassSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="skeleton-shimmer h-4 rounded-lg"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  )
}
