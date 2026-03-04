import { describe, it, expect } from "bun:test"
import { parsePrefundedAccounts } from "../../services/StarknetService"

describe("parsePrefundedAccounts", () => {
  it("parses valid devnet response", () => {
    const raw = [
      { address: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691", private_key: "0x71d7bb07b9a64f6f78ac4c816aff4da9", initial_balance: "1000000000000000000000" },
      { address: "0x078662e7352d062084b0010068b99288486c2d8b914f6e2a55ce945f8792c8b1", private_key: "0xe1406455b7d66b1690803be066cbe5e", initial_balance: "1000000000000000000000" },
    ]
    const accounts = parsePrefundedAccounts(raw)
    expect(accounts.length).toBe(2)
    expect(accounts[0].address).toContain("0x064b")
    expect(accounts[0].private_key).toContain("0x71d7")
  })

  it("returns empty array for empty response", () => {
    const accounts = parsePrefundedAccounts([])
    expect(accounts.length).toBe(0)
  })
})
