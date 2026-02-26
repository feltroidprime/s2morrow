const POINTS = [
  {
    number: "01",
    title: "Native Account Abstraction",
    description:
      "Signature logic lives in the contract, not the protocol. Every wallet chooses its own verification.",
  },
  {
    number: "02",
    title: "Falcon-512",
    description:
      "NIST-standardized lattice-based signatures. Battle-tested math with tight security proofs.",
  },
  {
    number: "03",
    title: "Cheaper than ECDSA",
    description:
      "132K Cairo steps. The post-quantum future costs less than the signature scheme you use today.",
  },
] as const

export function WhyStarknet(): React.JSX.Element {
  return (
    <section id="why-starknet" className="starknet-section px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          Starknet already solved this.
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-falcon-text/60 sm:text-lg">
          Account abstraction means every wallet chooses its own signature verification.
          No protocol change. No hard fork. No migration. Deploy a new account contract,
          and your wallet is quantum-safe.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {POINTS.map((point) => (
            <div key={point.number} className="glass-card stagger-child rounded-2xl p-8">
              <span className="font-mono text-xs font-semibold text-falcon-primary/60">
                {point.number}
              </span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-falcon-text/90">
                {point.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-falcon-text/50">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
