import { Atom } from "@effect-atom/atom"
import type { PipelineStep } from "../services/types"

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "sign-tx",
    name: "Sign with Falcon-512",
    phase: "client",
    description:
      "The wallet signs the transaction hash using Falcon-512 lattice-based signatures. The signature, salt, and verification hint are packed into 87 felt252 values.",
    insight:
      "Starknet\u2019s signature field is Array<felt252> \u2014 any length, any scheme. The protocol never interprets it.",
    input: "tx_hash + secret key",
    output: "87 felt252 (packed signature)",
    stepCount: 0,
    status: "pending",
  },
  {
    id: "validate",
    name: "__validate__",
    phase: "validation",
    description:
      "The sequencer calls __validate__ on the account contract. Signature verification lives in user-space contract code, not the protocol.",
    insight:
      "On Ethereum, ECDSA is hardcoded in the protocol. On Starknet, every account chooses its own verification. No hard fork needed.",
    input: "get_tx_info() \u2192 hash + signature",
    output: "VALIDATED or revert",
    stepCount: 0,
    status: "pending",
  },
  {
    id: "falcon-verify",
    name: "Falcon-512 verify",
    phase: "validation",
    description:
      "Unpack 29-slot polynomials to 512 Zq coefficients. Run hash_to_point, 2 forward NTTs, pointwise product check, and Euclidean norm bound. 132K Cairo steps total.",
    insight:
      "132K steps \u2014 43% cheaper than secp256r1 ECDSA (230K). The hint-based approach eliminates inverse NTTs entirely.",
    input: "pk (29 slots), sig (29 slots), mul_hint (29 slots)",
    output: "valid (\u2016(s0,s1)\u2016\u00b2 \u2264 34,034,726)",
    stepCount: 132000,
    status: "pending",
  },
  {
    id: "execute",
    name: "__execute__",
    phase: "execution",
    description:
      "Validation passed. The protocol calls __execute__ to process the transaction\u2019s calls. Execution is completely decoupled from signature verification.",
    insight:
      "Any validated account can execute any calls. Upgrading to post-quantum signatures doesn\u2019t break existing functionality.",
    input: "Array<Call>",
    output: "State transitions",
    stepCount: 0,
    status: "pending",
  },
  {
    id: "stark-proof",
    name: "STARK proof",
    phase: "settlement",
    description:
      "The execution trace \u2014 including Falcon verification \u2014 is proven with STARKs and submitted to Ethereum L1. STARKs are hash-based, not curve-based.",
    insight:
      "Falcon secures the signature. STARKs secure the proof. No elliptic curve cryptography in the critical path.",
    input: "Execution trace",
    output: "Validity proof \u2192 Ethereum L1",
    stepCount: 0,
    status: "pending",
  },
  {
    id: "settled",
    name: "Settled on L1",
    phase: "settlement",
    description:
      "The state diff is verified on Ethereum. Your quantum-safe transaction has the same finality guarantees as any Starknet transaction.",
    insight:
      "Post-quantum security is just an account contract choice. Same network, same finality, same composability.",
    input: "STARK proof",
    output: "Finality on Ethereum",
    stepCount: 0,
    status: "pending",
  },
]

export const INITIAL_PIPELINE_STEPS = PIPELINE_STEPS

export const pipelineStepsAtom = Atom.make<PipelineStep[]>(PIPELINE_STEPS)

export const pipelineActiveStepAtom = Atom.make<number>(-1)

export const pipelinePlayingAtom = Atom.make(false)
