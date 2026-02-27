import { Atom } from "@effect-atom/atom"
import { Option } from "effect"
import type { FalconKeypair, FalconSignatureResult, PackedPublicKey, VerificationStep } from "../services/types"

// ── localStorage keys ────────────────────────────────────────────────
const KEYPAIR_STORAGE_KEY = "falcon-demo-keypair"
const PACKED_KEY_STORAGE_KEY = "falcon-demo-packed-key"
const EXPORTED_STORAGE_KEY = "falcon-demo-exported"

// ── Serialisation helpers ────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

interface StoredKeypair {
  secretKey: string   // hex
  verifyingKey: string // hex
  publicKeyNtt: number[]
}

function serializeKeypair(kp: FalconKeypair): string {
  const stored: StoredKeypair = {
    secretKey: "0x" + bytesToHex(kp.secretKey),
    verifyingKey: "0x" + bytesToHex(kp.verifyingKey),
    publicKeyNtt: Array.from(kp.publicKeyNtt),
  }
  return JSON.stringify(stored)
}

function deserializeKeypair(json: string): FalconKeypair | null {
  try {
    const stored: StoredKeypair = JSON.parse(json)
    if (!stored.secretKey || !stored.verifyingKey || !Array.isArray(stored.publicKeyNtt)) {
      return null
    }
    return {
      secretKey: hexToBytes(stored.secretKey),
      verifyingKey: hexToBytes(stored.verifyingKey),
      publicKeyNtt: new Int32Array(stored.publicKeyNtt),
    }
  } catch {
    return null
  }
}

function serializePackedKey(pk: PackedPublicKey): string {
  return JSON.stringify({ slots: Array.from(pk.slots) })
}

function deserializePackedKey(json: string): PackedPublicKey | null {
  try {
    const stored = JSON.parse(json)
    if (!Array.isArray(stored.slots)) return null
    return { slots: stored.slots }
  } catch {
    return null
  }
}

// ── Read from localStorage on init ───────────────────────────────────

function readStoredKeypair(): Option.Option<FalconKeypair> {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return Option.none()
    }
    const raw = localStorage.getItem(KEYPAIR_STORAGE_KEY)
    if (!raw) return Option.none()
    const kp = deserializeKeypair(raw)
    return kp ? Option.some(kp) : Option.none()
  } catch {
    return Option.none()
  }
}

function readStoredPackedKey(): Option.Option<PackedPublicKey> {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return Option.none()
    }
    const raw = localStorage.getItem(PACKED_KEY_STORAGE_KEY)
    if (!raw) return Option.none()
    const pk = deserializePackedKey(raw)
    return pk ? Option.some(pk) : Option.none()
  } catch {
    return Option.none()
  }
}

// ── Write helpers (called from components via persistKeypair / persistPackedKey) ──

export function persistKeypair(kp: Option.Option<FalconKeypair>): void {
  try {
    if (typeof localStorage === "undefined") return
    Option.match(kp, {
      onNone: () => localStorage.removeItem(KEYPAIR_STORAGE_KEY),
      onSome: (k) => localStorage.setItem(KEYPAIR_STORAGE_KEY, serializeKeypair(k)),
    })
  } catch { /* ignore */ }
}

export function persistPackedKey(pk: Option.Option<PackedPublicKey>): void {
  try {
    if (typeof localStorage === "undefined") return
    Option.match(pk, {
      onNone: () => localStorage.removeItem(PACKED_KEY_STORAGE_KEY),
      onSome: (p) => localStorage.setItem(PACKED_KEY_STORAGE_KEY, serializePackedKey(p)),
    })
  } catch { /* ignore */ }
}

export function getExportedFlag(): boolean {
  try {
    if (typeof localStorage === "undefined") return false
    return localStorage.getItem(EXPORTED_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function setExportedFlag(exported: boolean): void {
  try {
    if (typeof localStorage === "undefined") return
    if (exported) {
      localStorage.setItem(EXPORTED_STORAGE_KEY, "true")
    } else {
      localStorage.removeItem(EXPORTED_STORAGE_KEY)
    }
  } catch { /* ignore */ }
}

export function clearWalletStorage(): void {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.removeItem(KEYPAIR_STORAGE_KEY)
    localStorage.removeItem(PACKED_KEY_STORAGE_KEY)
    localStorage.removeItem(EXPORTED_STORAGE_KEY)
  } catch { /* ignore */ }
}

// ── Atoms ────────────────────────────────────────────────────────────

export const wasmStatusAtom = Atom.make<"loading" | "ready" | "error">("loading").pipe(
  Atom.keepAlive,
)

export const keypairAtom = Atom.make<Option.Option<FalconKeypair>>(readStoredKeypair()).pipe(
  Atom.keepAlive,
)

export const signatureAtom = Atom.make<Option.Option<FalconSignatureResult>>(Option.none())

export const packedKeyAtom = Atom.make<Option.Option<PackedPublicKey>>(readStoredPackedKey()).pipe(
  Atom.keepAlive,
)

export const verificationStepAtom = Atom.make<VerificationStep>({ step: "idle" })

export const messageAtom = Atom.make("")
