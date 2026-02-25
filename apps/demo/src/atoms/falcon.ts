import { Atom } from "@effect-atom/atom"
import { Option } from "effect"
import type { FalconKeypair, FalconSignatureResult, PackedPublicKey, VerificationStep } from "../services/types"

export const wasmStatusAtom = Atom.make<"loading" | "ready" | "error">("loading").pipe(
  Atom.keepAlive,
)

export const keypairAtom = Atom.make<Option.Option<FalconKeypair>>(Option.none()).pipe(
  Atom.keepAlive,
)

export const signatureAtom = Atom.make<Option.Option<FalconSignatureResult>>(Option.none())

export const packedKeyAtom = Atom.make<Option.Option<PackedPublicKey>>(Option.none())

export const verificationStepAtom = Atom.make<VerificationStep>({ step: "idle" })

export const messageAtom = Atom.make("")
