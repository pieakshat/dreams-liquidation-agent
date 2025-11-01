/**
 * Configuration for DeFi protocol integrations
 * Ethereum Mainnet configurations
 */

export const NETWORKS = {
    MAINNET: {
        chainId: 1,
        name: "Ethereum Mainnet",
        rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
    },
} as const;

/**
 * Protocol configurations for Ethereum Mainnet
 */
export const PROTOCOL_CONFIGS = {
    "aave-v3": {
        name: "Aave V3",
        chainId: 1,
        poolAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Aave V3 Pool on Ethereum
        subgraphUrl: "https://api.thegraph.com/subgraphs/name/aave/aave-v3-ethereum",
        apiBaseUrl: "https://aave-api-v2.aave.com/data/",
    },
    "curve": {
        name: "Curve Finance",
        chainId: 1,
        // Curve uses multiple pools, we'll query via API
        apiBaseUrl: "https://api.curve.fi/v1",
        registryAddress: "0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5", // Curve Registry
    },
} as const;

export type ProtocolId = keyof typeof PROTOCOL_CONFIGS;

