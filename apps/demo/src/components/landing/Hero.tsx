const HERO_STATS = [
  { value: "63K", label: "Steps" },
  { value: "62", label: "Calldata felts" },
  { value: "29", label: "Storage slots" },
] as const

export function Hero(): React.JSX.Element {
  return (
    <section id="hero" aria-labelledby="hero-heading" className="px-8 py-32 sm:py-40 lg:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <p className="text-xs font-medium tracking-[0.25em] text-falcon-accent/70 uppercase">
          Falcon-512 Demo
        </p>
        <h1
          id="hero-heading"
          className="mt-6 text-4xl font-semibold tracking-[-0.02em] text-falcon-text sm:text-6xl"
        >
          Post-Quantum Signatures on Starknet
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-falcon-text/50 sm:text-lg">
          Verify Falcon signatures with production Cairo metrics and account abstraction deployment
          flows on Starknet Sepolia testnet.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#verify"
            className="inline-flex rounded-xl bg-gradient-to-b from-falcon-primary to-falcon-primary/80 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-falcon-primary/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-falcon-primary/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-falcon-bg"
          >
            Try Verification
          </a>
          <a
            href="#deploy"
            className="glass-card-static inline-flex rounded-xl px-7 py-3.5 text-sm font-semibold text-falcon-text/80 transition-all duration-200 hover:scale-[1.02] hover:text-falcon-text active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-falcon-bg"
          >
            Deploy Account
          </a>
        </div>

        <dl className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl px-6 py-6">
              <dt className="text-sm text-falcon-text/40">{stat.label}</dt>
              <dd className="mt-2 tabular-nums text-3xl font-semibold tracking-tight text-falcon-accent/80">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
