import { Atom } from "@effect-atom/atom"
import { Option } from "effect"
import { ContractAddress, TxHash } from "../services/types"

export type DeployStep =
  | { step: "idle" }
  | { step: "generating-keypair" }
  | { step: "packing" }
  | { step: "computing-address" }
  | { step: "awaiting-funds"; address: ContractAddress }
  | { step: "deploying"; address: ContractAddress }
  | { step: "deployed"; address: ContractAddress; txHash: TxHash }
  | { step: "error"; message: string }

export const deployStepAtom = Atom.make<DeployStep>({ step: "idle" }).pipe(
  Atom.keepAlive,
)

export const deployedAddressAtom = Atom.make<Option.Option<ContractAddress>>(Option.none()).pipe(
  Atom.keepAlive,
)

export const deployTxHashAtom = Atom.make<Option.Option<TxHash>>(Option.none()).pipe(
  Atom.keepAlive,
)
