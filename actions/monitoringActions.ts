import { action } from "@daydreamsai/core";
import { z } from "zod";
import type { PositionMemory } from "../types/memory.js";

export const initializeMonitoringAction = action({
    name: "initializeMonitoring",
    description: "Sets up liquidation monitoring for a wallet address and specifies which lending protocols to check. ALWAYS call this FIRST when a user mentions a wallet address (0x... format). Pass the wallet address directly from the user's message. If protocols aren't specified, use 'aave-v3' as default. Required: wallet address and at least one protocol ID. Example: When user says 'track wallet 0x123...', pass 0x123... to this action.",
    schema: z.object({
        wallet: z.string().min(1, "Wallet address is required").refine(
            (val) => /^0x[a-fA-F0-9]{40}$/.test(val),
            "Wallet address must be a valid Ethereum address (0x...)"
        ),
        protocolIds: z.array(z.string()).min(1, "At least one protocol ID is required"),
        alertThreshold: z.number().min(0).max(100).optional().default(15),
    }),
    handler(call, ctx) {
        console.log("[initializeMonitoring] Action called");
        console.log("[initializeMonitoring] Full call object:", JSON.stringify(call, null, 2));

        if (!call) {
            console.error("[initializeMonitoring] ERROR: call is undefined");
            return { success: false, error: "Call object is undefined" };
        }

        // Data is directly on call, not call.data
        const wallet = (call as any).wallet || (call as any).data?.wallet;
        const protocolIds = (call as any).protocolIds || (call as any).data?.protocolIds;
        const alertThreshold = (call as any).alertThreshold || (call as any).data?.alertThreshold || 15;

        if (!wallet || !protocolIds || protocolIds.length === 0) {
            console.error("[initializeMonitoring] ERROR: Missing required fields", { wallet, protocolIds });
            return { success: false, error: "Wallet address and protocol IDs are required" };
        }

        // Check if context exists
        if (!ctx) {
            console.error("[initializeMonitoring] ERROR: Context is undefined");
            return {
                success: false,
                error: "Context not available. Please ensure the liquidation-monitor context is activated.",
            };
        }

        // Initialize memory if it doesn't exist or is missing fields
        if (!ctx.agentMemory) {
            console.log("[initializeMonitoring] Initializing new context memory");
            (ctx as any).agentMemory = {
                wallet: "",
                protocolIds: [],
                positions: [],
                monitoringState: {
                    healthFactors: [],
                    liquidationPrices: [],
                    alertThreshold: 15,
                    alertThresholdHit: false,
                    lastChecked: 0,
                },
                checkedAt: 0,
                lastUpdated: Date.now(),
            };
        }

        const agentMemory = ctx.agentMemory as PositionMemory;

        // initialize monitoring configuration 
        agentMemory.wallet = wallet;
        agentMemory.protocolIds = protocolIds;
        agentMemory.positions = [];
        agentMemory.monitoringState = {
            healthFactors: [],
            liquidationPrices: [],
            alertThreshold: alertThreshold,
            alertThresholdHit: false,
            lastChecked: 0,
        };
        agentMemory.checkedAt = 0;
        agentMemory.lastUpdated = Date.now();

        const result = {
            success: true,
            message: `Monitoring initialized for wallet: ${wallet} with protocols: ${protocolIds.join(", ")}`,
            wallet,
            protocolIds,
            alertThreshold,
        };

        console.log("[initializeMonitoring] Success! Returning:", JSON.stringify(result, null, 2));
        return result;
    },
});

/**
 * Action to update the wallet address being monitored
 */
export const updateWalletAction = action({
    name: "updateWallet",
    description: "Updates the wallet address to monitor. Use this when the user wants to change which wallet is being monitored.",
    schema: z.object({
        wallet: z.string().min(1, "Wallet address is required").refine(
            (val) => /^0x[a-fA-F0-9]{40}$/.test(val),
            "Wallet address must be a valid Ethereum address (0x...)"
        ),
    }),
    handler(call, ctx) {
        console.log("[updateWallet] Action called");

        if (!call) {
            console.error("[updateWallet] ERROR: call is undefined");
            return { success: false, error: "Invalid call data" };
        }

        const wallet = (call as any).wallet || (call as any).data?.wallet;
        if (!wallet) {
            console.error("[updateWallet] ERROR: wallet is missing");
            return { success: false, error: "Wallet address is required" };
        }

        // Check if context exists
        if (!ctx) {
            console.error("[updateWallet] ERROR: Context is undefined");
            return {
                success: false,
                error: "Context not available. Please ensure the liquidation-monitor context is activated.",
            };
        }

        // Initialize memory if it doesn't exist
        if (!ctx.agentMemory) {
            console.log("[updateWallet] Initializing new context memory");
            (ctx as any).agentMemory = {
                wallet: "",
                protocolIds: [],
                positions: [],
                monitoringState: {
                    healthFactors: [],
                    liquidationPrices: [],
                    alertThreshold: 15,
                    alertThresholdHit: false,
                    lastChecked: 0,
                },
                checkedAt: 0,
                lastUpdated: Date.now(),
            };
        }

        const agentMemory = ctx.agentMemory as PositionMemory;

        agentMemory.wallet = wallet;
        agentMemory.positions = []; // Reset positions for new wallet
        agentMemory.monitoringState = {
            healthFactors: [],
            liquidationPrices: [],
            alertThresholdHit: false,
            alertThreshold: agentMemory.monitoringState?.alertThreshold || 15,
            lastChecked: 0,
        };
        agentMemory.checkedAt = 0;
        agentMemory.lastUpdated = Date.now();

        return {
            success: true,
            message: `Wallet updated to: ${wallet}`,
            wallet,
        };
    },
});

/**
 * Action to get current monitoring configuration
 */
export const getMonitoringConfigAction = action({
    name: "getMonitoringConfig",
    description: "Retrieves the current monitoring configuration including wallet address, protocol IDs, and settings.",
    schema: z.object({}),
    handler(call, ctx) {
        console.log("[getMonitoringConfig] Action called");

        // Check if context exists
        if (!ctx || !ctx.agentMemory) {
            console.error("[getMonitoringConfig] ERROR: Context or agentMemory is undefined");
            return {
                wallet: "Not set",
                protocolIds: [],
                alertThreshold: 15,
                positionsCount: 0,
                lastChecked: 0,
                alertThresholdHit: false,
            };
        }

        const agentMemory = ctx.agentMemory as PositionMemory;

        const result = {
            wallet: agentMemory.wallet || "Not set",
            protocolIds: agentMemory.protocolIds || [],
            alertThreshold: agentMemory.monitoringState?.alertThreshold || 15,
            positionsCount: agentMemory.positions?.length || 0,
            lastChecked: agentMemory.monitoringState?.lastChecked || 0,
            alertThresholdHit: agentMemory.monitoringState?.alertThresholdHit ?? false,
        };

        console.log("[getMonitoringConfig] Returning:", JSON.stringify(result, null, 2));
        return result;
    },
});

