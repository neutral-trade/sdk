import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupportedToken } from '../src/types'
import { fetchPricesFromPyth, initializePrices } from '../src/utils/price'

// Pyth feed IDs for reference
const PYTH_FEED_IDS = {
  [SupportedToken.USDC]: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  [SupportedToken.USDT]: '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  [SupportedToken.SOL]: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  [SupportedToken.WBTC]: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  [SupportedToken.WETH]: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  [SupportedToken.JLP]: 'c811abc82b4bad1f9bd711a2773ccaa935b03ecef974236942cec5e0eb845a3a',
}

/**
 * Helper to create mock Pyth response
 */
function createMockPythResponse(prices: Partial<Record<SupportedToken, number>>) {
  const parsed = Object.entries(prices).map(([token, price]) => ({
    id: PYTH_FEED_IDS[token as SupportedToken],
    price: {
      price: String(Math.round(price! * 1e8)),
      conf: '10000',
      expo: -8,
    },
  }))
  return { parsed }
}

describe('price utilities', () => {
  describe('initializePrices', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return prices from Pyth when all prices are available', async () => {
      const mockPrices = {
        [SupportedToken.USDC]: 1.0,
        [SupportedToken.SOL]: 150.0,
        [SupportedToken.WBTC]: 45000.0,
        [SupportedToken.WETH]: 3000.0,
        [SupportedToken.USDT]: 1.0,
        [SupportedToken.JLP]: 2.5,
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => createMockPythResponse(mockPrices),
      } as Response)

      const result = await initializePrices()

      expect(result.get(SupportedToken.USDC)).toBe(1.0)
      expect(result.get(SupportedToken.SOL)).toBe(150.0)
      expect(result.get(SupportedToken.WBTC)).toBe(45000.0)
      expect(result.size).toBe(6)
    })

    it('should use fallback prices for missing tokens', async () => {
      // Mock Pyth returning only partial prices
      const mockPrices = {
        [SupportedToken.USDC]: 1.0,
        [SupportedToken.SOL]: 150.0,
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => createMockPythResponse(mockPrices),
      } as Response)

      const fallbackPrices = {
        [SupportedToken.WBTC]: 44000.0,
        [SupportedToken.WETH]: 2900.0,
      }

      const result = await initializePrices(fallbackPrices)

      // Should have Pyth prices
      expect(result.get(SupportedToken.USDC)).toBe(1.0)
      expect(result.get(SupportedToken.SOL)).toBe(150.0)

      // Should use fallback for missing
      expect(result.get(SupportedToken.WBTC)).toBe(44000.0)
      expect(result.get(SupportedToken.WETH)).toBe(2900.0)

      // Should log warnings for fallback usage
      expect(console.warn).toHaveBeenCalledWith('Using fallback price for WBTC: 44000')
      expect(console.warn).toHaveBeenCalledWith('Using fallback price for WETH: 2900')
    })

    it('should not override Pyth prices with fallback', async () => {
      const mockPrices = {
        [SupportedToken.SOL]: 150.0,
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => createMockPythResponse(mockPrices),
      } as Response)

      const fallbackPrices = {
        [SupportedToken.SOL]: 100.0, // Different fallback price
      }

      const result = await initializePrices(fallbackPrices)

      // Should keep Pyth price, not use fallback
      expect(result.get(SupportedToken.SOL)).toBe(150.0)
    })

    it('should work without fallback prices', async () => {
      const mockPrices = {
        [SupportedToken.USDC]: 1.0,
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => createMockPythResponse(mockPrices),
      } as Response)

      const result = await initializePrices()

      expect(result.get(SupportedToken.USDC)).toBe(1.0)
      // Other tokens will be missing since Pyth didn't return them
    })

    it('should handle empty Pyth response with fallback', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ parsed: [] }),
      } as Response)

      const fallbackPrices = {
        [SupportedToken.USDC]: 1.0,
        [SupportedToken.SOL]: 150.0,
      }

      const result = await initializePrices(fallbackPrices)

      expect(result.get(SupportedToken.USDC)).toBe(1.0)
      expect(result.get(SupportedToken.SOL)).toBe(150.0)
    })

    it('should handle empty Pyth response without fallback', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ parsed: [] }),
      } as Response)

      const result = await initializePrices()

      expect(result.size).toBe(0)
    })

    it('should ignore undefined fallback prices', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ parsed: [] }),
      } as Response)

      const fallbackPrices: Partial<Record<SupportedToken, number>> = {
        [SupportedToken.USDC]: 1.0,
        [SupportedToken.SOL]: undefined,
      }

      const result = await initializePrices(fallbackPrices)

      expect(result.get(SupportedToken.USDC)).toBe(1.0)
      expect(result.has(SupportedToken.SOL)).toBe(false)
    })

    it('should handle Pyth API failure with fallback', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

      const fallbackPrices = {
        [SupportedToken.USDC]: 1.0,
        [SupportedToken.SOL]: 150.0,
      }

      const result = await initializePrices(fallbackPrices)

      expect(result.get(SupportedToken.USDC)).toBe(1.0)
      expect(result.get(SupportedToken.SOL)).toBe(150.0)
    })
  })

  describe('fetchPricesFromPyth', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return empty map for empty token list', async () => {
      const result = await fetchPricesFromPyth([])
      expect(result.size).toBe(0)
    })

    it('should handle fetch error gracefully', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

      const result = await fetchPricesFromPyth([SupportedToken.USDC])

      expect(result.size).toBe(0)
      expect(console.warn).toHaveBeenCalled()
    })

    it('should handle non-ok response', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      const result = await fetchPricesFromPyth([SupportedToken.USDC])

      expect(result.size).toBe(0)
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to fetch prices from Pyth Network: 500 Internal Server Error',
      )
    })

    it('should handle empty parsed response', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ parsed: [] }),
      } as Response)

      const result = await fetchPricesFromPyth([SupportedToken.USDC])

      expect(result.size).toBe(0)
      expect(console.warn).toHaveBeenCalledWith('No price data returned from Pyth Network')
    })

    it('should parse price correctly with negative exponent', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          parsed: [{
            id: PYTH_FEED_IDS[SupportedToken.USDC],
            price: {
              price: '100000000', // 1.0 with expo -8
              conf: '10000',
              expo: -8,
            },
          }],
        }),
      } as Response)

      const result = await fetchPricesFromPyth([SupportedToken.USDC])

      expect(result.get(SupportedToken.USDC)).toBe(1.0)
    })

    it('should handle missing feed for requested token', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          parsed: [{
            id: 'different-feed-id',
            price: {
              price: '100000000',
              conf: '10000',
              expo: -8,
            },
          }],
        }),
      } as Response)

      const result = await fetchPricesFromPyth([SupportedToken.USDC])

      expect(result.has(SupportedToken.USDC)).toBe(false)
      expect(console.warn).toHaveBeenCalled()
    })
  })
})
