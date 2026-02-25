// apps/demo/src/config/networks.ts

export type NetworkId = "sepolia" | "mainnet"

export interface NetworkConfig {
  readonly id: NetworkId
  readonly name: string
  readonly rpcUrl: string
  readonly classHash: string
  readonly explorerBaseUrl: string
  readonly isTestnet: boolean
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  sepolia: {
    id: "sepolia",
    name: "Sepolia",
    rpcUrl: "https://api.zan.top/public/starknet-sepolia/rpc/v0_10",
    classHash: "0x0",
    explorerBaseUrl: "https://sepolia.voyager.online",
    isTestnet: true,
  },
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    rpcUrl: "https://api.zan.top/public/starknet/rpc/v0_10",
    classHash: "0x0",
    explorerBaseUrl: "https://voyager.online",
    isTestnet: false,
  },
}

export const DEFAULT_NETWORK: NetworkId = "sepolia"
