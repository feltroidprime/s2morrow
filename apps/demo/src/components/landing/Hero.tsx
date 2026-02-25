const HERO_STATS = [
  { value: "63K", label: "Steps" },
  { value: "62", label: "Calldata felts" },
  { value: "29", label: "Storage slots" },
] as const

export function Hero(): React.JSX.Element {
  return (
    <section id="hero" aria-labelledby="hero-heading" className="px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-falcon-accent uppercase">
          Falcon-512 Demo
        </p>
        <h1 id="hero-heading" className="mt-4 text-4xl font-bold tracking-tight text-falcon-text sm:text-6xl">
          Post-Quantum Signatures on Starknet
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-falcon-muted sm:text-lg">
          Verify Falcon signatures with production Cairo metrics and account abstraction deployment
          flows on Starknet Sepolia testnet.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#verify"
            className="inline-flex rounded-lg bg-falcon-primary px-6 py-3 text-sm font-semibold text-falcon-text transition-colors hover:bg-falcon-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent focus-visible:ring-offset-2 focus-visible:ring-offset-falcon-bg"
          >
            Try Verification
          </a>
          <a
            href="#deploy"
            className="inline-flex rounded-lg border border-falcon-muted/40 bg-falcon-surface px-6 py-3 text-sm font-semibold text-falcon-text transition-colors hover:border-falcon-accent/70 hover:text-falcon-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent focus-visible:ring-offset-2 focus-visible:ring-offset-falcon-bg"
          >
            Deploy Account
          </a>
        </div>

        <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-falcon-muted/20 bg-falcon-surface px-5 py-4">
              <dt className="text-sm text-falcon-muted">{stat.label}</dt>
              <dd className="mt-2 text-3xl font-bold text-falcon-accent">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
