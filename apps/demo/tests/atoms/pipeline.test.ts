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

  it("step IDs are correct and in order (AA lifecycle)", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const ids = steps.map((s) => s.id)
    expect(ids).toEqual([
      "sign-tx",
      "validate",
      "falcon-verify",
      "execute",
      "stark-proof",
      "settled",
    ])
  })

  it("falcon-verify step has stepCount = 9500000 (~9.5M L2 gas)", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const verifyStep = steps.find((s) => s.id === "falcon-verify")!
    expect(verifyStep.stepCount).toBe(9500000)
  })

  it("only falcon-verify has a non-zero stepCount", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    for (const step of steps) {
      if (step.id === "falcon-verify") {
        expect(step.stepCount).toBe(9500000)
      } else {
        expect(step.stepCount).toBe(0)
      }
    }
  })

  it("step counts match: [0, 0, 9500000, 0, 0, 0]", () => {
    const registry = makeRegistry()
    const steps = registry.get(pipelineStepsAtom)
    const counts = steps.map((s) => s.stepCount)
    expect(counts).toEqual([0, 0, 9500000, 0, 0, 0])
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
