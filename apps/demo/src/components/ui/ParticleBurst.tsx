"use client"

import React, { useEffect, useRef } from "react"

interface ParticleBurstProps {
  readonly trigger: boolean
  readonly colors?: string[]
}

const DEFAULT_COLORS = ["#6366f1", "#06b6d4", "#10b981"]
const PARTICLE_COUNT = 50
const RADIUS = 150

interface Particle {
  x: number
  y: number
  targetX: number
  targetY: number
  startX: number
  startY: number
  size: number
  color: string
}

export function ParticleBurst({ trigger, colors = DEFAULT_COLORS }: ParticleBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const triggered = useRef(false)

  useEffect(() => {
    if (!trigger || triggered.current) return
    triggered.current = true

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    const cx = canvas.width / 2
    const cy = canvas.height / 2

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * RADIUS + 40
      return {
        startX: cx + Math.cos(angle) * dist,
        startY: cy + Math.sin(angle) * dist,
        x: 0,
        y: 0,
        targetX: cx + Math.cos(angle) * (dist * 1.8),
        targetY: cy + Math.sin(angle) * (dist * 1.8),
        size: 2 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      }
    })

    const totalMs = 1200
    const convergeEnd = 0.5
    const holdEnd = 0.58
    const start = performance.now()

    const animate = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / totalMs, 1)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        let x: number, y: number, alpha: number

        if (t < convergeEnd) {
          // Converge to center
          const ct = easeInCubic(t / convergeEnd)
          x = p.startX + (cx - p.startX) * ct
          y = p.startY + (cy - p.startY) * ct
          alpha = 0.8
        } else if (t < holdEnd) {
          // Hold at center
          x = cx
          y = cy
          alpha = 1
        } else {
          // Burst outward
          const bt = easeOutCubic((t - holdEnd) / (1 - holdEnd))
          x = cx + (p.targetX - cx) * bt
          y = cy + (p.targetY - cy) * bt
          alpha = 1 - bt
        }

        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size)
      }

      if (t < 1) {
        requestAnimationFrame(animate)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }

    requestAnimationFrame(animate)

    return () => {
      triggered.current = false
    }
  }, [trigger, colors])

  // Reset triggered when trigger goes false
  useEffect(() => {
    if (!trigger) triggered.current = false
  }, [trigger])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}

function easeInCubic(t: number): number {
  return t * t * t
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
