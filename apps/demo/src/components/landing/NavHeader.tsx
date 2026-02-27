"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import { networkAtom, NETWORK_STORAGE_KEY } from "@/atoms/starknet"
import { NETWORKS } from "@/config/networks"
import type { NetworkId } from "@/config/networks"
import { ThemeToggle } from "@/components/ThemeToggle"

const NAV_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#why-starknet", label: "Why Starknet" },
  { href: "#verify", label: "Try It" },
  { href: "#deploy", label: "Deploy" },
] as const

export function NavHeader(): React.JSX.Element {
  const networkId = useAtomValue(networkAtom)
  const setNetwork = useAtomSet(networkAtom)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
        <a href="#hero" className="shrink-0 flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight text-falcon-accent">s2morrow</span>
          <span className="hidden text-[10px] tracking-wider uppercase text-falcon-text/40 sm:inline">Falcon-512 Quantum Wallet</span>
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-falcon-text/65 transition-colors duration-200 hover:text-falcon-text"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 items-center gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="flex h-8 w-8 items-center justify-center text-falcon-text/65 transition-colors hover:text-falcon-text md:hidden"
          >
            {mobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 6h14M3 10h14M3 14h14" />
              </svg>
            )}
          </button>
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
                  title={id === "devnet" ? "Requires local starknet-devnet on port 5050" : undefined}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-200 sm:px-3 sm:py-1 sm:text-xs ${
                    isActive
                      ? "bg-falcon-accent/15 text-falcon-accent"
                      : "text-falcon-text/50 hover:text-falcon-text/70"
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

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-[var(--glass-border)] px-4 py-4 md:hidden">
          <ul className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-1.5 text-sm text-falcon-text/65 transition-colors duration-200 hover:text-falcon-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}
