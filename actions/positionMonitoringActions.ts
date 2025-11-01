import { action } from "@daydreamsai/core";
import { z } from "zod";
import type { PositionMemory } from "../types/memory.js";
import { fetchAllPositions } from "../utils/protocols.js";
import type { ProtocolId } from "../utils/config.js";

/**
 * Action to discover and fetch positions from lending protocols
 * This queries each protocol to find active borrow positions for the wallet
 */
export const discoverPositionsAction = action({
    name: "discoverPositions",
    description: "Discovers and fetches all active borrow positions for the configured wallet across all monitored protocols. ALWAYS call this AFTER initializeMonitoring to find the user's positions. This queries Aave, Curve, and other protocols to get real position data. This must be run before monitoring can occur. The wallet should already be configured via initializeMonitoring.",
    schema: z.object({
        wallet: z.string().optional(), // Optional override, otherwise uses memory
        protocolIds: z.array(z.string()).optional(), // Optional override
    }),
    handler: async (call, ctx) => {
        console.log("[discoverPositions] Action called");
        console.log("[discoverPositions] Full call object:", JSON.stringify(call, null, 2));

        if (!call) {
            console.error("[discoverPositions] ERROR: call is undefined");
            return { success: false, error: "Call object is undefined" };
        }

        // Data is directly on call, not call.data
        const wallet = (call as any).wallet || (call as any).data?.wallet;
        const protocolIds = (call as any).protocolIds || (call as any).data?.protocolIds;

        const agentMemory = ctx.agentMemory as PositionMemory;
        const finalWallet = wallet || agentMemory.wallet;
        const finalProtocolIds = protocolIds || agentMemory.protocolIds;

        if (!finalWallet) {
            return {
                success: false,
                error: "Wallet address not provided. Use initializeMonitoring first or provide wallet parameter.",
            };
        }

        if (!finalProtocolIds || finalProtocolIds.length === 0) {
            return {
                success: false,
                error: "No protocol IDs provided. Use initializeMonitoring first or provide protocolIds parameter.",
            };
        }

        // Fetch positions from all configured protocols
        const protocolIdsTyped = finalProtocolIds as ProtocolId[];
        const fetchedPositions = await fetchAllPositions(protocolIdsTyped, finalWallet);

        const discoveredPositions: PositionMemory["positions"] = fetchedPositions.map((pos) => ({
            id: pos.id,
            protocolId: pos.protocolId,
            collateralAsset: pos.collateralAsset,
            debtAsset: pos.debtAsset,
            collateralAmount: pos.collateralAmount,
            debtAmount: pos.debtAmount,
            collateralValue: pos.collateralValue,
            debtValue: pos.debtValue,
            liquidationThreshold: pos.liquidationThreshold,
        }));

        // If you want to test with mock data, uncomment below:
        /*
        if (discoveredPositions.length === 0) {
            // Mock example position for testing
            discoveredPositions.push({
                id: `${wallet}-${protocolIds[0]}-1`,
                protocolId: protocolIds[0],
                collateralAsset: "ETH",
                debtAsset: "USDC",
                collateralAmount: "10.0",
                debtAmount: "5000.0",
                collateralValue: 25000, // Assuming ETH price is $2500
                debtValue: 5000,
                liquidationThreshold: 0.8, // 80% LTV
            });
        }
        */

        // Update memory with discovered positions
        agentMemory.positions = discoveredPositions;
        agentMemory.lastUpdated = Date.now();

        const result = {
            success: true,
            positionsFound: discoveredPositions.length,
            positions: discoveredPositions.map(pos => ({
                id: pos.id,
                protocolId: pos.protocolId,
                collateralAsset: pos.collateralAsset,
                debtAsset: pos.debtAsset,
            })),
            message: discoveredPositions.length > 0
                ? `Found ${discoveredPositions.length} position(s) across ${finalProtocolIds.length} protocol(s)`
                : `No positions found. Note: Protocol API integration needed to fetch real positions.`,
        };

        console.log("[discoverPositions] Success! Returning:", JSON.stringify(result, null, 2));
        return result;
    },
});

/**
 * Action to manually add a position (for testing or manual entry)
 * Useful before protocol APIs are integrated
 */
export const addPositionAction = action({
    name: "addPosition",
    description: "Manually adds a position to the monitoring list. Use this for testing or when positions need to be entered manually. Requires all position details including collateral/debt amounts, assets, values, and liquidation threshold.",
    schema: z.object({
        protocolId: z.string(),
        collateralAsset: z.string(),
        debtAsset: z.string(),
        collateralAmount: z.string(),
        debtAmount: z.string(),
        collateralValue: z.number(),
        debtValue: z.number(),
        liquidationThreshold: z.number().min(0).max(1),
        positionId: z.string().optional(), // Auto-generated if not provided
    }),
    handler(call, ctx) {
        const agentMemory = ctx.agentMemory as PositionMemory;

        if (!agentMemory.wallet) {
            return {
                success: false,
                error: "Wallet not configured. Use initializeMonitoring first.",
            };
        }

        const positionId = call.data.positionId || `${agentMemory.wallet}-${call.data.protocolId}-${Date.now()}`;

        // Check if position already exists
        const existingIndex = agentMemory.positions.findIndex(p => p.id === positionId);

        const newPosition = {
            id: positionId,
            protocolId: call.data.protocolId,
            collateralAsset: call.data.collateralAsset,
            debtAsset: call.data.debtAsset,
            collateralAmount: call.data.collateralAmount,
            debtAmount: call.data.debtAmount,
            collateralValue: call.data.collateralValue,
            debtValue: call.data.debtValue,
            liquidationThreshold: call.data.liquidationThreshold,
        };

        if (existingIndex >= 0) {
            agentMemory.positions[existingIndex] = newPosition;
        } else {
            agentMemory.positions.push(newPosition);
        }

        agentMemory.lastUpdated = Date.now();

        return {
            success: true,
            positionId,
            message: `${existingIndex >= 0 ? "Updated" : "Added"} position: ${call.data.collateralAsset}/${call.data.debtAsset} on ${call.data.protocolId}`,
        };
    },
});

/**
 * Action to check health factors for all positions
 * Health Factor = (Total Collateral Value * Liquidation Threshold) / Total Debt Value
 */
export const checkHealthFactorAction = action({
    name: "checkHealthFactor",
    description: "Calculates and updates the health factor for all positions across all monitored protocols. Health factor indicates how close positions are to liquidation. A health factor below 1.0 means the position can be liquidated. Use this to get current position health status.",
    schema: z.object({
        positionId: z.string().optional(), // If provided, check only this position
    }),
    handler(call, ctx) {
        const agentMemory = ctx.agentMemory as PositionMemory;

        if (!agentMemory.wallet || agentMemory.protocolIds.length === 0) {
            return {
                success: false,
                error: "Wallet and protocol IDs must be configured first. Use initializeMonitoring action.",
            };
        }

        if (agentMemory.positions.length === 0) {
            return {
                success: false,
                error: "No positions found. Positions need to be discovered first.",
                suggestion: "Use discoverPositions action to find positions.",
            };
        }

        const positionsToCheck = call.data.positionId
            ? agentMemory.positions.filter(p => p.id === call.data.positionId)
            : agentMemory.positions;

        const healthFactors = positionsToCheck.map((position) => {
            // Health Factor formula: (Collateral Value * Liquidation Threshold) / Debt Value
            const collateralValue = position.collateralValue;
            const debtValue = position.debtValue;
            const liquidationThreshold = position.liquidationThreshold;

            let healthFactor = 0;
            if (debtValue > 0) {
                healthFactor = (collateralValue * liquidationThreshold) / debtValue;
            } else {
                healthFactor = Infinity; // No debt = infinite health
            }

            return {
                positionId: position.id,
                healthFactor,
                timestamp: Date.now(),
            };
        });

        // Update existing health factors or add new ones
        healthFactors.forEach((hf) => {
            const existingIndex = agentMemory.monitoringState.healthFactors.findIndex(
                (existing) => existing.positionId === hf.positionId
            );

            if (existingIndex >= 0) {
                agentMemory.monitoringState.healthFactors[existingIndex] = hf;
            } else {
                agentMemory.monitoringState.healthFactors.push(hf);
            }
        });

        agentMemory.monitoringState.lastChecked = Date.now();
        agentMemory.checkedAt = Date.now();
        agentMemory.lastUpdated = Date.now();

        return {
            success: true,
            healthFactors: healthFactors.map(hf => ({
                positionId: hf.positionId,
                healthFactor: hf.healthFactor,
            })),
            message: `Checked health factors for ${healthFactors.length} position(s)`,
        };
    },
});

/**
 * Action to calculate liquidation prices
 * Liquidation Price = Debt Value / (Collateral Amount * Liquidation Threshold)
 */
export const calculateLiquidationPriceAction = action({
    name: "calculateLiquidationPrice",
    description: "Calculates the liquidation price threshold for positions. This is the price at which a position would be liquidated. Use this to understand price risk for collateral assets.",
    schema: z.object({
        positionId: z.string().optional(),
    }),
    handler(call, ctx) {
        const agentMemory = ctx.agentMemory as PositionMemory;

        if (agentMemory.positions.length === 0) {
            return {
                success: false,
                error: "No positions found.",
            };
        }

        const positionsToCheck = call.data.positionId
            ? agentMemory.positions.filter(p => p.id === call.data.positionId)
            : agentMemory.positions;

        const liquidationPrices = positionsToCheck.map((position) => {
            const collateralAmount = parseFloat(position.collateralAmount);
            const debtValue = position.debtValue;
            const liquidationThreshold = position.liquidationThreshold;
            const collateralValue = position.collateralValue;

            // Calculate current price
            const currentPrice = collateralAmount > 0
                ? collateralValue / collateralAmount
                : 0;

            // Liquidation price: when collateralValue * liquidationThreshold = debtValue
            // So: liqPrice = debtValue / (collateralAmount * liquidationThreshold)
            let liqPrice = 0;
            if (collateralAmount > 0 && liquidationThreshold > 0) {
                liqPrice = debtValue / (collateralAmount * liquidationThreshold);
            }

            return {
                positionId: position.id,
                liqPrice,
                currentPrice,
            };
        });

        // Update liquidation prices in memory
        liquidationPrices.forEach((lp) => {
            const existingIndex = agentMemory.monitoringState.liquidationPrices.findIndex(
                (existing) => existing.positionId === lp.positionId
            );

            if (existingIndex >= 0) {
                agentMemory.monitoringState.liquidationPrices[existingIndex] = lp;
            } else {
                agentMemory.monitoringState.liquidationPrices.push(lp);
            }
        });

        agentMemory.lastUpdated = Date.now();

        return {
            success: true,
            liquidationPrices: liquidationPrices.map(lp => ({
                positionId: lp.positionId,
                liqPrice: lp.liqPrice,
                currentPrice: lp.currentPrice,
                priceBuffer: lp.currentPrice > 0
                    ? ((lp.currentPrice - lp.liqPrice) / lp.currentPrice) * 100
                    : 0,
            })),
        };
    },
});

/**
 * Action to calculate buffer percentages
 * Buffer = ((Current Health Factor - 1.0) / 1.0) * 100
 * Or: Buffer = ((Current Price - Liquidation Price) / Current Price) * 100
 */
export const calculateBufferAction = action({
    name: "calculateBuffer",
    description: "Calculates the safety buffer percentage for positions. This shows how much room there is before liquidation. A buffer of 15% means the position can handle a 15% price drop before liquidation. Use this to assess liquidation risk.",
    schema: z.object({
        positionId: z.string().optional(),
    }),
    handler(call, ctx) {
        const agentMemory = ctx.agentMemory as PositionMemory;

        // First ensure we have health factors and liquidation prices
        const hasHealthFactors = agentMemory.monitoringState.healthFactors.length > 0;
        const hasLiquidationPrices = agentMemory.monitoringState.liquidationPrices.length > 0;

        if (!hasHealthFactors) {
            return {
                success: false,
                error: "Health factors not calculated. Run checkHealthFactor first.",
            };
        }

        const positionsToCheck = call.data.positionId
            ? agentMemory.positions.filter(p => p.id === call.data.positionId)
            : agentMemory.positions;

        const bufferResults = positionsToCheck.map((position) => {
            const hf = agentMemory.monitoringState.healthFactors.find(
                (hf) => hf.positionId === position.id
            );

            const lp = agentMemory.monitoringState.liquidationPrices.find(
                (lp) => lp.positionId === position.id
            );

            let bufferPercent = 0;

            // Calculate buffer from health factor
            // Buffer = (HF - 1.0) / 1.0 * 100 = (HF - 1.0) * 100
            if (hf && hf.healthFactor > 0) {
                bufferPercent = (hf.healthFactor - 1.0) * 100;
                // Clamp to reasonable range
                bufferPercent = Math.max(0, bufferPercent);
            }

            return {
                positionId: position.id,
                bufferPercent,
                healthFactor: hf?.healthFactor || 0,
            };
        });

        agentMemory.lastUpdated = Date.now();

        return {
            success: true,
            buffers: bufferResults,
            message: `Calculated buffer percentages for ${bufferResults.length} position(s)`,
        };
    },
});

/**
 * Action to check if alert threshold is hit
 * Compares buffer percentages against the configured alert threshold
 */
export const checkAlertThresholdAction = action({
    name: "checkAlertThreshold",
    description: "Checks if any positions have hit the alert threshold based on buffer percentage. If buffer is below the alert threshold, this will trigger an alert. Use this to determine if immediate action is needed.",
    schema: z.object({
        alertThreshold: z.number().optional(), // Override the stored threshold
    }),
    handler(call, ctx) {
        console.log("[checkAlertThreshold] Action called");

        const agentMemory = ctx.agentMemory as PositionMemory;

        // Data is directly on call, not call.data
        const threshold = (call as any).alertThreshold ||
            (call as any).data?.alertThreshold ||
            agentMemory.monitoringState.alertThreshold;

        // Need to calculate buffers first if not already done
        // We'll check health factors to derive buffers
        if (agentMemory.monitoringState.healthFactors.length === 0) {
            return {
                success: false,
                error: "Health factors not calculated. Run checkHealthFactor first.",
            };
        }

        const atRiskPositions: Array<{
            positionId: string;
            bufferPercent: number;
            healthFactor: number;
        }> = [];

        agentMemory.monitoringState.healthFactors.forEach((hf) => {
            const position = agentMemory.positions.find(p => p.id === hf.positionId);
            if (!position) return;

            // Calculate buffer from health factor
            const bufferPercent = (hf.healthFactor - 1.0) * 100;

            if (bufferPercent < threshold) {
                atRiskPositions.push({
                    positionId: hf.positionId,
                    bufferPercent,
                    healthFactor: hf.healthFactor,
                });
            }
        });

        agentMemory.monitoringState.alertThresholdHit = atRiskPositions.length > 0;
        agentMemory.monitoringState.alertThreshold = threshold;
        agentMemory.lastUpdated = Date.now();

        return {
            success: true,
            alertThresholdHit: agentMemory.monitoringState.alertThresholdHit,
            threshold,
            atRiskPositions,
            message: agentMemory.monitoringState.alertThresholdHit
                ? `⚠️ ALERT: ${atRiskPositions.length} position(s) below ${threshold}% buffer threshold!`
                : `✅ All positions are above ${threshold}% buffer threshold`,
        };
    },
});

/**
 * Main orchestration action that runs all monitoring checks
 * Returns health_factor, liq_price, buffer_percent, and alert_threshold_hit
 */
export const monitorPositionsAction = action({
    name: "monitorPositions",
    description: "Runs a complete monitoring check for all positions. This is the main action to use when checking liquidation risk. It calculates health factors, liquidation prices, buffer percentages, and checks if alert thresholds are hit. Returns all monitoring metrics as specified in the specification.",
    schema: z.object({
        alertThreshold: z.number().optional(),
    }),
    handler(call, ctx) {
        const agentMemory = ctx.agentMemory as PositionMemory;

        if (!agentMemory.wallet || agentMemory.protocolIds.length === 0) {
            return {
                success: false,
                error: "Monitoring not initialized. Use initializeMonitoring first.",
            };
        }

        if (agentMemory.positions.length === 0) {
            return {
                success: false,
                error: "No positions found. Positions need to be discovered first.",
            };
        }

        // Step 1: Check health factors
        const healthFactors = agentMemory.positions.map((position) => {
            const collateralValue = position.collateralValue;
            const debtValue = position.debtValue;
            const liquidationThreshold = position.liquidationThreshold;

            const healthFactor = debtValue > 0
                ? (collateralValue * liquidationThreshold) / debtValue
                : Infinity;

            const hfEntry = {
                positionId: position.id,
                healthFactor,
                timestamp: Date.now(),
            };

            // Update in memory
            const existingIndex = agentMemory.monitoringState.healthFactors.findIndex(
                (hf) => hf.positionId === position.id
            );
            if (existingIndex >= 0) {
                agentMemory.monitoringState.healthFactors[existingIndex] = hfEntry;
            } else {
                agentMemory.monitoringState.healthFactors.push(hfEntry);
            }

            return healthFactor;
        });

        // Step 2: Calculate liquidation prices
        const liquidationPrices = agentMemory.positions.map((position) => {
            const collateralAmount = parseFloat(position.collateralAmount);
            const debtValue = position.debtValue;
            const liquidationThreshold = position.liquidationThreshold;
            const collateralValue = position.collateralValue;

            const currentPrice = collateralAmount > 0
                ? collateralValue / collateralAmount
                : 0;

            const liqPrice = collateralAmount > 0 && liquidationThreshold > 0
                ? debtValue / (collateralAmount * liquidationThreshold)
                : 0;

            const lpEntry = {
                positionId: position.id,
                liqPrice,
                currentPrice,
            };

            // Update in memory
            const existingIndex = agentMemory.monitoringState.liquidationPrices.findIndex(
                (lp) => lp.positionId === position.id
            );
            if (existingIndex >= 0) {
                agentMemory.monitoringState.liquidationPrices[existingIndex] = lpEntry;
            } else {
                agentMemory.monitoringState.liquidationPrices.push(lpEntry);
            }

            return liqPrice;
        });

        // Step 3: Calculate buffer percentages
        const bufferPercents = healthFactors.map((hf, index) => {
            const bufferPercent = hf > 0 && !isFinite(hf)
                ? Infinity
                : (hf - 1.0) * 100;
            return Math.max(0, bufferPercent);
        });

        // Step 4: Check alert threshold
        const threshold = call.data.alertThreshold ?? agentMemory.monitoringState.alertThreshold;
        const alertThresholdHit = bufferPercents.some(buffer => buffer < threshold);

        agentMemory.monitoringState.alertThresholdHit = alertThresholdHit;
        agentMemory.monitoringState.alertThreshold = threshold;
        agentMemory.monitoringState.lastChecked = Date.now();
        agentMemory.checkedAt = Date.now();
        agentMemory.lastUpdated = Date.now();

        return {
            success: true,
            health_factor: healthFactors,
            liq_price: liquidationPrices,
            buffer_percent: bufferPercents,
            alert_threshold_hit: alertThresholdHit,
            positions: agentMemory.positions.map((pos, index) => ({
                positionId: pos.id,
                protocolId: pos.protocolId,
                collateralAsset: pos.collateralAsset,
                debtAsset: pos.debtAsset,
                healthFactor: healthFactors[index],
                liqPrice: liquidationPrices[index],
                bufferPercent: bufferPercents[index],
            })),
        };
    },
});