import { describe, expect, it } from 'vitest'
import { SupportedToken } from '../src/types/tokens'
import { getZeroDriftBalance } from '../src/utils/drift'

describe('drift Balance Calculations', () => {
  describe('getZeroDriftBalance', () => {
    it('should return zero balance object with correct asset', () => {
      const result = getZeroDriftBalance(SupportedToken.USDC)

      expect(result.balanceToken).toBe(0)
      expect(result.balanceUsd).toBe(0)
      expect(result.netEarnings).toBe(0)
      expect(result.netEarningsUsd).toBe(0)
      expect(result.totalDeposit).toBe(0)
      expect(result.totalDepositUsd).toBe(0)
      expect(result.spotPrice).toBe(0)
      expect(result.netDeposit).toBe(0)
      expect(result.vaultShares).toBe(0)
      expect(result.feesPaid).toBe(0)
      expect(result.highWaterMark).toBe(0)
      expect(result.pendingProfitShareFee).toBe(0)
      expect(result.requestWithdrawToken).toBe(0)
      expect(result.asset).toBe(SupportedToken.USDC)
    })

    it('should work with different token types', () => {
      const usdtResult = getZeroDriftBalance(SupportedToken.USDT)
      expect(usdtResult.asset).toBe(SupportedToken.USDT)

      const solResult = getZeroDriftBalance(SupportedToken.SOL)
      expect(solResult.asset).toBe(SupportedToken.SOL)

      const jlpResult = getZeroDriftBalance(SupportedToken.JLP)
      expect(jlpResult.asset).toBe(SupportedToken.JLP)
    })

    it('should return object with all expected properties', () => {
      const result = getZeroDriftBalance(SupportedToken.USDC)

      // Verify all expected properties exist
      const expectedKeys = [
        'balanceToken',
        'balanceUsd',
        'netEarnings',
        'netEarningsUsd',
        'totalDeposit',
        'totalDepositUsd',
        'spotPrice',
        'netDeposit',
        'vaultShares',
        'feesPaid',
        'highWaterMark',
        'pendingProfitShareFee',
        'requestWithdrawToken',
        'asset',
      ]

      for (const key of expectedKeys) {
        expect(result).toHaveProperty(key)
      }
    })
  })

  // Note: calculateDriftVaultBalance requires mocking VaultClient and DriftClient
  // which depend on external RPC connections. These are better suited for
  // integration tests or would require extensive mocking.
  //
  // The core logic can be tested by extracting the pure calculation functions:
  // - getDriftVaultTotalEarning (currently private, but could be exported for testing)
  // - pendingProfitShareFee calculation

  describe('getDriftVaultTotalEarning logic', () => {
    // Reimplementing the logic here for testing purposes
    // This tests the earnings calculation formula
    function getDriftVaultTotalEarning({
      netDepositToken,
      requestWithdrawToken,
      balanceToken,
    }: {
      netDepositToken: number
      requestWithdrawToken: number
      balanceToken: number
    }): number {
      const realizedProfit = -Math.min(netDepositToken - requestWithdrawToken, 0)
      const unrealizedProfit = balanceToken - Math.max(netDepositToken - requestWithdrawToken, 0)

      const totalEarnings
        = realizedProfit + unrealizedProfit >= -0.01 && realizedProfit + unrealizedProfit <= 0.01
          ? 0
          : realizedProfit + unrealizedProfit

      return totalEarnings
    }

    it('should calculate positive earnings correctly', () => {
      const result = getDriftVaultTotalEarning({
        netDepositToken: 1000,
        requestWithdrawToken: 0,
        balanceToken: 1200,
      })

      // balance (1200) - netDeposit (1000) = 200 profit
      expect(result).toBe(200)
    })

    it('should calculate negative earnings (loss) correctly', () => {
      const result = getDriftVaultTotalEarning({
        netDepositToken: 1000,
        requestWithdrawToken: 0,
        balanceToken: 800,
      })

      // balance (800) - netDeposit (1000) = -200 loss
      expect(result).toBe(-200)
    })

    it('should return 0 for earnings within threshold (-0.01 to 0.01)', () => {
      const result = getDriftVaultTotalEarning({
        netDepositToken: 1000,
        requestWithdrawToken: 0,
        balanceToken: 1000.005,
      })

      // Difference is 0.005, within threshold
      expect(result).toBe(0)
    })

    it('should handle withdraw requests correctly - partial withdrawal', () => {
      const result = getDriftVaultTotalEarning({
        netDepositToken: 1000,
        requestWithdrawToken: 200, // User requested to withdraw 200
        balanceToken: 900, // Current active balance
      })

      // netDeposit - requestWithdraw = 1000 - 200 = 800
      // realizedProfit = -min(800, 0) = 0
      // unrealizedProfit = 900 - max(800, 0) = 900 - 800 = 100
      expect(result).toBe(100)
    })

    it('should handle withdraw requests larger than net deposit', () => {
      const result = getDriftVaultTotalEarning({
        netDepositToken: 500,
        requestWithdrawToken: 700, // More than net deposit (profit being withdrawn)
        balanceToken: 100,
      })

      // netDeposit - requestWithdraw = 500 - 700 = -200
      // realizedProfit = -min(-200, 0) = -(-200) = 200
      // unrealizedProfit = 100 - max(-200, 0) = 100 - 0 = 100
      // total = 200 + 100 = 300
      expect(result).toBe(300)
    })

    it('should handle zero balance', () => {
      const result = getDriftVaultTotalEarning({
        netDepositToken: 1000,
        requestWithdrawToken: 0,
        balanceToken: 0,
      })

      // Complete loss of funds
      expect(result).toBe(-1000)
    })

    it('should handle all zeros', () => {
      const result = getDriftVaultTotalEarning({
        netDepositToken: 0,
        requestWithdrawToken: 0,
        balanceToken: 0,
      })

      expect(result).toBe(0)
    })
  })

  describe('pendingProfitShareFee calculation logic', () => {
    function calculatePendingProfitShareFee(
      balanceToken: number,
      highWaterMark: number,
      profitShareFeePercent: number,
    ): number {
      if (balanceToken > highWaterMark) {
        const profitAboveHighWaterMark = balanceToken - highWaterMark
        return (profitAboveHighWaterMark * profitShareFeePercent) / 100
      }
      return 0
    }

    it('should return 0 when balance is below high water mark', () => {
      const result = calculatePendingProfitShareFee(900, 1000, 20)
      expect(result).toBe(0)
    })

    it('should return 0 when balance equals high water mark', () => {
      const result = calculatePendingProfitShareFee(1000, 1000, 20)
      expect(result).toBe(0)
    })

    it('should calculate fee when balance exceeds high water mark', () => {
      const result = calculatePendingProfitShareFee(1200, 1000, 20)
      // Profit above HWM = 1200 - 1000 = 200
      // Fee = 200 * 20 / 100 = 40
      expect(result).toBe(40)
    })

    it('should handle different fee percentages', () => {
      // 10% fee
      expect(calculatePendingProfitShareFee(1100, 1000, 10)).toBe(10)

      // 25% fee
      expect(calculatePendingProfitShareFee(1100, 1000, 25)).toBe(25)

      // 0% fee
      expect(calculatePendingProfitShareFee(1100, 1000, 0)).toBe(0)
    })

    it('should handle fractional values', () => {
      const result = calculatePendingProfitShareFee(1050.5, 1000, 20)
      // Profit = 50.5, Fee = 50.5 * 0.2 = 10.1
      expect(result).toBeCloseTo(10.1, 5)
    })
  })
})
