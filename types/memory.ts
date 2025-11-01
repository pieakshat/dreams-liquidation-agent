export type PositionMemory = {
    wallet: string;
    protocolIds: string[];
    positions: Array<{
        id: string;
        protocolId: string;
        collateralAsset: string;
        debtAsset: string;
        collateralAmount: string;
        debtAmount: string;
        collateralValue: number; // USD value
        debtValue: number;
        liquidationThreshold: number; // 0-1 
    }>;


    monitoringState: {
        healthFactors: Array<{
            positionId: string;
            healthFactor: number;
            timestamp: number;
        }>;

        liquidationPrices: Array<{
            positionId: string;
            liqPrice: number;
            currentPrice: number;
        }>;

        alertThreshold: number;
        alertThresholdHit: boolean;
        lastChecked: number;
    };

    checkedAt: number;
    lastUpdated: number;
}