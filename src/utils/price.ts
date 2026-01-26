// Price fetching utilities for Pyth Network

import type { VaultConfig, VaultId } from '../types'
import { SupportedToken } from '../types'

/**
 * Map SupportedToken to Pyth Network price feed IDs
 */
const TOKEN_TO_PYTH_FEED_ID: Record<SupportedToken, string> = {
  [SupportedToken.USDC]: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  [SupportedToken.USDT]: '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  [SupportedToken.SOL]: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  [SupportedToken.WBTC]: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  [SupportedToken.WETH]: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  [SupportedToken.JLP]: 'c811abc82b4bad1f9bd711a2773ccaa935b03ecef974236942cec5e0eb845a3a',
}

/**
 * Fetch prices from Pyth Network Hermes API
 * Returns a partial map - missing prices will not be included (no throw)
 */
export async function fetchPricesFromPyth(
  tokens: SupportedToken[],
): Promise<Map<SupportedToken, number>> {
  const priceMap = new Map<SupportedToken, number>()

  if (tokens.length === 0) {
    return priceMap
  }

  try {
    // Build query string with all feed IDs
    const feedIds = tokens.map(token => TOKEN_TO_PYTH_FEED_ID[token])
    const queryParams = feedIds.map(id => `ids[]=${encodeURIComponent(id)}`).join('&')
    const url = `https://hermes.pyth.network/v2/updates/price/latest?${queryParams}`

    const response = await fetch(url)

    if (!response.ok) {
      console.warn(`Failed to fetch prices from Pyth Network: ${response.status} ${response.statusText}`)
      return priceMap
    }

    const data = await response.json() as {
      parsed?: Array<{
        id: string
        price: {
          price: string
          conf: string
          expo: number
        }
      }>
    }

    if (!data.parsed || data.parsed.length === 0) {
      console.warn('No price data returned from Pyth Network')
      return priceMap
    }

    // Parse prices and create map (skip missing feeds instead of throwing)
    for (const token of tokens) {
      const feedId = TOKEN_TO_PYTH_FEED_ID[token]
      const feed = data.parsed.find(f => f.id === feedId)

      if (!feed) {
        console.warn(`Price feed not found for ${token} (${feedId})`)
        continue
      }

      // Parse price: price = price * 10^expo
      const price = Number.parseFloat(feed.price.price) * (10 ** feed.price.expo)
      priceMap.set(token, price)
    }
  }
  catch (error) {
    console.warn('Error fetching prices from Pyth Network:', error)
  }

  return priceMap
}

/**
 * Initialize price map by fetching from Pyth Network first, then using fallback prices for any missing
 * @param vaults - Vault configurations to determine which tokens need prices
 * @param fallbackPrices - Optional fallback prices to use if Pyth fetch fails or returns incomplete data
 */
export async function initializePrices(
  vaults: Partial<Record<VaultId, VaultConfig>>,
  fallbackPrices?: Partial<Record<SupportedToken, number>>,
): Promise<Map<SupportedToken, number>> {
  // 1. Collect all unique deposit tokens from vaults
  const allDepositTokens = new Set<SupportedToken>()
  for (const vault of Object.values(vaults)) {
    if (vault) {
      allDepositTokens.add(vault.depositToken)
    }
  }

  const tokensNeeded = Array.from(allDepositTokens)

  // 2. Fetch all prices from Pyth first
  const priceMap = await fetchPricesFromPyth(tokensNeeded)

  // 3. Fill missing prices from fallback
  if (fallbackPrices) {
    for (const token of tokensNeeded) {
      if (!priceMap.has(token) && token in fallbackPrices) {
        const fallbackPrice = fallbackPrices[token]
        if (fallbackPrice !== undefined) {
          console.warn(`Using fallback price for ${token}: ${fallbackPrice}`)
          priceMap.set(token, fallbackPrice)
        }
      }
    }
  }

  return priceMap
}
