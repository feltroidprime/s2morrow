import React from "react"

const NAV_LINKS = [
  { href: "#hero", label: "Home" },
  { href: "#verify", label: "Verify" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#deploy", label: "Deploy" },
] as const

export function NavHeader(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-falcon-muted/20 bg-falcon-bg/80 backdrop-blur-sm">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3"
      >
        <a href="#hero" className="text-sm font-bold text-falcon-accent">
          Falcon-512
        </a>
        <ul className="flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-falcon-muted transition-colors hover:text-falcon-text"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
