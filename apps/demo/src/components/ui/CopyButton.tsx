"use client"
import React, { useCallback, useState } from "react"

interface CopyButtonProps {
  readonly value: string
  readonly label?: string
  readonly className?: string
}

export function CopyButton({ value, label = "Copy", className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [value])

  return (
    <button
      onClick={handleCopy}
      className={`glass-btn shrink-0 rounded-lg px-3 py-1.5 text-xs transition-all duration-200 ${
        copied
          ? "text-falcon-success/80"
          : "text-falcon-text/40 hover:text-falcon-text/70"
      } ${className}`}
      title={copied ? "Copied!" : `Copy ${label}`}
    >
      {copied ? "\u2713 Copied" : label}
    </button>
  )
}
