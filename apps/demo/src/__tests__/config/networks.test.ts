import { describe, it, expect } from "bun:test"
import { NETWORKS, DEFAULT_NETWORK } from "../../config/networks"
import type { NetworkId, NetworkConfig } from "../../config/networks"

describe("NETWORKS config", () => {
  it("has devnet, sepolia, and mainnet entries", () => {
    expect(NETWORKS.devnet).toBeDefined()
    expect(NETWORKS.sepolia).toBeDefined()
    expect(NETWORKS.mainnet).toBeDefined()
  })

  it("devnet points to localhost:5050", () => {
    expect(NETWORKS.devnet.rpcUrl).toBe("http://localhost:5050")
  })

  it("devnet has isDevnet=true", () => {
    expect(NETWORKS.devnet.isDevnet).toBe(true)
  })

  it("sepolia and mainnet have isDevnet=false", () => {
    expect(NETWORKS.sepolia.isDevnet).toBe(false)
    expect(NETWORKS.mainnet.isDevnet).toBe(false)
  })

  it("devnet has empty explorerBaseUrl", () => {
    expect(NETWORKS.devnet.explorerBaseUrl).toBe("")
  })

  it("DEFAULT_NETWORK is devnet", () => {
    expect(DEFAULT_NETWORK).toBe("devnet")
  })
})
