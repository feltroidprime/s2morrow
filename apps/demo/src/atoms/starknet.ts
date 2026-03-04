import { Atom } from "@effect-atom/atom"
import { Option } from "effect"
import { ContractAddress, TxHash } from "../services/types"
import { DEFAULT_NETWORK } from "../config/networks"
import type { NetworkId } from "../config/networks"

export type { NetworkId }

export type DeployStep =
  | { step: "idle" }
  | { step: "generating-keypair" }
  | { step: "packing" }
  | { step: "computing-address" }
  | { step: "awaiting-funds"; address: ContractAddress }
  | { step: "deploying"; address: ContractAddress }
  | { step: "deployed"; address: ContractAddress; txHash: TxHash }
  | { step: "sending-tx"; address: ContractAddress }
  | { step: "tx-confirmed"; address: ContractAddress; txHash: TxHash; transferTxHash: TxHash }
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

const NETWORK_STORAGE_KEY = "falcon-demo-network"

function readStoredNetwork(): NetworkId {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return DEFAULT_NETWORK
    }
    const stored = localStorage.getItem(NETWORK_STORAGE_KEY)
    if (stored === "mainnet" || stored === "sepolia" || stored === "devnet") {
      return stored
    }
    return DEFAULT_NETWORK
  } catch {
    return DEFAULT_NETWORK
  }
}

export const networkAtom = Atom.make<NetworkId>(readStoredNetwork()).pipe(
  Atom.keepAlive,
)

export { NETWORK_STORAGE_KEY }
