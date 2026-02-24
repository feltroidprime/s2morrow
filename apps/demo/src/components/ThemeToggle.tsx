"use client"

import { useEffect, useState } from "react"

export type Theme = "dark" | "light"

/** Design-system color tokens for each theme (mirrors globals.css) */
export const THEME_TOKENS = {
  dark: {
    "falcon-bg": "#0f172a",
    "falcon-surface": "#1e293b",
    "falcon-text": "#f8fafc",
    "falcon-muted": "#94a3b8",
  },
  light: {
    "falcon-bg": "#ffffff",
    "falcon-surface": "#f1f5f9",
    "falcon-text": "#0f172a",
    "falcon-muted": "#64748b",
  },
} as const satisfies Record<Theme, Record<string, string>>

/** Brand colors — same across light and dark */
export const BRAND_TOKENS = {
  "falcon-primary": "#6366f1",
  "falcon-secondary": "#8b5cf6",
  "falcon-accent": "#06b6d4",
  "falcon-success": "#10b981",
  "falcon-error": "#ef4444",
} as const satisfies Record<string, string>

/**
 * ThemeToggle — floating button that switches the <html> className
 * between "dark" and "light", triggering Tailwind's class-based dark mode.
 *
 * Defaults to dark (matching the SSR layout.tsx className="dark").
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    document.documentElement.className = theme
  }, [theme])

  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"))

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 rounded-lg border border-falcon-muted/20 bg-falcon-surface p-2 text-sm hover:bg-falcon-surface/80 transition-colors"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      data-testid="theme-toggle"
      data-theme={theme}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  )
}
