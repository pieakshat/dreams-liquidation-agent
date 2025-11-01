/**
 * Price oracle utilities for fetching token prices
 * Shared across all protocol integrations
 */

/**
 * Map common token symbols to CoinGecko IDs
 */
export const TOKEN_MAP: Record<string, string> = {
    WETH: "ethereum",
    ETH: "ethereum",
    USDC: "usd-coin",
    USDT: "tether",
    DAI: "dai",
    WBTC: "wrapped-bitcoin",
    LINK: "chainlink",
    AAVE: "aave",
    CRV: "curve-dao-token",
    crvUSD: "crvusd",
    "crvUSD": "crvusd",
};

/**
 * Fetch price for a token from CoinGecko
 */
export async function getTokenPrice(tokenSymbol: string): Promise<number> {
    try {
        const tokenId = TOKEN_MAP[tokenSymbol] || tokenSymbol.toLowerCase();

        // Using CoinGecko API (free tier)
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`,
            {
                headers: {
                    "Accept": "application/json",
                },
            }
        );

        if (!response.ok) {
            console.error(`CoinGecko API error: ${response.status}`);
            return 0;
        }

        const data = await response.json();
        return data[tokenId]?.usd || 0;
    } catch (error) {
        console.error(`Error fetching price for ${tokenSymbol}:`, error);
        return 0;
    }
}

/**
 * Fetch prices for multiple tokens at once
 */
export async function getTokenPrices(tokenSymbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    // Batch fetch from CoinGecko
    const tokenIds = tokenSymbols.map(symbol => TOKEN_MAP[symbol] || symbol.toLowerCase());
    const uniqueTokenIds = [...new Set(tokenIds)];

    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueTokenIds.join(",")}&vs_currencies=usd`,
            {
                headers: {
                    "Accept": "application/json",
                },
            }
        );

        if (!response.ok) {
            console.error(`CoinGecko API error: ${response.status}`);
            return prices;
        }

        const data = await response.json();

        // Map back to original symbols
        for (const symbol of tokenSymbols) {
            const tokenId = TOKEN_MAP[symbol] || symbol.toLowerCase();
            prices[symbol] = data[tokenId]?.usd || 0;
        }

        return prices;
    } catch (error) {
        console.error("Error fetching token prices:", error);
        return prices;
    }
}

