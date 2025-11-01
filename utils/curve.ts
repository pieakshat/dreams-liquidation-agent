/**
 * Curve Finance protocol integration utilities
 * Fetches borrow positions from Curve (crvUSD) on Ethereum Mainnet
 */

import type { PositionMemory } from "../types/memory.js";
import { PROTOCOL_CONFIGS } from "./config.js";
import { getTokenPrice, TOKEN_MAP } from "./prices.js";

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

/**
 * Fetch user positions from Curve Lending (crvUSD)
 * Curve has multiple lending markets - focusing on crvUSD positions
 */
export async function fetchCurvePositions(
    walletAddress: string
): Promise<CurvePosition[]> {
    const positions: CurvePosition[] = [];

    try {
        // Curve Lending API endpoint
        // Note: Curve's API structure may vary - this is a template
        const apiUrl = `https://api.curve.fi/v1/getUserPositions/${walletAddress}`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
            console.error(`Curve API error: ${response.status}`);
            return positions;
        }

        const data = await response.json();

        // Process Curve API response
        if (data.positions || data.loans) {
            const positionsData = data.positions || data.loans || [];

            for (const position of positionsData) {
                // Only process active borrow positions
                if (position.debt && parseFloat(position.debt) > 0) {
                    const collateralSymbol = position.collateral?.symbol || position.collateralSymbol || "UNKNOWN";
                    const debtSymbol = position.debt?.symbol || position.debtSymbol || "crvUSD";

                    // Get prices
                    const collateralPriceId = TOKEN_MAP[collateralSymbol] || collateralSymbol.toLowerCase();
                    const debtPriceId = TOKEN_MAP[debtSymbol] || debtSymbol.toLowerCase();

                    const collateralPrice = await getTokenPrice(collateralPriceId);
                    const debtPrice = await getTokenPrice(debtPriceId);

                    // Parse amounts
                    const collateralAmount = position.collateral?.amount || position.collateralAmount || "0";
                    const debtAmount = position.debt?.amount || position.debt || "0";

                    // Calculate USD values
                    const collateralValue = parseFloat(collateralAmount) * collateralPrice;
                    const debtValue = parseFloat(debtAmount) * debtPrice;

                    // Get liquidation threshold (LLTV for Curve)
                    // Curve typically uses LLTV (Loan-to-Value) - inverse of what we need
                    // liquidationThreshold = 1 - maxLTV, typically around 0.85-0.9
                    const liquidationThreshold = parseFloat(position.liquidationThreshold || position.maxLTV || "0.85");

                    positions.push({
                        id: `${walletAddress}-curve-${collateralSymbol}-${debtSymbol}-${Date.now()}`,
                        protocolId: "curve",
                        collateralAsset: collateralSymbol,
                        debtAsset: debtSymbol,
                        collateralAmount,
                        debtAmount,
                        collateralValue,
                        debtValue,
                        liquidationThreshold,
                    });
                }
            }
        }

        return positions;
    } catch (error) {
        console.error("Error fetching Curve positions:", error);
        return positions;
    }
}

/**
 * Alternative: Fetch Curve positions using direct contract calls
 * For crvUSD lending pools
 */
export async function fetchCurvePositionsDirect(
    walletAddress: string
): Promise<CurvePosition[]> {
    // TODO: Implement with ethers/viem for direct contract calls
    // Curve Lending contracts to interact with:
    // - Controller contract for active loans
    // - Price oracle for current prices
    // - LLTV from market parameters

    // Example structure:
    // 1. Connect to Ethereum via RPC
    // 2. Query Controller.getUserHealth(walletAddress)
    // 3. Get loan positions from Controller
    // 4. Query prices from Curve's price oracle
    // 5. Get LLTV from market configuration

    return [];
}

