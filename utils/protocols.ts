/**
 * Unified protocol integration interface
 * Routes to appropriate protocol fetchers
 */

import type { PositionMemory } from "../types/memory.js";
import { fetchAavePositions } from "./aave.js";
import { fetchCurvePositions } from "./curve.js";
import type { ProtocolId } from "./config.js";

export interface ProtocolPosition {
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
 * Fetch positions from a specific protocol
 */
export async function fetchPositionsFromProtocol(
    protocolId: ProtocolId,
    walletAddress: string
): Promise<ProtocolPosition[]> {
    switch (protocolId) {
        case "aave-v3":
            return await fetchAavePositions(walletAddress);

        case "curve":
            return await fetchCurvePositions(walletAddress);

        default:
            console.warn(`Unknown protocol: ${protocolId}`);
            return [];
    }
}

/**
 * Fetch positions from multiple protocols
 */
export async function fetchAllPositions(
    protocolIds: ProtocolId[],
    walletAddress: string
): Promise<ProtocolPosition[]> {
    const allPositions: ProtocolPosition[] = [];

    // Fetch from all protocols in parallel
    const fetchPromises = protocolIds.map(protocolId =>
        fetchPositionsFromProtocol(protocolId, walletAddress)
            .then(positions => positions)
            .catch(error => {
                console.error(`Error fetching from ${protocolId}:`, error);
                return [];
            })
    );

    const results = await Promise.all(fetchPromises);

    // Flatten results
    for (const positions of results) {
        allPositions.push(...positions);
    }

    return allPositions;
}

