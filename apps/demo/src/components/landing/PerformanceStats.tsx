"use client"

import React, { useState } from "react"
import { ComparisonChart } from "./ComparisonChart"

type PerformanceRow = { operation: string; steps: string; gas: string }

const PERFORMANCE_ROWS: readonly PerformanceRow[] = [
  { operation: "verify_packed", steps: "81,212", gas: "~9.5M L2" },
  { operation: "verify", steps: "65,219", gas: "~7.6M L2" },
  { operation: "verify_with_msg_point", steps: "58,650", gas: "~6.8M L2" },
  { operation: "hash_to_point", steps: "6,285", gas: "~745K L2" },
  { operation: "NTT-512", steps: "16,142", gas: "~1.9M L2" },
]

export function PerformanceStats(): React.JSX.Element {
  const [showBreakdown, setShowBreakdown] = useState(false)

  return (
    <section id="performance-stats" className="px-8 py-36 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[0.08em] uppercase text-falcon-text/85 sm:text-4xl">
          Faster than the signature scheme you use today
        </h2>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-falcon-text/75 sm:text-base">
          Falcon-512 verification:{" "}
          <span className="font-semibold text-falcon-accent/70 text-glow">~9.5M</span> L2 gas.
          secp256r1 via syscall: ~27.4M. Via garaga (pure Cairo): ~4.6M.
          Post-quantum security at{" "}
          <span className="font-semibold text-falcon-accent/70 text-glow">2x the cost of garaga ECDSA</span>{" "}
          &mdash; and quantum-safe.
        </p>

        <ComparisonChart />

        <div className="mt-12">
          <button
            onClick={() => setShowBreakdown((prev) => !prev)}
            className="glass-btn px-4 py-2 text-[11px] font-medium tracking-wider uppercase text-falcon-text/75 transition-all duration-300 hover:text-falcon-accent/40 hover:text-glow"
          >
            {showBreakdown ? "Hide breakdown" : "See the full breakdown"} &#x25BE;
          </button>

          {showBreakdown && (
            <div className="glass-card-static corner-brackets mt-4 overflow-hidden animate-fade-in">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-falcon-accent/6">
                    <th scope="col" className="px-8 py-5 text-[10px] font-medium tracking-[0.15em] text-falcon-text/65 uppercase">
                      Operation
                    </th>
                    <th scope="col" className="px-8 py-5 text-right text-[10px] font-medium tracking-[0.15em] text-falcon-text/65 uppercase">
                      Steps
                    </th>
                    <th scope="col" className="px-8 py-5 text-right text-[10px] font-medium tracking-[0.15em] text-falcon-text/65 uppercase">
                      L2 Gas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PERFORMANCE_ROWS.map((row, i) => (
                    <tr
                      key={row.operation}
                      className={i < PERFORMANCE_ROWS.length - 1 ? "border-b border-falcon-accent/4" : undefined}
                    >
                      <td className="px-8 py-5 text-xs text-falcon-accent/40">{row.operation}</td>
                      <td className="px-8 py-5 text-right tabular-nums text-sm text-falcon-text/65">{row.steps}</td>
                      <td className="px-8 py-5 text-right text-xs tabular-nums text-falcon-text/65">{row.gas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-card corner-brackets mt-10 p-10">
          <h3 className="text-sm font-semibold tracking-wide text-falcon-text/75">
            17x calldata compression
          </h3>
          <p className="mt-3 text-xs leading-relaxed text-falcon-text/75">
            512 Zq coefficients packed into{" "}
            <span className="font-semibold text-falcon-accent/50 text-glow">29 felt252</span> storage slots.{" "}
            <span className="text-[11px] text-falcon-text/65">1,030 felts</span> reduced to{" "}
            <span className="text-[11px] text-falcon-text/65">62 felts</span> on-chain.
          </p>
        </div>
      </div>
    </section>
  )
}
