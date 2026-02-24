type PerformanceRow = { operation: string; steps: string; gas: string }

const PERFORMANCE_ROWS: readonly PerformanceRow[] = [
  { operation: "verify", steps: "63,177", gas: "~13.2M L2" },
  { operation: "verify_with_msg_point", steps: "26,301", gas: "~5.5M L2" },
  { operation: "hash_to_point", steps: "5,988", gas: "~1.3M L2" },
  { operation: "NTT-512", steps: "~15,000", gas: "~3.1M L2" },
]

export function PerformanceStats(): React.JSX.Element {
  return (
    <section id="performance-stats" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight text-falcon-text">Performance Stats</h2>
        <div className="mt-8 overflow-x-auto rounded-xl border border-falcon-muted/20 bg-falcon-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-falcon-muted/20">
                <th scope="col" className="px-6 py-3 font-semibold text-falcon-text">
                  Operation
                </th>
                <th scope="col" className="px-6 py-3 text-right font-semibold text-falcon-text">
                  Steps
                </th>
                <th scope="col" className="px-6 py-3 text-right font-semibold text-falcon-text">
                  L2 Gas
                </th>
              </tr>
            </thead>
            <tbody>
              {PERFORMANCE_ROWS.map((row) => (
                <tr key={row.operation} className="border-b border-falcon-muted/10 last:border-0">
                  <td className="px-6 py-4 font-mono text-falcon-accent">{row.operation}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-falcon-text">{row.steps}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-falcon-muted">{row.gas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
          <h3 className="text-lg font-semibold text-falcon-text">Calldata Efficiency</h3>
          <p className="mt-2 text-sm text-falcon-muted">
            Packing reduces calldata by <span className="font-semibold text-falcon-accent">17x</span>,
            from about <span className="font-mono text-falcon-text">1,030 felts</span> to{" "}
            <span className="font-mono text-falcon-text">62 felts</span>.
          </p>
        </div>
      </div>
    </section>
  )
}
