export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-[var(--glass-border)] px-8 py-12 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm sm:flex-row">
        <p className="text-falcon-text/30">
          Built by{" "}
          <a
            href="https://x.com/feltroidPrime"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            @feltroidPrime
          </a>
        </p>
        <nav aria-label="Footer links" className="flex items-center gap-6">
          <a
            href="https://github.com/feltroidprime/s2morrow"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            GitHub
          </a>
          <a
            href="https://docs.starknet.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            Starknet Docs
          </a>
          <a
            href="https://falcon-sign.info/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            Falcon Spec
          </a>
        </nav>
      </div>
    </footer>
  )
}
