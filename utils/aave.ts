/**
 * Aave V3 protocol integration utilities
 * Fetches borrow positions from Aave on Ethereum Mainnet using direct contract calls
 */

import { createPublicClient, http, formatUnits, getAddress } from "viem";
import { mainnet } from "viem/chains";
import { NETWORKS } from "./config.js";
import { getTokenPrice } from "./prices.js";
import {
    AAVE_POOL_ABI,
} from "./contracts.js";

export interface AavePosition {
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

// Aave V3 Contract Addresses on Ethereum Mainnet (properly checksummed)
const AAVE_V3_POOL = getAddress("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"); // Pool proxy (Ethereum)

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
 * Helper: percent from basis points (e.g., 8250 -> 82.5)
 * This matches the ethers.js script exactly
 */
const bpsToPercent = (bps: bigint | number): number => {
    return Number(bps) / 100;
};

/**
 * Fetch user positions from Aave V3 using direct contract calls
 * This implementation matches the working ethers.js script exactly
 */
export async function fetchAavePositions(
    walletAddress: string
): Promise<AavePosition[]> {
    const positions: AavePosition[] = [];
    const client = getClient();

    try {
        console.log(`[Aave] Fetching positions for ${walletAddress}`);

        // Normalize wallet address to checksummed format
        const normalizedWallet = getAddress(walletAddress);

        // Call the proxy contract directly with the Pool ABI (exact same as ethers.js script)
        // The proxy will automatically delegate to the implementation
        console.log(`[Aave] Calling getUserAccountData on proxy contract ${AAVE_V3_POOL}`);

        // Call getUserAccountData (same as pool.getUserAccountData(user) in ethers.js)
        const res = await client.readContract({
            address: AAVE_V3_POOL,
            abi: AAVE_POOL_ABI,
            functionName: "getUserAccountData",
            args: [normalizedWallet],
        }) as readonly [bigint, bigint, bigint, bigint, bigint, bigint];

        // Destructure the result (exact same as ethers.js script)
        const [
            totalCollateralBase,
            totalDebtBase,
            availableBorrowsBase,
            currentLiquidationThreshold,
            ltv,
            healthFactor,
        ] = res;

        // Aave v3 returns base-unit values scaled to 1e18 for these three,
        // healthFactor is also 1e18-scaled. LTV & CLT are in basis points.
        const DECIMALS_18 = 18;

        // Format values (exact same as ethers.js script)
        const formatted = {
            totalCollateral: Number(formatUnits(totalCollateralBase, DECIMALS_18)),
            totalDebt: Number(formatUnits(totalDebtBase, DECIMALS_18)),
            availableBorrows: Number(formatUnits(availableBorrowsBase, DECIMALS_18)),
            liquidationThresholdBps: Number(currentLiquidationThreshold),
            liquidationThresholdPercent: bpsToPercent(currentLiquidationThreshold),
            ltvBps: Number(ltv),
            ltvPercent: bpsToPercent(ltv),
            healthFactor: Number(formatUnits(healthFactor, DECIMALS_18)),
        };

        console.log(`[Aave] Account data:`, {
            totalCollateral: formatted.totalCollateral,
            totalDebt: formatted.totalDebt,
            availableBorrows: formatted.availableBorrows,
            liquidationThresholdPercent: formatted.liquidationThresholdPercent,
            ltvPercent: formatted.ltvPercent,
            healthFactor: formatted.healthFactor,
        });

        // If no debt, return empty
        if (formatted.totalDebt === 0 || totalDebtBase === 0n) {
            console.log("[Aave] No debt found, returning empty positions");
            return positions;
        }

        // Simplified approach: Create aggregate position from account data
        // For a more detailed breakdown, we'd need to iterate reserves, but that's slow
        // This gives us a consolidated view of the user's Aave position

        // Estimate average prices (we'll use ETH as proxy for collateral and USDC for debt)
        // In production, you'd want to get actual reserve breakdown
        const estimatedCollateralPrice = await getTokenPrice("ETH"); // Default assumption
        const estimatedDebtPrice = await getTokenPrice("USDC"); // Default assumption

        // Calculate estimated amounts (approximate)
        const estimatedCollateralAmount = formatted.totalCollateral / estimatedCollateralPrice;
        const estimatedDebtAmount = formatted.totalDebt / estimatedDebtPrice;

        // Use liquidationThresholdPercent (which is in percentage points like 82.5 for 82.5%)
        // Convert to decimal (0.825) for our liquidationThreshold field
        const liquidationThresholdDecimal = formatted.liquidationThresholdPercent / 100;

        positions.push({
            id: `${walletAddress}-aave-v3-consolidated-${Date.now()}`,
            protocolId: "aave-v3",
            collateralAsset: "MIXED",
            debtAsset: "MIXED",
            collateralAmount: estimatedCollateralAmount.toFixed(6),
            debtAmount: estimatedDebtAmount.toFixed(6),
            collateralValue: formatted.totalCollateral,
            debtValue: formatted.totalDebt,
            liquidationThreshold: liquidationThresholdDecimal || 0.8,
        });

        console.log(`[Aave] Created ${positions.length} position(s)`);
        return positions;
    } catch (error) {
        console.error("Error fetching Aave positions from contracts:", error);
        return positions;
    }
}
