type PerformanceRow = { operation: string; steps: string; gas: string }

const PERFORMANCE_ROWS: readonly PerformanceRow[] = [
  { operation: "verify", steps: "63,177", gas: "~13.2M L2" },
  { operation: "verify_with_msg_point", steps: "26,301", gas: "~5.5M L2" },
  { operation: "hash_to_point", steps: "5,988", gas: "~1.3M L2" },
  { operation: "NTT-512", steps: "~15,000", gas: "~3.1M L2" },
]

export function PerformanceStats(): React.JSX.Element {
  return (
    <section id="performance-stats" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          Performance Stats
        </h2>
        <div className="glass-card-static mt-10 overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th scope="col" className="px-8 py-4 text-xs font-medium tracking-wide text-falcon-text/40 uppercase">
                  Operation
                </th>
                <th scope="col" className="px-8 py-4 text-right text-xs font-medium tracking-wide text-falcon-text/40 uppercase">
                  Steps
                </th>
                <th scope="col" className="px-8 py-4 text-right text-xs font-medium tracking-wide text-falcon-text/40 uppercase">
                  L2 Gas
                </th>
              </tr>
            </thead>
            <tbody>
              {PERFORMANCE_ROWS.map((row, i) => (
                <tr
                  key={row.operation}
                  className={i < PERFORMANCE_ROWS.length - 1 ? "border-b border-[var(--glass-border)]" : undefined}
                >
                  <td className="px-8 py-5 font-mono text-xs text-falcon-accent/70">{row.operation}</td>
                  <td className="px-8 py-5 text-right tabular-nums text-falcon-text/80">{row.steps}</td>
                  <td className="px-8 py-5 text-right tabular-nums text-falcon-text/40">{row.gas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="glass-card mt-6 rounded-2xl p-8">
          <h3 className="text-base font-semibold tracking-tight text-falcon-text/90">
            Calldata Efficiency
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-falcon-text/40">
            Packing reduces calldata by{" "}
            <span className="font-semibold text-falcon-accent/70">17x</span>, from about{" "}
            <span className="font-mono text-xs text-falcon-text/60">1,030 felts</span> to{" "}
            <span className="font-mono text-xs text-falcon-text/60">62 felts</span>.
          </p>
        </div>
      </div>
    </section>
  )
}
