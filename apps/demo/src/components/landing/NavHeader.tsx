"use client"

import React, { useCallback, useEffect } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { networkAtom, NETWORK_STORAGE_KEY } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import type { NetworkId } from "@/config/networks"
import { ThemeToggle } from "@/components/ThemeToggle"

const NAV_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#verify", label: "Verify" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#deploy", label: "Deploy" },
] as const

export function NavHeader(): React.JSX.Element {
  const networkId = useAtomValue(networkAtom)
  const setNetwork = useAtomSet(networkAtom)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NETWORK_STORAGE_KEY)
      if (stored === "mainnet" || stored === "sepolia" || stored === "devnet") {
        setNetwork(stored)
      }
    } catch {
      // localStorage unavailable
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
    <header className="glass-nav sticky top-0 z-40">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8 sm:py-4"
      >
        <a href="#hero" className="shrink-0 text-sm font-semibold tracking-tight text-falcon-accent">
          Falcon-512
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-falcon-text/50 transition-colors duration-200 hover:text-falcon-text"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="glass-btn flex items-center rounded-full p-0.5"
            role="group"
            aria-label="Network selection"
          >
            {(["devnet", "sepolia", "mainnet"] as const).map((id) => {
              const isActive = networkId === id
              return (
                <button
                  key={id}
                  onClick={() => handleNetworkChange(id)}
                  aria-pressed={isActive}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-200 sm:px-3 sm:py-1 sm:text-xs ${
                    isActive
                      ? "bg-falcon-accent/15 text-falcon-accent"
                      : "text-falcon-text/40 hover:text-falcon-text/70"
                  }`}
                >
                  {NETWORKS[id].name}
                </button>
              )
            })}
          </div>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
