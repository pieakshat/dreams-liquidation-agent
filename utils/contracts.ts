/**
 * Contract ABIs for DeFi protocol integrations
 * Minimal ABIs for only the functions we need
 */

// Aave V3 Pool Contract ABI
export const AAVE_POOL_ABI = [
    {
        inputs: [{ internalType: "address", name: "user", type: "address" }],
        name: "getUserAccountData",
        outputs: [
            { internalType: "uint256", name: "totalCollateralBase", type: "uint256" },
            { internalType: "uint256", name: "totalDebtBase", type: "uint256" },
            { internalType: "uint256", name: "availableBorrowsBase", type: "uint256" },
            { internalType: "uint256", name: "currentLiquidationThreshold", type: "uint256" },
            { internalType: "uint256", name: "ltv", type: "uint256" },
            { internalType: "uint256", name: "healthFactor", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "address", name: "user", type: "address" }],
        name: "getUserReservesData",
        outputs: [
            {
                components: [
                    { internalType: "address", name: "underlyingAsset", type: "address" },
                    { internalType: "string", name: "symbol", type: "string" },
                    { internalType: "uint256", name: "scaledATokenBalance", type: "uint256" },
                    { internalType: "bool", name: "usageAsCollateralEnabledOnUser", type: "bool" },
                    { internalType: "uint256", name: "stableBorrowRate", type: "uint256" },
                    { internalType: "uint256", name: "variableBorrowRate", type: "uint256" },
                    { internalType: "uint256", name: "principalStableDebt", type: "uint256" },
                    { internalType: "uint256", name: "scaledVariableDebt", type: "uint256" },
                    { internalType: "uint256", name: "liquidationBonus", type: "uint256" },
                ],
                internalType: "struct IPoolDataProvider.UserReserveData[]",
                name: "userReservesData",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;

// Aave V3 PoolDataProvider ABI (for reserve details)
export const AAVE_DATA_PROVIDER_ABI = [
    {
        inputs: [{ internalType: "address", name: "asset", type: "address" }],
        name: "getReserveData",
        outputs: [
            {
                components: [
                    { internalType: "address", name: "configuration", type: "address" },
                    { internalType: "uint128", name: "liquidityIndex", type: "uint128" },
                    { internalType: "uint128", name: "currentLiquidityRate", type: "uint128" },
                    { internalType: "uint128", name: "variableBorrowIndex", type: "uint128" },
                    { internalType: "uint128", name: "currentVariableBorrowRate", type: "uint128" },
                    { internalType: "uint128", name: "currentStableBorrowRate", type: "uint128" },
                    { internalType: "uint40", name: "lastUpdateTimestamp", type: "uint40" },
                    { internalType: "uint16", name: "id", type: "uint16" },
                    { internalType: "address", name: "aTokenAddress", type: "address" },
                    { internalType: "address", name: "stableDebtTokenAddress", type: "address" },
                    { internalType: "address", name: "variableDebtTokenAddress", type: "address" },
                    { internalType: "address", name: "interestRateStrategyAddress", type: "address" },
                    { internalType: "uint128", name: "accruedToTreasury", type: "uint128" },
                    { internalType: "uint128", name: "unbacked", type: "uint128" },
                    { internalType: "uint128", name: "isolationModeTotalDebt", type: "uint128" },
                ],
                internalType: "struct DataTypes.ReserveData",
                name: "",
                type: "tuple",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getReservesList",
        outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

// Aave V3 PriceOracle ABI
export const AAVE_PRICE_ORACLE_ABI = [
    {
        inputs: [{ internalType: "address", name: "asset", type: "address" }],
        name: "getAssetPrice",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

// Aave V3 ReserveConfiguration ABI (to get liquidation threshold)
export const AAVE_RESERVE_CONFIG_ABI = [
    {
        inputs: [],
        name: "getLiquidationThreshold",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

// Curve Controller ABI (for crvUSD lending)
export const CURVE_CONTROLLER_ABI = [
    {
        inputs: [{ internalType: "address", name: "user", type: "address" }],
        name: "user_state",
        outputs: [
            { internalType: "uint256[2]", name: "collaterals", type: "uint256[2]" },
            { internalType: "uint256", name: "debt", type: "uint256" },
            { internalType: "uint256", name: "staked_debt", type: "uint256" },
            { internalType: "uint256", name: "debt_ceiling", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "address", name: "user", type: "address" }],
        name: "health",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "collateral_token",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

// ERC20 ABI for getting token info
export const ERC20_ABI = [
    {
        inputs: [],
        name: "symbol",
        outputs: [{ internalType: "string", name: "", type: "string" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "decimals",
        outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

