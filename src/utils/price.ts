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
 * @throws Error if fetch fails or price parsing fails
 */
export async function fetchPricesFromPyth(
  tokens: SupportedToken[],
): Promise<Map<SupportedToken, number>> {
  // Build query string with all feed IDs
  const feedIds = tokens.map(token => TOKEN_TO_PYTH_FEED_ID[token])
  const queryParams = feedIds.map(id => `ids[]=${encodeURIComponent(id)}`).join('&')
  const url = `https://hermes.pyth.network/v2/updates/price/latest?${queryParams}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch prices from Pyth Network: ${response.status} ${response.statusText}`)
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
    throw new Error('No price data returned from Pyth Network')
  }

  // Parse prices and create map
  const priceMap = new Map<SupportedToken, number>()

  for (const token of tokens) {
    const feedId = TOKEN_TO_PYTH_FEED_ID[token]
    const feed = data.parsed.find(f => f.id === feedId)

    if (!feed) {
      throw new Error(`Price feed not found for ${token} (${feedId})`)
    }

    // Parse price: price = price * 10^expo
    const price = Number.parseFloat(feed.price.price) * (10 ** feed.price.expo)
    priceMap.set(token, price)
  }

  return priceMap
}

/**
 * Initialize price map from user-provided prices and fetch missing prices from Pyth Network
 * @throws Error if Pyth fetch fails
 */
export async function initializePrices(
  vaults: Partial<Record<VaultId, VaultConfig>>,
  userPrices?: Partial<Record<SupportedToken, number>>,
): Promise<Map<SupportedToken, number>> {
  const priceMap = new Map<SupportedToken, number>()

  // 1. If user provided prices, fill them first
  if (userPrices) {
    for (const [token, price] of Object.entries(userPrices)) {
      priceMap.set(token as SupportedToken, price)
    }
  }

  // 2. Collect all unique deposit tokens from vaults
  const allDepositTokens = new Set<SupportedToken>()
  for (const vault of Object.values(vaults)) {
    if (vault) {
      allDepositTokens.add(vault.depositToken)
    }
  }

  // 3. Find missing prices
  const missingTokens = Array.from(allDepositTokens).filter(
    token => !priceMap.has(token),
  )

  // 4. Fetch missing prices from Pyth if any
  if (missingTokens.length > 0) {
    const pythPrices = await fetchPricesFromPyth(missingTokens)
    for (const [token, price] of pythPrices) {
      priceMap.set(token, price)
    }
  }

  return priceMap
}
