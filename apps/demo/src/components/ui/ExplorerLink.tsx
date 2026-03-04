import React from "react"

interface ExplorerLinkProps {
  readonly baseUrl: string
  readonly txHash?: string
  readonly address?: string
  readonly className?: string
}

export function ExplorerLink({ baseUrl, txHash, address, className = "" }: ExplorerLinkProps) {
  if (!baseUrl) return null

  const path = txHash ? `/tx/${txHash}` : address ? `/contract/${address}` : ""
  const label = txHash ? "View transaction" : address ? "View contract" : "View on explorer"

  return (
    <a
      href={`${baseUrl}${path}`}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-1 text-xs text-falcon-text/25 transition-colors duration-200 hover:text-falcon-accent/60 ${className}`}
    >
      {label} <span aria-hidden="true">&rarr;</span>
    </a>
  )
}
