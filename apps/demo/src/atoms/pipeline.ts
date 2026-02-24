import { Atom } from "@effect-atom/atom"
import type { PipelineStep } from "../services/types"

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "hash-to-point",
    name: "hash_to_point",
    description: "Poseidon hash: message || salt → 512 Zq coefficients",
    input: "message + salt",
    output: "512 coefficients ∈ [0, 12289)",
    stepCount: 5988,
    status: "pending",
  },
  {
    id: "ntt-s1",
    name: "NTT(s1)",
    description: "Forward NTT on signature polynomial s1",
    input: "s1 (512 coefficients)",
    output: "s1_ntt (frequency domain)",
    stepCount: 15000,
    status: "pending",
  },
  {
    id: "pointwise-mul",
    name: "s1_ntt * pk_ntt",
    description: "Pointwise multiplication in NTT domain",
    input: "s1_ntt, pk_ntt",
    output: "product_ntt (512 values)",
    stepCount: 1500,
    status: "pending",
  },
  {
    id: "ntt-hint",
    name: "NTT(mul_hint)",
    description: "Forward NTT on verification hint (provided off-chain)",
    input: "mul_hint (512 coefficients)",
    output: "hint_ntt — must equal product_ntt",
    stepCount: 15000,
    status: "pending",
  },
  {
    id: "recover-s0",
    name: "s0 = msg_point - mul_hint",
    description: "Recover s0 from message point and hint",
    input: "msg_point, mul_hint",
    output: "s0 (512 coefficients)",
    stepCount: 500,
    status: "pending",
  },
  {
    id: "norm-check",
    name: "‖(s0, s1)‖² ≤ bound",
    description: "Check combined Euclidean norm against security bound",
    input: "s0, s1",
    output: "pass/fail (bound = 34,034,726)",
    stepCount: 26000,
    status: "pending",
  },
]

export const INITIAL_PIPELINE_STEPS = PIPELINE_STEPS

export const pipelineStepsAtom = Atom.make<PipelineStep[]>(PIPELINE_STEPS)

export const pipelineActiveStepAtom = Atom.make<number>(-1)

export const pipelinePlayingAtom = Atom.make(false)
