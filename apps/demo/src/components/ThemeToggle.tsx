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
    "falcon-bg": "#fafbfd",
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

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    document.documentElement.className = document.documentElement.className.replace(/dark|light/, theme)
    if (!document.documentElement.className.includes(theme)) {
      document.documentElement.classList.add(theme)
    }
  }, [theme])

  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"))

  return (
    <button
      onClick={toggle}
      className="glass-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 hover:scale-105"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      data-testid="theme-toggle"
      data-theme={theme}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-falcon-text/50 transition-transform duration-500"
        style={{ transform: theme === "dark" ? "rotate(0deg)" : "rotate(180deg)" }}
      >
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </>
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        )}
      </svg>
    </button>
  )
}
