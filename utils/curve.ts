/**
 * Curve Finance protocol integration utilities
 * Fetches borrow positions from Curve (crvUSD) on Ethereum Mainnet using direct contract calls
 */

import { createPublicClient, http, formatUnits, getAddress, type Address } from "viem";
import { mainnet } from "viem/chains";
import type { PositionMemory } from "../types/memory.js";
import { PROTOCOL_CONFIGS, NETWORKS } from "./config.js";
import { getTokenPrice } from "./prices.js";
import { CURVE_CONTROLLER_ABI, ERC20_ABI } from "./contracts.js";

export interface CurvePosition {
    id: string;
    protocolId: string;
    collateralAsset: string;
    debtAsset: string;
    collateralAmount: string;
    debtAmount: string;
    collateralValue: number;
    debtValue: number;
    liquidationThreshold: number;
}

// Curve crvUSD Controller addresses on Ethereum Mainnet (properly checksummed)
// Note: Curve has multiple controllers for different collateral types
const CURVE_CONTROLLERS: Record<string, Address> = {
    // WETH controller
    "0x10062051C1c7b1b4DC798c401c3A9FA7A7783D3A": getAddress("0x10062051C1c7b1b4DC798c401c3A9FA7A7783D3A"),
    // WBTC controller  
    "0x72e158d38dbd50a483501c24d7926d96e5cf74ac": getAddress("0x72e158d38dbd50a483501c24d7926d96e5cf74ac"),
    // wstETH controller
    "0x5354c132a85d9a7e8e8db1863e9c7c8f6c5f5e5e": getAddress("0x5354c132a85d9a7e8e8db1863e9c7c8f6c5f5e5e"),
};

/**
 * Create a viem public client for Ethereum mainnet
 */
function getClient() {
    return createPublicClient({
        chain: mainnet,
        transport: http(NETWORKS.MAINNET.rpcUrl),
    });
}

/**
 * Get token symbol from contract
 */
async function getTokenSymbol(assetAddress: Address, client: ReturnType<typeof getClient>): Promise<string> {
    try {
        const symbol = await client.readContract({
            address: assetAddress,
            abi: ERC20_ABI,
            functionName: "symbol",
        });
        return symbol as string;
    } catch {
        return "UNKNOWN";
    }
}

/**
 * Get token decimals from contract
 */
async function getTokenDecimals(assetAddress: Address, client: ReturnType<typeof getClient>): Promise<number> {
    try {
        const decimals = await client.readContract({
            address: assetAddress,
            abi: ERC20_ABI,
            functionName: "decimals",
        });
        return Number(decimals);
    } catch {
        return 18;
    }
}

/**
 * Fetch user positions from Curve Lending (crvUSD) using direct contract calls
 */
export async function fetchCurvePositions(
    walletAddress: string
): Promise<CurvePosition[]> {
    const positions: CurvePosition[] = [];
    const client = getClient();

    try {
        console.log(`[Curve] Fetching positions for ${walletAddress}`);

        // Normalize wallet address to checksummed format
        const normalizedWallet = getAddress(walletAddress);

        // Try each known controller
        for (const [controllerAddress, controllerAddr] of Object.entries(CURVE_CONTROLLERS)) {
            console.log(`[Curve] Checking controller ${controllerAddress}`);
            try {
                // Get user state
                const userState = await client.readContract({
                    address: controllerAddr,
                    abi: CURVE_CONTROLLER_ABI,
                    functionName: "user_state",
                    args: [normalizedWallet],
                });

                const collaterals = userState[0] as bigint[];
                const debt = userState[1] as bigint;

                // If no debt, skip
                if (debt === 0n) {
                    continue;
                }

                // Get collateral token address
                const collateralToken = await client.readContract({
                    address: controllerAddr,
                    abi: CURVE_CONTROLLER_ABI,
                    functionName: "collateral_token",
                });

                // Normalize collateral token address
                const normalizedCollateralToken = getAddress(collateralToken as string);

                // Get collateral and debt info
                const collateralSymbol = await getTokenSymbol(normalizedCollateralToken, client);
                const collateralDecimals = await getTokenDecimals(normalizedCollateralToken, client);
                const collateralAmount = collaterals.reduce((sum, val) => sum + val, 0n);

                if (collateralAmount === 0n) {
                    continue;
                }

                // crvUSD is the debt token
                const crvUSDAddress = getAddress("0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E");
                const debtSymbol = await getTokenSymbol(crvUSDAddress, client);
                const debtDecimals = await getTokenDecimals(crvUSDAddress, client);

                // Get prices
                const collateralPrice = await getTokenPrice(collateralSymbol);
                const debtPrice = await getTokenPrice("crvUSD");

                // Calculate values
                const collateralAmountFormatted = formatUnits(collateralAmount, collateralDecimals);
                const debtAmountFormatted = formatUnits(debt, debtDecimals);
                const collateralValue = parseFloat(collateralAmountFormatted) * collateralPrice;
                const debtValue = parseFloat(debtAmountFormatted) * debtPrice;

                // Get health to determine liquidation threshold
                // Health = (collateral * price) / debt
                // If health < 1, position can be liquidated
                // LLTV (loan-to-value) is typically around 0.85-0.9 for Curve
                const health = collateralValue > 0 && debtValue > 0
                    ? collateralValue / debtValue
                    : Infinity;

                // Estimate liquidation threshold (typically 85-90% for Curve)
                // If we have health, we can derive: liquidation happens when collateral * threshold = debt
                // threshold = debt / collateral (at liquidation)
                // But we use a standard Curve LLTV of 0.87
                const liquidationThreshold = 0.87; // Standard Curve crvUSD LLTV

                console.log(`[Curve] Found position: ${collateralSymbol}/${debtSymbol || "crvUSD"}, collateral=${collateralAmountFormatted}, debt=${debtAmountFormatted}`);

                positions.push({
                    id: `${walletAddress}-curve-${collateralSymbol}-crvUSD-${Date.now()}`,
                    protocolId: "curve",
                    collateralAsset: collateralSymbol,
                    debtAsset: debtSymbol || "crvUSD",
                    collateralAmount: collateralAmountFormatted,
                    debtAmount: debtAmountFormatted,
                    collateralValue,
                    debtValue,
                    liquidationThreshold,
                });
            } catch (error) {
                // Controller might not exist or user has no position in this controller
                console.log(`[Curve] No position in controller ${controllerAddress} (this is normal if user doesn't have positions there)`);
                continue;
            }
        }

        console.log(`[Curve] Created ${positions.length} position(s)`);
        return positions;
    } catch (error) {
        console.error("[Curve] Error fetching Curve positions from contracts:", error);
        return positions;
    }
}
