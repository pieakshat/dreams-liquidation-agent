import { createDreams } from "@daydreamsai/core";
import { cliExtension } from "@daydreamsai/cli";
import { groq } from "./config/model.js";
import { positionContext } from "./contexts/positionContext.js";
import {
    initializeMonitoringAction,
    updateWalletAction,
    getMonitoringConfigAction,
} from "./actions/monitoringActions.js";
import {
    discoverPositionsAction,
    addPositionAction,
    checkHealthFactorAction,
    calculateLiquidationPriceAction,
    calculateBufferAction,
    checkAlertThresholdAction,
    monitorPositionsAction,
} from "./actions/positionMonitoringActions.js";

/**
 * Main agent entry point
 * 
 * This agent monitors borrow positions and warns before liquidation risk.
 * 
 * Capabilities:
 * - Monitor health factors for borrow positions
 * - Calculate liquidation prices
 * - Track safety buffer percentages
 * - Alert when positions approach liquidation threshold
 * 
 * Usage:
 * 1. Initialize monitoring: Set wallet address and protocol IDs
 * 2. Discover positions: Fetch positions from lending protocols
 * 3. Monitor: Run checks to get health factors, liquidation prices, buffers, and alerts
 * 
 * When a user mentions a wallet address, automatically extract it and use it to set up monitoring.
 */
const agent = createDreams({
    instructions: `You are a liquidation risk monitoring agent. When users mention wallet addresses (0x... format), extract the address and use the initializeMonitoring action to set it up. Then use discoverPositions to find positions. Always be proactive and helpful in setting up monitoring for users.`,
    model: groq("llama-3.1-8b-instant"),
    extensions: [cliExtension],
    contexts: [
        positionContext,
    ],
    actions: [
        // Monitoring setup actions
        initializeMonitoringAction,
        updateWalletAction,
        getMonitoringConfigAction,

        // Position discovery and management
        discoverPositionsAction,
        addPositionAction,

        // Monitoring actions
        checkHealthFactorAction,
        calculateLiquidationPriceAction,
        calculateBufferAction,
        checkAlertThresholdAction,
        monitorPositionsAction, // Main orchestration action
    ],
});

// Start the agent
// The context will be activated based on wallet addresses in user messages
agent.start();
