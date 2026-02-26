export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-[var(--glass-border)] px-8 py-12 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm sm:flex-row">
        <p className="text-falcon-text/30">Built for the Falcon-512 Starknet demo.</p>
        <nav aria-label="Footer links" className="flex items-center gap-6">
          <a
            href="https://github.com/feltroidprime/s2morrow"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            GitHub
          </a>
          <a
            href="https://docs.starknet.io"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Read Starknet documentation"
            className="text-falcon-text/50 transition-colors duration-200 hover:text-falcon-accent"
          >
            Starknet Docs
          </a>
        </nav>
      </div>
    </footer>
  )
}
