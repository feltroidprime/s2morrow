// apps/demo/src/config/networks.ts

export type NetworkId = "devnet" | "sepolia" | "mainnet"

export interface NetworkConfig {
  readonly id: NetworkId
  readonly name: string
  readonly rpcUrl: string
  readonly classHash: string
  readonly explorerBaseUrl: string
  readonly isTestnet: boolean
  readonly isDevnet: boolean
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  devnet: {
    id: "devnet",
    name: "Devnet",
    rpcUrl: "http://localhost:5050",
    classHash: "0x0037c7626b50ba517835c9556b53bce57cb6633704bb702f8c2f13a44cf151d5",
    explorerBaseUrl: "",
    isTestnet: true,
    isDevnet: true,
  },
  sepolia: {
    id: "sepolia",
    name: "Sepolia",
    rpcUrl: "https://api.zan.top/node/v1/starknet/sepolia/30623d06317c4234ac2934876f2fd542",
    classHash: "0x0037c7626b50ba517835c9556b53bce57cb6633704bb702f8c2f13a44cf151d5",
    explorerBaseUrl: "https://sepolia.voyager.online",
    isTestnet: true,
    isDevnet: false,
  },
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    rpcUrl: "https://api.zan.top/node/v1/starknet/mainnet/30623d06317c4234ac2934876f2fd542",
    classHash: "0x0",
    explorerBaseUrl: "https://voyager.online",
    isTestnet: false,
    isDevnet: false,
  },
}

export const DEFAULT_NETWORK: NetworkId = "devnet"
