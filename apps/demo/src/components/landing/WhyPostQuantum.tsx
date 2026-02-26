const CARDS = [
  {
    title: "Quantum Threat",
    description:
      "Shor's algorithm on a cryptographically-relevant quantum computer breaks ECDSA. Every Ethereum and Starknet wallet using ECDSA becomes vulnerable.",
  },
  {
    title: "Account Abstraction",
    description:
      "Starknet's native account abstraction lets wallets upgrade their signature verification logic without changing addresses. No hard fork needed.",
  },
  {
    title: "Falcon-512",
    description:
      "NIST-standardized lattice-based signature scheme. 666-byte signatures, 896-byte public keys. Based on NTRU lattices with tight security proofs.",
  },
  {
    title: "Hint-Based Verification",
    description:
      "Off-chain signer provides a precomputed hint, reducing on-chain work from 4 NTTs to 2 NTTs. Cuts verification cost by ~50%.",
  },
] as const

export function WhyPostQuantum() {
  return (
    <section id="why-post-quantum" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          Why Post-Quantum?
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {CARDS.map((card) => (
            <div key={card.title} className="glass-card stagger-child rounded-2xl p-8">
              <h3 className="text-lg font-semibold tracking-tight text-falcon-text/90">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-falcon-text/40">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
