"use client"

import { useEffect, useRef, type ReactNode } from "react"

interface ScrollRevealProps {
  readonly children: ReactNode
  readonly className?: string
}

export function ScrollReveal({ children, className = "" }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Check if reduced motion is preferred
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("visible")
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible")
          observer.unobserve(el)
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px 0px" },
    )

    observer.observe(el)

    // Fallback: ensure visibility after 2s even if observer never fires
    const fallback = setTimeout(() => {
      el.classList.add("visible")
    }, 2000)

    return () => {
      observer.disconnect()
      clearTimeout(fallback)
    }
  }, [])

  return (
    <div ref={ref} className={`fade-in-section ${className}`}>
      {children}
    </div>
  )
}
