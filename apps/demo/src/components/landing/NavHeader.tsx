"use client"

import React, { useCallback, useEffect } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { networkAtom, NETWORK_STORAGE_KEY } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import type { NetworkId } from "@/config/networks"

const NAV_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#verify", label: "Verify" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#deploy", label: "Deploy" },
] as const

export function NavHeader(): React.JSX.Element {
  const networkId = useAtomValue(networkAtom)
  const setNetwork = useAtomSet(networkAtom)

  // Sync from localStorage after hydration (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NETWORK_STORAGE_KEY)
      if (stored === "mainnet") setNetwork("mainnet")
    } catch {
      // localStorage unavailable (e.g., private browsing restriction)
    }
  }, [setNetwork])

  const handleNetworkChange = useCallback(
    (id: NetworkId) => {
      setNetwork(id)
      try {
        localStorage.setItem(NETWORK_STORAGE_KEY, id)
      } catch {
        // localStorage unavailable
      }
    },
    [setNetwork],
  )

  return (
    <header className="sticky top-0 z-40 border-b border-falcon-muted/20 bg-falcon-bg/80 backdrop-blur-sm">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3"
      >
        <a href="#hero" className="text-sm font-bold text-falcon-accent">
          Falcon-512
        </a>
        <ul className="flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-falcon-muted transition-colors hover:text-falcon-text"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div
          className="flex items-center rounded-full border border-falcon-muted/30 p-0.5"
          role="group"
          aria-label="Network selection"
        >
          {(["sepolia", "mainnet"] as const).map((id) => {
            const isActive = networkId === id
            return (
              <button
                key={id}
                onClick={() => handleNetworkChange(id)}
                aria-pressed={isActive}
                className={
                  isActive
                    ? "rounded-full bg-falcon-accent px-3 py-1 text-xs font-semibold text-falcon-text transition-all"
                    : "rounded-full px-3 py-1 text-xs text-falcon-muted transition-all hover:text-falcon-text"
                }
              >
                {NETWORKS[id].name}
              </button>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
