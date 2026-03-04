import React from "react"

interface EmptyStateProps {
  readonly title: string
  readonly description: string
  readonly action?: {
    readonly label: string
    readonly onClick: () => void
  }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-medium text-falcon-text/40">{title}</p>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-falcon-text/25">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-xl bg-gradient-to-b from-falcon-primary to-falcon-primary/80 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-falcon-primary/15 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
