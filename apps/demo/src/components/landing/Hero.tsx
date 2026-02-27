const HERO_STATS = [
  { value: "65%", label: "Less gas than secp256r1", unit: "savings" },
  { value: "62", label: "17x calldata compression", unit: "felts" },
  { value: "29", label: "Fits one contract", unit: "slots" },
] as const

export function Hero(): React.JSX.Element {
  return (
    <section id="hero" aria-labelledby="hero-heading" className="relative px-8 py-36 sm:py-44 lg:px-8">
      <div className="lattice-grid" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl text-center">
        <p className="terminal-whisper text-falcon-success/50 text-glow">
          Live on Starknet Sepolia
        </p>
        <h1
          id="hero-heading"
          className="mt-8 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[0.05em] uppercase text-falcon-text/80 sm:text-6xl"
        >
          Quantum-proof wallets.{" "}
          <span className="text-falcon-accent/90 text-glow">No hard fork required.</span>
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-sm leading-relaxed text-falcon-text/45 sm:text-base">
          Starknet&apos;s account abstraction lets you upgrade to post-quantum signatures today.
          This is a working demo &mdash; generate keys, sign, verify, and deploy. All in your browser.
        </p>

        <div className="mt-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#verify"
            className="inline-flex border border-falcon-accent/30 bg-falcon-accent/10 px-7 py-3.5 text-[12px] font-semibold tracking-[0.1em] uppercase text-falcon-accent shadow-[0_0_20px_-5px_rgba(0,255,65,0.15)] transition-all duration-300 hover:bg-falcon-accent/15 hover:shadow-[0_0_30px_-5px_rgba(0,255,65,0.25)] hover:border-falcon-accent/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-falcon-accent/40"
          >
            Try It Live
          </a>
          <a
            href="#pipeline"
            className="glass-card-static inline-flex px-7 py-3.5 text-[12px] font-medium tracking-[0.1em] uppercase text-falcon-text/65 transition-all duration-300 hover:text-falcon-text/75 hover:border-falcon-accent/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-falcon-accent/20"
          >
            How It Works
          </a>
        </div>

        <dl className="mx-auto mt-20 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="glass-card corner-brackets p-8">
              <dd className="flex items-baseline gap-1.5">
                <span className="tabular-nums text-3xl font-bold tracking-tight text-falcon-accent/70 text-glow">
                  {stat.value}
                </span>
                <span className="text-[10px] tracking-wider uppercase text-falcon-text/40">
                  {stat.unit}
                </span>
              </dd>
              <dt className="mt-3 text-[11px] tracking-wide text-falcon-text/75">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
