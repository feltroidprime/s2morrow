import React from "react"
import { CopyButton } from "./CopyButton"

interface AddressDisplayProps {
  readonly address: string
  readonly label?: string
  readonly explorerBaseUrl?: string
  readonly full?: boolean
  readonly className?: string
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 10)}\u2026${addr.slice(-4)}`
}

export function AddressDisplay({ address, label, explorerBaseUrl, full = false, className = "" }: AddressDisplayProps) {
  return (
    <div className={`glass-display rounded-xl p-4 ${className}`}>
      {label && (
        <p className="text-[10px] font-medium uppercase tracking-widest text-falcon-text/20">
          {label}
        </p>
      )}
      <div className={`flex items-center gap-2 ${label ? "mt-2" : ""}`}>
        <code className="flex-1 break-all font-mono text-xs tabular-nums text-falcon-accent/60">
          {full ? address : truncateAddress(address)}
        </code>
        <CopyButton value={address} />
      </div>
      {explorerBaseUrl && (
        <a
          href={`${explorerBaseUrl}/contract/${address}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block text-xs text-falcon-text/25 transition-colors duration-200 hover:text-falcon-accent/60"
        >
          View on explorer &rarr;
        </a>
      )}
    </div>
  )
}
