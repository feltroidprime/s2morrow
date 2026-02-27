const CARDS = [
  {
    title: "Quantum computing is coming for ECDSA",
    description:
      "Shor\u2019s algorithm will eventually break the signature scheme that secures most blockchain wallets today. The entire ecosystem \u2014 Ethereum, L2s, and beyond \u2014 needs to prepare.",
  },
  {
    title: "The transition is hard, but it\u2019s starting",
    description:
      "Ethereum\u2019s roadmap now includes quantum resistance, but upgrading a protocol-level signature scheme means hard forks, new address formats, and wallet migrations. That takes time. On Starknet, you don\u2019t have to wait.",
  },
] as const

export function TheProblem(): React.JSX.Element {
  return (
    <section id="the-problem" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          The Quantum Challenge
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {CARDS.map((card) => (
            <div key={card.title} className="glass-card stagger-child rounded-2xl p-8">
              <h3 className="text-lg font-semibold tracking-tight text-falcon-text/90">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-falcon-text/70">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
