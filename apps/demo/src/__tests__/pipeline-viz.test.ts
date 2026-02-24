/**
 * Integration tests for Pipeline Visualizer (pipeline-viz)
 *
 * Tests the atoms and state machine logic for the 6-step animated walkthrough.
 * These tests cover:
 *   - INITIAL_PIPELINE_STEPS data correctness (6 steps, correct counts)
 *   - Atom initial values (pipelineStepsAtom, pipelineActiveStepAtom, pipelinePlayingAtom)
 *   - State transitions via Registry (play → step through → reset)
 *
 * The PipelineVisualizer.tsx component is NOT YET IMPLEMENTED.
 * These tests verify the data and atom layer that the component will depend on.
 *
 * Test runner: bun test
 * Dependency: @effect-atom/atom Registry API for read/write without React
 */

import { describe, it, expect, beforeEach } from "bun:test"
import { Registry } from "@effect-atom/atom"
import {
  INITIAL_PIPELINE_STEPS,
  pipelineStepsAtom,
  pipelineActiveStepAtom,
  pipelinePlayingAtom,
} from "../atoms/pipeline"
import type { PipelineStep } from "../services/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simulate the updateStepStatuses logic from PipelineVisualizer.tsx */
function computeStepStatuses(
  steps: PipelineStep[],
  activeIdx: number,
): PipelineStep[] {
  return steps.map((s, i) => ({
    ...s,
    status:
      i < activeIdx
        ? "complete"
        : i === activeIdx
          ? "active"
          : "pending",
  }))
}

/** Create a fresh Registry for each test (isolated state) */
function makeRegistry() {
  return Registry.make({
    initialValues: [
      [pipelineStepsAtom, INITIAL_PIPELINE_STEPS],
      [pipelineActiveStepAtom, -1],
      [pipelinePlayingAtom, false],
    ],
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("INITIAL_PIPELINE_STEPS data", () => {
  it("has exactly 6 pipeline steps", () => {
    expect(INITIAL_PIPELINE_STEPS).toHaveLength(6)
  })

  it("all steps start with status pending", () => {
    for (const step of INITIAL_PIPELINE_STEPS) {
      expect(step.status).toBe("pending")
    }
  })

  it("step IDs are unique", () => {
    const ids = INITIAL_PIPELINE_STEPS.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(6)
  })

  it("step counts match PRD specification", () => {
    // From docs/specs/falcon-demo-website.md
    const expected = [5988, 15000, 1500, 15000, 500, 26000]
    const actual = INITIAL_PIPELINE_STEPS.map((s) => s.stepCount)
    expect(actual).toEqual(expected)
  })

  it("total step count is ~63988 (matches README ~63K)", () => {
    const total = INITIAL_PIPELINE_STEPS.reduce((sum, s) => sum + s.stepCount, 0)
    // PRD says ~63K steps total for verify
    expect(total).toBeGreaterThanOrEqual(60000)
    expect(total).toBeLessThanOrEqual(70000)
  })

  it("step names match specification", () => {
    const names = INITIAL_PIPELINE_STEPS.map((s) => s.name)
    expect(names[0]).toBe("hash_to_point")
    expect(names[1]).toBe("NTT(s1)")
    expect(names[2]).toBe("s1_ntt * pk_ntt")
    expect(names[3]).toBe("NTT(mul_hint)")
    expect(names[4]).toBe("s0 = msg_point - mul_hint")
    expect(names[5]).toContain("‖")  // norm check uses ‖ symbol
  })

  it("step IDs match expected values", () => {
    const ids = INITIAL_PIPELINE_STEPS.map((s) => s.id)
    expect(ids[0]).toBe("hash-to-point")
    expect(ids[1]).toBe("ntt-s1")
    expect(ids[2]).toBe("pointwise-mul")
    expect(ids[3]).toBe("ntt-hint")
    expect(ids[4]).toBe("recover-s0")
    expect(ids[5]).toBe("norm-check")
  })

  it("all steps have non-empty input/output/description fields", () => {
    for (const step of INITIAL_PIPELINE_STEPS) {
      expect(step.input).toBeTruthy()
      expect(step.output).toBeTruthy()
      expect(step.description).toBeTruthy()
    }
  })
})

describe("pipeline atoms — initial state", () => {
  let registry: Registry.Registry

  beforeEach(() => {
    registry = makeRegistry()
  })

  it("pipelineStepsAtom initial value has 6 steps", () => {
    const steps = registry.get(pipelineStepsAtom)
    expect(steps).toHaveLength(6)
  })

  it("pipelineActiveStepAtom initial value is -1 (no active step)", () => {
    const activeStep = registry.get(pipelineActiveStepAtom)
    expect(activeStep).toBe(-1)
  })

  it("pipelinePlayingAtom initial value is false (not playing)", () => {
    const playing = registry.get(pipelinePlayingAtom)
    expect(playing).toBe(false)
  })

  it("all pipeline steps start as pending", () => {
    const steps = registry.get(pipelineStepsAtom)
    for (const step of steps) {
      expect(step.status).toBe("pending")
    }
  })
})

describe("pipeline atoms — play/step state transitions", () => {
  let registry: Registry.Registry

  beforeEach(() => {
    registry = makeRegistry()
  })

  it("setPlaying(true) updates pipelinePlayingAtom", () => {
    registry.set(pipelinePlayingAtom, true)
    expect(registry.get(pipelinePlayingAtom)).toBe(true)
  })

  it("step 0 becomes active when activeStep is set to 0", () => {
    registry.set(pipelineActiveStepAtom, 0)
    const activeStep = registry.get(pipelineActiveStepAtom)
    expect(activeStep).toBe(0)

    // Update step statuses (simulating PipelineVisualizer.updateStepStatuses(0))
    const steps = registry.get(pipelineStepsAtom)
    const updated = computeStepStatuses(steps, 0)
    registry.set(pipelineStepsAtom, updated)

    const updatedSteps = registry.get(pipelineStepsAtom)
    expect(updatedSteps[0].status).toBe("active")
    expect(updatedSteps[1].status).toBe("pending")
    expect(updatedSteps[5].status).toBe("pending")
  })

  it("after advancing to step 3, steps 0-2 are complete, step 3 is active, rest pending", () => {
    registry.set(pipelineActiveStepAtom, 3)
    const steps = registry.get(pipelineStepsAtom)
    const updated = computeStepStatuses(steps, 3)
    registry.set(pipelineStepsAtom, updated)

    const updatedSteps = registry.get(pipelineStepsAtom)
    expect(updatedSteps[0].status).toBe("complete")
    expect(updatedSteps[1].status).toBe("complete")
    expect(updatedSteps[2].status).toBe("complete")
    expect(updatedSteps[3].status).toBe("active")
    expect(updatedSteps[4].status).toBe("pending")
    expect(updatedSteps[5].status).toBe("pending")
  })

  it("at the last step (5), steps 0-4 are complete, step 5 is active", () => {
    registry.set(pipelineActiveStepAtom, 5)
    const steps = registry.get(pipelineStepsAtom)
    const updated = computeStepStatuses(steps, 5)
    registry.set(pipelineStepsAtom, updated)

    const updatedSteps = registry.get(pipelineStepsAtom)
    for (let i = 0; i < 5; i++) {
      expect(updatedSteps[i].status).toBe("complete")
    }
    expect(updatedSteps[5].status).toBe("active")
  })

  it("reset: all steps return to pending, activeStep to -1, playing to false", () => {
    // First advance to step 3
    registry.set(pipelineActiveStepAtom, 3)
    registry.set(pipelinePlayingAtom, true)
    const steps = registry.get(pipelineStepsAtom)
    registry.set(pipelineStepsAtom, computeStepStatuses(steps, 3))

    // Now reset
    registry.set(pipelinePlayingAtom, false)
    registry.set(pipelineActiveStepAtom, -1)
    const resetSteps = registry.get(pipelineStepsAtom)
    registry.set(
      pipelineStepsAtom,
      resetSteps.map((s) => ({ ...s, status: "pending" as const })),
    )

    // Verify reset state
    expect(registry.get(pipelinePlayingAtom)).toBe(false)
    expect(registry.get(pipelineActiveStepAtom)).toBe(-1)
    const finalSteps = registry.get(pipelineStepsAtom)
    for (const step of finalSteps) {
      expect(step.status).toBe("pending")
    }
  })

  it("step atom can be advanced one step at a time", () => {
    // Simulate: no active step → step 0 → step 1 → step 2
    for (let i = 0; i <= 2; i++) {
      registry.set(pipelineActiveStepAtom, i)
      const steps = registry.get(pipelineStepsAtom)
      registry.set(pipelineStepsAtom, computeStepStatuses(steps, i))
    }

    const finalSteps = registry.get(pipelineStepsAtom)
    expect(registry.get(pipelineActiveStepAtom)).toBe(2)
    expect(finalSteps[0].status).toBe("complete")
    expect(finalSteps[1].status).toBe("complete")
    expect(finalSteps[2].status).toBe("active")
    expect(finalSteps[3].status).toBe("pending")
  })

  it("step immutability: updating steps does not mutate INITIAL_PIPELINE_STEPS", () => {
    const steps = registry.get(pipelineStepsAtom)
    const updated = computeStepStatuses(steps, 2)
    registry.set(pipelineStepsAtom, updated)

    // Original constant should be unchanged
    for (const step of INITIAL_PIPELINE_STEPS) {
      expect(step.status).toBe("pending")
    }
  })
})

describe("computeStepStatuses helper — state machine logic", () => {
  const steps = INITIAL_PIPELINE_STEPS

  it("at index -1: all steps remain pending", () => {
    const result = computeStepStatuses(steps, -1)
    // When activeIdx is -1, no step satisfies i === -1, so all stay "pending"
    // (i < -1 is never true for non-negative i)
    for (const s of result) {
      expect(s.status).toBe("pending")
    }
  })

  it("at index 0: first step is active, rest pending", () => {
    const result = computeStepStatuses(steps, 0)
    expect(result[0].status).toBe("active")
    for (let i = 1; i < result.length; i++) {
      expect(result[i].status).toBe("pending")
    }
  })

  it("at index 2: first two complete, third active, rest pending", () => {
    const result = computeStepStatuses(steps, 2)
    expect(result[0].status).toBe("complete")
    expect(result[1].status).toBe("complete")
    expect(result[2].status).toBe("active")
    expect(result[3].status).toBe("pending")
    expect(result[4].status).toBe("pending")
    expect(result[5].status).toBe("pending")
  })

  it("at index 5 (last): all five previous complete, last active", () => {
    const result = computeStepStatuses(steps, 5)
    for (let i = 0; i < 5; i++) {
      expect(result[i].status).toBe("complete")
    }
    expect(result[5].status).toBe("active")
  })

  it("preserves step id, name, description, stepCount (immutable fields)", () => {
    const result = computeStepStatuses(steps, 1)
    for (let i = 0; i < result.length; i++) {
      expect(result[i].id).toBe(steps[i].id)
      expect(result[i].name).toBe(steps[i].name)
      expect(result[i].description).toBe(steps[i].description)
      expect(result[i].stepCount).toBe(steps[i].stepCount)
    }
  })
})
