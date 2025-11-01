import { context, render } from "@daydreamsai/core";
import { z } from "zod";
import type { PositionMemory } from "../types/memory.js";

const template = `
Wallet: {{wallet}}
Protocols: {{protocols}}

Positions: {{positionsCount}}

Monitoring Status:
{{monitoringStatus}}

Last Checked: {{lastChecked}}
Alert Status: {{alertStatus}}
`;

/**
 * Context for managing liquidation position monitoring
 * Each wallet has its own monitoring context identified by wallet address
 */
export const positionContext = context<PositionMemory>({
    type: "liquidation-monitor",

    schema: z.object({
        wallet: z.string(),
    }),

    key({ wallet }: { wallet: string }) {
        return wallet.toLowerCase(); // Normalize to lowercase for consistency
    },

    // Instructions for when this context should be activated
    instructions: "When the user mentions a wallet address (0x... format), automatically extract it and use it to activate this context. Always use the wallet address from the user's message to identify which monitoring context to use.",

    create(state) {
        return {
            wallet: state.args.wallet || "",
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
    },

    render({ memory }: { memory: PositionMemory }) {
        const protocolsList = memory.protocolIds.length === 0
            ? "  No protocols configured"
            : memory.protocolIds.map((id) => `  - ${id}`).join("\n");

        const positionsList = memory.positions.length === 0
            ? "  No positions found"
            : memory.positions
                .map((pos) => {
                    const hf = memory.monitoringState.healthFactors.find(
                        (hf) => hf.positionId === pos.id
                    );
                    return `  - ${pos.id}: ${pos.collateralAsset}/${pos.debtAsset} (HF: ${hf?.healthFactor?.toFixed(2) || "N/A"})`;
                })
                .join("\n");

        const monitoringStatus = memory.monitoringState.healthFactors.length > 0
            ? `  Health Factors tracked: ${memory.monitoringState.healthFactors.length}\n  Alerts: ${memory.monitoringState.alertThresholdHit ? "⚠️ ACTIVE" : "✅ Normal"}`
            : "  Not yet checked";

        const lastChecked = memory.monitoringState.lastChecked > 0
            ? new Date(memory.monitoringState.lastChecked).toLocaleString()
            : "Never";

        const alertStatus = memory.monitoringState.alertThresholdHit
            ? "⚠️ WARNING: Alert threshold hit!"
            : "✅ Normal";

        return render(template, {
            wallet: memory.wallet || "Not set",
            protocols: protocolsList,
            positionsCount: memory.positions.length === 0
                ? "None"
                : `${memory.positions.length} position(s)\n${positionsList}`,
            monitoringStatus,
            lastChecked,
            alertStatus,
        });
    },
});