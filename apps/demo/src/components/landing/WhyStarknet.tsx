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
      "~9.5M L2 gas \u2014 only 2x garaga ECDSA, 65% less than secp256r1 syscall. Quantum safety at competitive cost.",
  },
] as const

export function WhyStarknet(): React.JSX.Element {
  return (
    <section id="why-starknet" className="starknet-section px-8 py-36 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[0.08em] uppercase text-falcon-text/85 sm:text-4xl">
          Starknet is ready today.
        </h2>
        <p className="mx-auto mt-8 max-w-3xl text-sm leading-relaxed text-falcon-text/70 sm:text-base">
          While the ecosystem works toward protocol-level quantum resistance,
          Starknet&apos;s account abstraction lets you act now. Deploy a new account contract
          with post-quantum signatures &mdash; no protocol change, no hard fork, no migration.
        </p>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {POINTS.map((point) => (
            <div key={point.number} className="glass-card corner-brackets scan-hover stagger-child p-10">
              <span className="text-[10px] font-semibold tracking-[0.2em] text-falcon-accent/60">
                {point.number}
              </span>
              <h3 className="mt-4 text-sm font-semibold tracking-wide text-falcon-text/85">
                {point.title}
              </h3>
              <p className="mt-4 text-xs leading-relaxed text-falcon-text/75">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
