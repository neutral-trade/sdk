import type { BundleAccount, OracleData, UserBundleAccount } from '../src/types/bundle-types'
import { BN } from '@coral-xyz/anchor'
import { describe, expect, it } from 'vitest'
import { SupportedToken } from '../src/types/tokens'
import {
  calculateBundleUserBalance,
  calculateOnChainPps,
  getZeroBundleBalance,
} from '../src/utils/bundle'

describe('bundle Balance Calculations', () => {
  describe('getZeroBundleBalance', () => {
    it('should return zero balance object with correct asset', () => {
      const result = getZeroBundleBalance(SupportedToken.USDC, 1)

      expect(result.balanceToken).toBe(0)
      expect(result.balanceUsd).toBe(0)
      expect(result.netEarnings).toBe(0)
      expect(result.netEarningsUsd).toBe(0)
      expect(result.totalDeposit).toBe(0)
      expect(result.totalDepositUsd).toBe(0)
      expect(result.pendingDeposit).toBe(0)
      expect(result.highWaterMark).toBe(0)
      expect(result.feesPaid).toBe(0)
      expect(result.netDeposit).toBe(0)
      expect(result.asset).toBe(SupportedToken.USDC)
      expect(result.spotPrice).toBe(1) // default spot price
    })

    it('should use custom spotPrice when provided', () => {
      const customSpotPrice = 1.5
      const result = getZeroBundleBalance(SupportedToken.USDC, customSpotPrice)

      expect(result.spotPrice).toBe(customSpotPrice)
      expect(result.balanceUsd).toBe(0) // still zero
    })

    it('should work with different token types', () => {
      const usdtResult = getZeroBundleBalance(SupportedToken.USDT, 1)
      expect(usdtResult.asset).toBe(SupportedToken.USDT)

      const solResult = getZeroBundleBalance(SupportedToken.SOL, 1)
      expect(solResult.asset).toBe(SupportedToken.SOL)
    })
  })

  describe('calculateOnChainPps', () => {
    it('should calculate PPS correctly with positive values', () => {
      const result = calculateOnChainPps({
        oracleAverageExternalEquity: BigInt(1_000_000), // 1 USDC (6 decimals)
        bundleUnderlyingBalance: BigInt(500_000), // 0.5 USDC
        totalShares: BigInt(1_000_000), // 1M shares
      })

      // (1_000_000 + 500_000) / 1_000_000 = 1.5
      expect(result).toBe(1.5)
    })

    it('should return 0 when totalShares is 0', () => {
      const result = calculateOnChainPps({
        oracleAverageExternalEquity: BigInt(1_000_000),
        bundleUnderlyingBalance: BigInt(500_000),
        totalShares: BigInt(0),
      })

      expect(result).toBe(0)
    })

    it('should handle large numbers correctly', () => {
      const result = calculateOnChainPps({
        oracleAverageExternalEquity: BigInt('10000000000000'), // 10M USDC
        bundleUnderlyingBalance: BigInt('5000000000000'), // 5M USDC
        totalShares: BigInt('15000000000000'), // 15M shares
      })

      // (10M + 5M) / 15M = 1.0
      expect(result).toBe(1)
    })

    it('should return fractional PPS values', () => {
      const result = calculateOnChainPps({
        oracleAverageExternalEquity: BigInt(100),
        bundleUnderlyingBalance: BigInt(50),
        totalShares: BigInt(300),
      })

      // (100 + 50) / 300 = 0.5
      expect(result).toBe(0.5)
    })

    it('should handle zero equity', () => {
      const result = calculateOnChainPps({
        oracleAverageExternalEquity: BigInt(0),
        bundleUnderlyingBalance: BigInt(0),
        totalShares: BigInt(1_000_000),
      })

      expect(result).toBe(0)
    })
  })

  describe('calculateBundleUserBalance', () => {
    // Helper to create mock data
    const createMockOracleData = (averageExternalEquity: string): OracleData => ({
      averageExternalEquity: new BN(averageExternalEquity),
    }) as unknown as OracleData

    const createMockBundleData = (
      bundleUnderlyingBalance: string,
      totalShares: string,
    ): BundleAccount => ({
      bundleUnderlyingBalance: new BN(bundleUnderlyingBalance),
      totalShares: new BN(totalShares),
    }) as unknown as BundleAccount

    const createMockUserBundle = (
      shares: string,
      netDeposits: string,
      pendingDeposit: string,
      totalFeeCharged: string,
      hwmPerShare: string,
    ): UserBundleAccount => ({
      shares: new BN(shares),
      netDeposits: new BN(netDeposits),
      pendingDeposit: new BN(pendingDeposit),
      totalFeeCharged: new BN(totalFeeCharged),
      hwmPerShare: new BN(hwmPerShare),
    }) as unknown as UserBundleAccount

    it('should calculate user balance correctly', () => {
      const oracleData = createMockOracleData('10000000000') // 10,000 USDC (6 decimals)
      const bundleData = createMockBundleData('0', '10000000000') // 10,000 shares
      const userBundle = createMockUserBundle(
        '1000000000', // 1,000 shares (10% of total)
        '900000000', // 900 USDC net deposits
        '0', // no pending
        '10000000', // 10 USDC fees paid
        '1000000', // HWM per share
      )

      const result = calculateBundleUserBalance({
        oracleData,
        bundleData,
        userBundle,
        assetDecimals: 6,
        spotPrice: 1,
        asset: SupportedToken.USDC,
      })

      // PPS = 10,000 / 10,000 = 1.0
      // User balance = 1,000 shares * 1.0 PPS = 1,000 USDC
      expect(result.balanceToken).toBe(1000)
      expect(result.balanceUsd).toBe(1000) // spotPrice = 1
      expect(result.netDeposit).toBe(900)
      expect(result.netEarnings).toBe(100) // 1000 - 900 = 100
      expect(result.asset).toBe(SupportedToken.USDC)
    })

    it('should handle pending deposits', () => {
      const oracleData = createMockOracleData('10000000000')
      const bundleData = createMockBundleData('0', '10000000000')
      const userBundle = createMockUserBundle(
        '1000000000',
        '900000000',
        '100000000', // 100 USDC pending deposit
        '0',
        '1000000',
      )

      const result = calculateBundleUserBalance({
        oracleData,
        bundleData,
        userBundle,
        assetDecimals: 6,
        spotPrice: 1,
        asset: SupportedToken.USDC,
      })

      expect(result.pendingDeposit).toBe(100)
      expect(result.totalDeposit).toBe(1100) // balance + pending
    })

    it('should calculate with custom spotPrice', () => {
      const oracleData = createMockOracleData('10000000000')
      const bundleData = createMockBundleData('0', '10000000000')
      const userBundle = createMockUserBundle(
        '1000000000',
        '900000000',
        '0',
        '0',
        '1000000',
      )

      const spotPrice = 150 // e.g., SOL at $150
      const result = calculateBundleUserBalance({
        oracleData,
        bundleData,
        userBundle,
        assetDecimals: 6,
        spotPrice,
        asset: SupportedToken.SOL,
      })

      expect(result.balanceToken).toBe(1000)
      expect(result.balanceUsd).toBe(150000) // 1000 * 150
      expect(result.spotPrice).toBe(150)
    })

    it('should handle different decimals (9 decimals for SOL)', () => {
      const oracleData = createMockOracleData('10000000000000') // 10,000 with 9 decimals
      const bundleData = createMockBundleData('0', '10000000000000')
      const userBundle = createMockUserBundle(
        '1000000000000', // 1,000 shares
        '900000000000', // 900 net deposits
        '0',
        '0',
        '1000000000',
      )

      const result = calculateBundleUserBalance({
        oracleData,
        bundleData,
        userBundle,
        assetDecimals: 9,
        spotPrice: 1,
        asset: SupportedToken.SOL,
      })

      expect(result.balanceToken).toBe(1000)
      expect(result.netDeposit).toBe(900)
    })

    it('should handle negative earnings (loss scenario)', () => {
      const oracleData = createMockOracleData('8000000000') // 8,000 USDC
      const bundleData = createMockBundleData('0', '10000000000') // 10,000 shares
      const userBundle = createMockUserBundle(
        '1000000000', // 1,000 shares
        '1000000000', // 1,000 USDC deposited
        '0',
        '0',
        '1000000',
      )

      const result = calculateBundleUserBalance({
        oracleData,
        bundleData,
        userBundle,
        assetDecimals: 6,
        spotPrice: 1,
        asset: SupportedToken.USDC,
      })

      // PPS = 8,000 / 10,000 = 0.8
      // User balance = 1,000 * 0.8 = 800 USDC
      expect(result.balanceToken).toBe(800)
      expect(result.netEarnings).toBe(-200) // 800 - 1000 = -200 loss
    })

    it('should track fees paid', () => {
      const oracleData = createMockOracleData('10000000000')
      const bundleData = createMockBundleData('0', '10000000000')
      const userBundle = createMockUserBundle(
        '1000000000',
        '900000000',
        '0',
        '50000000', // 50 USDC fees paid
        '1000000',
      )

      const result = calculateBundleUserBalance({
        oracleData,
        bundleData,
        userBundle,
        assetDecimals: 6,
        spotPrice: 1,
        asset: SupportedToken.USDC,
      })

      expect(result.feesPaid).toBe(50)
    })

    it('should include vault shares in result', () => {
      const oracleData = createMockOracleData('10000000000')
      const bundleData = createMockBundleData('0', '10000000000')
      const userBundle = createMockUserBundle(
        '1234567890',
        '900000000',
        '0',
        '0',
        '1000000',
      )

      const result = calculateBundleUserBalance({
        oracleData,
        bundleData,
        userBundle,
        assetDecimals: 6,
        spotPrice: 1,
        asset: SupportedToken.USDC,
      })

      expect(result.vaultShares).toBe(1234567890)
    })

    it('should handle bundleUnderlyingBalance in PPS calculation', () => {
      const oracleData = createMockOracleData('9000000000') // 9,000 USDC external
      const bundleData = createMockBundleData('1000000000', '10000000000') // 1,000 USDC in bundle, 10,000 shares
      const userBundle = createMockUserBundle(
        '1000000000', // 1,000 shares (10%)
        '900000000',
        '0',
        '0',
        '1000000',
      )

      const result = calculateBundleUserBalance({
        oracleData,
        bundleData,
        userBundle,
        assetDecimals: 6,
        spotPrice: 1,
        asset: SupportedToken.USDC,
      })

      // PPS = (9,000 + 1,000) / 10,000 = 1.0
      // User balance = 1,000 shares * 1.0 = 1,000 USDC
      expect(result.balanceToken).toBe(1000)
    })
  })
})
