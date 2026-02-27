export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-[var(--glass-border)] px-8 py-12 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* CTA row */}
        <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://github.com/feltroidprime/s2morrow"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex border border-falcon-accent/30 bg-falcon-accent/10 px-6 py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-falcon-accent transition-all duration-300 hover:bg-falcon-accent/15 hover:border-falcon-accent/50"
          >
            View on GitHub
          </a>
          <a
            href="https://x.com/feltroidPrime"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-btn inline-flex px-6 py-2.5 text-[11px] font-medium tracking-[0.1em] uppercase text-falcon-text/65 transition-all duration-300 hover:text-falcon-text/80"
          >
            Follow for Updates
          </a>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm sm:flex-row">
        <p className="text-falcon-text/50">
          Built by{" "}
          <a
            href="https://x.com/feltroidPrime"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/65 transition-colors duration-200 hover:text-falcon-accent"
          >
            @feltroidPrime
          </a>
        </p>
        <nav aria-label="Footer links" className="flex items-center gap-6">
          <a
            href="https://github.com/feltroidprime/s2morrow"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/65 transition-colors duration-200 hover:text-falcon-accent"
          >
            GitHub
          </a>
          <a
            href="https://docs.starknet.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/65 transition-colors duration-200 hover:text-falcon-accent"
          >
            Starknet Docs
          </a>
          <a
            href="https://falcon-sign.info/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/65 transition-colors duration-200 hover:text-falcon-accent"
          >
            Falcon Spec
          </a>
        </nav>
      </div>
    </footer>
  )
}
