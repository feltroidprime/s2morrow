export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-falcon-muted/20 px-6 py-10 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-sm sm:flex-row">
        <p className="text-falcon-muted">Built for the Falcon-512 Starknet demo.</p>
        <nav aria-label="Footer links" className="flex items-center gap-4">
          <a
            href="https://github.com/feltroidprime/s2morrow"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="font-medium text-falcon-text transition-colors hover:text-falcon-accent"
          >
            GitHub
          </a>
          <a
            href="https://docs.starknet.io"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Read Starknet documentation"
            className="font-medium text-falcon-text transition-colors hover:text-falcon-accent"
          >
            Starknet Docs
          </a>
        </nav>
      </div>
    </footer>
  )
}
