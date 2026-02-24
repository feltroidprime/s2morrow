export function WhyPostQuantum() {
  return (
    <section id="why-post-quantum" className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight">Why Post-Quantum?</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <Card
            title="Quantum Threat"
            description="Shor's algorithm on a cryptographically-relevant quantum computer breaks ECDSA. Every Ethereum and Starknet wallet using ECDSA becomes vulnerable."
          />
          <Card
            title="Account Abstraction"
            description="Starknet's native account abstraction lets wallets upgrade their signature verification logic without changing addresses. No hard fork needed."
          />
          <Card
            title="Falcon-512"
            description="NIST-standardized lattice-based signature scheme. 666-byte signatures, 896-byte public keys. Based on NTRU lattices with tight security proofs."
          />
          <Card
            title="Hint-Based Verification"
            description="Off-chain signer provides a precomputed hint, reducing on-chain work from 4 NTTs to 2 NTTs. Cuts verification cost by ~50%."
          />
        </div>
      </div>
    </section>
  )
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-falcon-muted/20 bg-falcon-surface p-6">
      <h3 className="text-lg font-semibold text-falcon-text">{title}</h3>
      <p className="mt-2 text-sm text-falcon-muted leading-relaxed">{description}</p>
    </div>
  )
}
