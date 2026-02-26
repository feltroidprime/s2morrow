const CARDS = [
  {
    title: "Every wallet is a ticking clock",
    description:
      "Shor\u2019s algorithm breaks ECDSA. Not if \u2014 when. Every wallet on Ethereum and every L2 using ECDSA becomes vulnerable. The keys you use today will be exposed.",
  },
  {
    title: "Other chains can\u2019t fix this without breaking everything",
    description:
      "Switching signature schemes requires a hard fork, new address formats, wallet migrations. Ethereum\u2019s roadmap has no timeline for this. L2s that inherit Ethereum\u2019s signature scheme inherit the problem.",
  },
] as const

export function TheProblem(): React.JSX.Element {
  return (
    <section id="the-problem" className="px-8 py-32 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-falcon-text">
          The Problem
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {CARDS.map((card) => (
            <div key={card.title} className="glass-card stagger-child rounded-2xl p-8">
              <h3 className="text-lg font-semibold tracking-tight text-falcon-text/90">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-falcon-text/50">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
