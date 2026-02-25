import { describe, it, expect } from "bun:test"
import { Exit, Effect } from "effect"
import { exportKeyFile, parseKeyFile } from "../../services/keyfile"
import type { FalconKeypair, PackedPublicKey } from "../../services/types"

const MOCK_KEYPAIR: FalconKeypair = {
  secretKey: new Uint8Array([0x01, 0x02, 0x03]),
  verifyingKey: new Uint8Array([0x0a, 0x0b]),
  publicKeyNtt: new Int32Array([100, 200, 300]),
}

const MOCK_PACKED: PackedPublicKey = {
  slots: ["0xaaa", "0xbbb"],
}

describe("exportKeyFile", () => {
  it("returns a valid FalconKeyFile JSON string", () => {
    const json = exportKeyFile(MOCK_KEYPAIR, MOCK_PACKED)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.algorithm).toBe("falcon-512")
    expect(parsed.secretKey).toBe("0x010203")
    expect(parsed.verifyingKey).toBe("0x0a0b")
    expect(parsed.publicKeyNtt).toEqual([100, 200, 300])
    expect(parsed.packedPublicKey).toEqual(["0xaaa", "0xbbb"])
  })
})

describe("parseKeyFile", () => {
  it("succeeds with valid JSON", async () => {
    const json = exportKeyFile(MOCK_KEYPAIR, MOCK_PACKED)
    const exit = await Effect.runPromiseExit(parseKeyFile(json))
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value.keypair.secretKey).toBeInstanceOf(Uint8Array)
      expect(exit.value.keypair.verifyingKey).toBeInstanceOf(Uint8Array)
      expect(exit.value.keypair.publicKeyNtt).toBeInstanceOf(Int32Array)
      expect(exit.value.packedPublicKey.slots).toEqual(["0xaaa", "0xbbb"])
    }
  })

  it("fails with invalid JSON", async () => {
    const exit = await Effect.runPromiseExit(parseKeyFile("not json"))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it("fails with wrong version", async () => {
    const bad = JSON.stringify({ version: 2, algorithm: "falcon-512", secretKey: "0x01", verifyingKey: "0x02", publicKeyNtt: [], packedPublicKey: [] })
    const exit = await Effect.runPromiseExit(parseKeyFile(bad))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it("fails with missing fields", async () => {
    const bad = JSON.stringify({ version: 1 })
    const exit = await Effect.runPromiseExit(parseKeyFile(bad))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it("fails when publicKeyNtt has coefficient >= 12289", async () => {
    const bad = JSON.stringify({
      version: 1,
      algorithm: "falcon-512",
      secretKey: "0x01",
      verifyingKey: "0x02",
      publicKeyNtt: [99999],
      packedPublicKey: ["0xaaa"],
    })
    const exit = await Effect.runPromiseExit(parseKeyFile(bad))
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
