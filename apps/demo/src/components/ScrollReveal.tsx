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
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`fade-in-section ${className}`}>
      {children}
    </div>
  )
}
