const ITEMS = [
  {
    label: "NIST Standardized",
    href: "https://csrc.nist.gov/pubs/fips/206/final",
  },
  {
    label: "Built in Public",
    href: "https://x.com/feltroidPrime/status/2016231328065454142",
  },
  {
    label: "zknox Collaboration",
    href: "https://github.com/ZKNoxHQ/falzkon",
  },
  {
    label: "Open Source",
    href: "https://github.com/feltroidprime/s2morrow",
  },
] as const

export function CredibilityBar(): React.JSX.Element {
  return (
    <section aria-label="Credibility" className="border-y border-[var(--glass-border)] px-8 py-8 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {ITEMS.map((item, i) => (
          <span key={item.label} className="flex items-center gap-3">
            {i > 0 && (
              <span className="hidden text-falcon-text/15 sm:inline" aria-hidden="true">
                &middot;
              </span>
            )}
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium tracking-wide text-falcon-text/40 uppercase transition-colors duration-200 hover:text-falcon-accent"
            >
              {item.label}
            </a>
          </span>
        ))}
      </div>
    </section>
  )
}
