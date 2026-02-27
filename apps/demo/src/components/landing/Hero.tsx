const HERO_STATS = [
  { value: "132K", label: "Cheaper than secp256r1" },
  { value: "62", label: "17x calldata compression" },
  { value: "29", label: "Fits one contract" },
] as const

export function Hero(): React.JSX.Element {
  return (
    <section id="hero" aria-labelledby="hero-heading" className="relative px-8 py-32 sm:py-40 lg:px-8">
      <div className="lattice-grid" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl text-center">
        <p className="text-xs font-semibold tracking-[0.25em] text-falcon-success/80 uppercase">
          Live on Starknet Sepolia
        </p>
        <h1
          id="hero-heading"
          className="mt-6 text-4xl font-semibold tracking-[-0.02em] text-falcon-text sm:text-6xl"
        >
          Quantum-proof wallets.{" "}
          <span className="text-falcon-accent">No hard fork required.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-falcon-text/60 sm:text-lg">
          Starknet&apos;s account abstraction lets you upgrade to post-quantum signatures today.
          This is a working demo &mdash; generate keys, sign, verify, and deploy. All in your browser.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#verify"
            className="inline-flex rounded-xl bg-gradient-to-b from-falcon-primary to-falcon-primary/80 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-falcon-primary/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-falcon-primary/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-falcon-bg"
          >
            Try It Live
          </a>
          <a
            href="#pipeline"
            className="glass-card-static inline-flex rounded-xl px-7 py-3.5 text-sm font-semibold text-falcon-text/80 transition-all duration-200 hover:scale-[1.02] hover:text-falcon-text active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-falcon-bg"
          >
            How It Works
          </a>
        </div>

        <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl px-6 py-6">
              <dd className="tabular-nums text-3xl font-semibold tracking-tight text-falcon-accent/80">
                {stat.value}
              </dd>
              <dt className="mt-2 text-xs text-falcon-text/50">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
