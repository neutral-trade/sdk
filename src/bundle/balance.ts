// Bundle vault balance calculation (using on-chain PPS)

import type { VaultBalanceData } from '../types'
import type { BundleAccount, OracleData, UserBundleAccount } from '../types/bundle-types'
import type { SupportedToken } from '../types/tokens'

/**
 * Helper function to return zero balance for Bundle vault
 */
export function getZeroBundleBalance(asset: SupportedToken, spotPrice: number): VaultBalanceData {
  return {
    balanceToken: 0,
    balanceUsd: 0,
    netEarnings: 0,
    netEarningsUsd: 0,
    totalDeposit: 0,
    totalDepositUsd: 0,
    pendingDeposit: 0,
    highWaterMark: 0,
    feesPaid: 0,
    spotPrice,
    vaultShares: 0,
    netDeposit: 0,
    asset,
  }
}

/**
 * Calculate on-chain PPS for Bundle vault
 * Formula: (Oracle Average External Equity + USDC on Bundle PDA) / Total Shares
 */
export function calculateOnChainPps({
  oracleAverageExternalEquity,
  bundleUnderlyingBalance,
  totalShares,
}: {
  oracleAverageExternalEquity: bigint
  bundleUnderlyingBalance: bigint
  totalShares: bigint
}): number {
  const totalEquity = Number(oracleAverageExternalEquity) + Number(bundleUnderlyingBalance)
  const totalSharesNum = Number(totalShares)
  return totalSharesNum > 0 ? totalEquity / totalSharesNum : 0
}

/**
 * Calculate Bundle vault user balance from on-chain data
 */
export function calculateBundleUserBalance({
  oracleData,
  bundleData,
  userBundle,
  assetDecimals,
  spotPrice,
  asset,
}: {
  oracleData: OracleData
  bundleData: BundleAccount
  userBundle: UserBundleAccount
  assetDecimals: number
  spotPrice: number
  asset: SupportedToken
}): VaultBalanceData {
  const divisor = 10 ** assetDecimals

  // Calculate On-Chain PPS
  const onChainPps = calculateOnChainPps({
    oracleAverageExternalEquity: BigInt(oracleData.averageExternalEquity.toString()),
    bundleUnderlyingBalance: BigInt(bundleData.bundleUnderlyingBalance.toString()),
    totalShares: BigInt(bundleData.totalShares.toString()),
  })

  // Calculate User Balance
  const userSharesNum = Number(userBundle.shares.toString())
  const userBalance = Math.round(userSharesNum * onChainPps) / divisor

  // Calculate Other Fields
  const netDeposits = Number(userBundle.netDeposits.toString()) / divisor
  const pendingDeposit = Number(userBundle.pendingDeposit.toString()) / divisor
  const feesPaid = Number(userBundle.totalFeeCharged.toString()) / divisor
  const userEarnings = userBalance - netDeposits
  const highWaterMark
    = Math.floor((Number(userBundle.hwmPerShare.toString()) * userSharesNum) / divisor) / divisor

  return {
    balanceToken: userBalance,
    balanceUsd: userBalance * spotPrice,
    netEarnings: userEarnings,
    netEarningsUsd: userEarnings * spotPrice,
    totalDeposit: userBalance + pendingDeposit,
    totalDepositUsd: (userBalance + pendingDeposit) * spotPrice,
    pendingDeposit,
    highWaterMark: highWaterMark + pendingDeposit,
    feesPaid,
    spotPrice,
    vaultShares: userSharesNum,
    netDeposit: netDeposits,
    asset,
  }
}
