/**
 * Unit tests for pipeline.ts atoms.
 *
 * Tests cover:
 * - Default states of pipelineStepsAtom (6 steps, all pending)
 * - Exact step counts matching README profiling metrics
 * - Default state of pipelineActiveStepAtom (-1)
 * - Default state of pipelinePlayingAtom (false)
 * - keepAlive = false on all pipeline atoms
 */

import { describe, it, expect } from "bun:test"
import { Registry } from "@effect-atom/atom"

import {
  pipelineStepsAtom,
  pipelineActiveStepAtom,
  pipelinePlayingAtom,
  INITIAL_PIPELINE_STEPS,
} from "../../src/atoms/pipeline"

function makeRegistry() {
  return Registry.make()
}

// ─────────────────────────────────────────────────────────────────────────────
// keepAlive properties
// ─────────────────────────────────────────────────────────────────────────────

describe("pipeline atom.keepAlive properties", () => {
  it("pipelineStepsAtom has keepAlive = false (default)", () => {
    expect(pipelineStepsAtom.keepAlive).toBe(false)
  })

  it("pipelineActiveStepAtom has keepAlive = false (default)", () => {
    expect(pipelineActiveStepAtom.keepAlive).toBe(false)
  })

  it("pipelinePlayingAtom has keepAlive = false (default)", () => {
    expect(pipelinePlayingAtom.keepAlive).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pipelineStepsAtom — exact 6 steps with README step counts
// ─────────────────────────────────────────────────────────────────────────────

describe("pipelineStepsAtom defaults", () => {
  it("has exactly 6 initial pipeline steps", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps).toHaveLength(6)
  })

  it("all 6 initial steps have status 'pending'", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps.every((s) => s.status === "pending")).toBe(true)
  })

  it("step IDs are correct and in order", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const ids = steps.map((s) => s.id)
    expect(ids).toEqual([
      "hash-to-point",
      "ntt-s1",
      "pointwise-mul",
      "ntt-hint",
      "recover-s0",
      "norm-check",
    ])
  })

  it("step[0] hash-to-point has stepCount = 5988 (README: hash_to_point profiling)", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps[0].id).toBe("hash-to-point")
    expect(steps[0].stepCount).toBe(5988)
  })

  it("step[1] NTT(s1) has stepCount = 15000 (NTT-512 approximate)", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps[1].id).toBe("ntt-s1")
    expect(steps[1].stepCount).toBe(15000)
  })

  it("step[2] pointwise-mul has stepCount = 1500", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps[2].id).toBe("pointwise-mul")
    expect(steps[2].stepCount).toBe(1500)
  })

  it("step[3] NTT(mul_hint) has stepCount = 15000", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps[3].id).toBe("ntt-hint")
    expect(steps[3].stepCount).toBe(15000)
  })

  it("step[4] recover-s0 has stepCount = 500", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps[4].id).toBe("recover-s0")
    expect(steps[4].stepCount).toBe(500)
  })

  it("step[5] norm-check has stepCount = 26000 (norm check dominates: ~26K steps)", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    expect(steps[5].id).toBe("norm-check")
    expect(steps[5].stepCount).toBe(26000)
  })

  it("total step count = 63988 (5988+15000+1500+15000+500+26000)", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const total = steps.reduce((sum, s) => sum + s.stepCount, 0)
    expect(total).toBe(63988)
  })

  it("step counts match the exact spec: [5988, 15000, 1500, 15000, 500, 26000]", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const counts = steps.map((s) => s.stepCount)
    expect(counts).toEqual([5988, 15000, 1500, 15000, 500, 26000])
  })

  it("can reset all steps to pending via INITIAL_PIPELINE_STEPS", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    // advance to complete
    registry.set(pipelineStepsAtom, steps.map((s) => ({ ...s, status: "complete" as const })))
    expect(registry.get(pipelineStepsAtom).every((s) => s.status === "complete")).toBe(true)
    // reset
    registry.set(pipelineStepsAtom, INITIAL_PIPELINE_STEPS)
    expect(registry.get(pipelineStepsAtom).every((s) => s.status === "pending")).toBe(true)
  })

  it("each step has required fields: id, name, description, input, output, stepCount, status", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    for (const step of steps) {
      expect(typeof step.id).toBe("string")
      expect(typeof step.name).toBe("string")
      expect(typeof step.description).toBe("string")
      expect(typeof step.input).toBe("string")
      expect(typeof step.output).toBe("string")
      expect(typeof step.stepCount).toBe("number")
      expect(["pending", "active", "complete"]).toContain(step.status)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pipelineActiveStepAtom — default state
// ─────────────────────────────────────────────────────────────────────────────

describe("pipelineActiveStepAtom defaults", () => {
  it("has initial value -1 (no active step)", () => {
    const registry = makeRegistry()
    expect(registry.get(pipelineActiveStepAtom)).toBe(-1)
  })

  it("can be set to any step index 0-5", () => {
    const registry = makeRegistry()
    for (let i = 0; i < 6; i++) {
      registry.set(pipelineActiveStepAtom, i)
      expect(registry.get(pipelineActiveStepAtom)).toBe(i)
    }
  })

  it("can be reset to -1", () => {
    const registry = makeRegistry()
    registry.set(pipelineActiveStepAtom, 3)
    registry.set(pipelineActiveStepAtom, -1)
    expect(registry.get(pipelineActiveStepAtom)).toBe(-1)
  })

  it("supports increment via registry.update", () => {
    const registry = makeRegistry()
    registry.set(pipelineActiveStepAtom, 2)
    registry.update(pipelineActiveStepAtom, (prev) => prev + 1)
    expect(registry.get(pipelineActiveStepAtom)).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pipelinePlayingAtom — default state
// ─────────────────────────────────────────────────────────────────────────────

describe("pipelinePlayingAtom defaults", () => {
  it("has initial value false", () => {
    const registry = makeRegistry()
    expect(registry.get(pipelinePlayingAtom)).toBe(false)
  })

  it("transitions to true on play", () => {
    const registry = makeRegistry()
    registry.set(pipelinePlayingAtom, true)
    expect(registry.get(pipelinePlayingAtom)).toBe(true)
  })

  it("transitions to false on pause", () => {
    const registry = makeRegistry()
    registry.set(pipelinePlayingAtom, true)
    registry.set(pipelinePlayingAtom, false)
    expect(registry.get(pipelinePlayingAtom)).toBe(false)
  })

  it("toggle behavior via registry.update", () => {
    const registry = makeRegistry()
    registry.update(pipelinePlayingAtom, (v) => !v)
    expect(registry.get(pipelinePlayingAtom)).toBe(true)
    registry.update(pipelinePlayingAtom, (v) => !v)
    expect(registry.get(pipelinePlayingAtom)).toBe(false)
  })
})
