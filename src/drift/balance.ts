// Drift vault balance calculation

import type { Vault, VaultClient, VaultDepositor } from '@drift-labs/vaults-sdk'
import type { VaultBalanceData } from '../types'
import { BN } from '@coral-xyz/anchor'
import { convertToNumber, QUOTE_PRECISION, TEN } from '@drift-labs/sdk'
import { SupportedToken } from '../types'

/**
 * Calculate total earnings for Drift vault
 */
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

/**
 * Helper function to return zero balance
 */
export function getZeroDriftBalance(asset: SupportedToken): VaultBalanceData {
  return {
    balanceToken: 0,
    balanceUsd: 0,
    netEarnings: 0,
    netEarningsUsd: 0,
    totalDeposit: 0,
    totalDepositUsd: 0,
    spotPrice: 0,
    netDeposit: 0,
    vaultShares: 0,
    profitShareFeePaid: 0,
    totalFeeCharged: 0,
    highWaterMark: 0,
    pendingProfitShareFee: 0,
    requestWithdrawToken: 0,
    asset,
  }
}

/**
 * Calculate Drift vault balance from vault and vaultDepositor accounts
 */
export async function calculateDriftVaultBalance({
  vault,
  vaultDepositor,
  driftVaultClient,
  profitShareFeePercent = 0,
  asset = SupportedToken.USDC,
}: {
  vault: Vault
  vaultDepositor: VaultDepositor
  driftVaultClient: VaultClient
  profitShareFeePercent?: number
  asset: SupportedToken
}): Promise<VaultBalanceData> {
  const vaultClient = driftVaultClient
  const driftClient = vaultClient.driftClient

  // Get vault equity
  const vaultEquity = await vaultClient.calculateVaultEquity({ vault })

  // Get spot market and oracle price
  const spotMarket = driftClient.getSpotMarketAccount(vault.spotMarketIndex)
  if (!spotMarket) {
    throw new Error('Spot market not found')
  }

  const spotOracle = driftClient.getOracleDataForSpotMarket(vault.spotMarketIndex)
  const spotPrice = convertToNumber(spotOracle.price, QUOTE_PRECISION)

  // Calculate balance
  const vaultEquityNum = convertToNumber(vaultEquity, QUOTE_PRECISION)
  const vaultDepositorShare = vaultDepositor.vaultShares.toNumber()
  const requestedWithdrawShare = vaultDepositor.lastWithdrawRequest.shares.toNumber()
  const activeShares = vaultDepositorShare - requestedWithdrawShare

  const balanceUsd
    = vault.totalShares.toNumber() > 0
      ? (vaultEquityNum * activeShares) / vault.totalShares.toNumber()
      : 0

  const balanceToken = spotPrice > 0 ? balanceUsd / spotPrice : 0

  // Calculate earnings
  const spotPrecision = TEN.pow(new BN(spotMarket.decimals))
  const netDeposit = convertToNumber(vaultDepositor.netDeposits, spotPrecision)
  const requestWithdrawToken = convertToNumber(
    vaultDepositor.lastWithdrawRequest.value,
    spotPrecision,
  )

  const profitShareFeePaid = convertToNumber(vaultDepositor.profitShareFeePaid, spotPrecision)
  const cumulativeProfitShareAmount = convertToNumber(
    vaultDepositor.cumulativeProfitShareAmount,
    spotPrecision,
  )
  const highWaterMark = netDeposit + cumulativeProfitShareAmount

  // Calculate pending profit share fee
  let pendingProfitShareFee = 0
  if (balanceToken > highWaterMark) {
    const profitAboveHighWaterMark = balanceToken - highWaterMark
    pendingProfitShareFee = (profitAboveHighWaterMark * profitShareFeePercent) / 100
  }

  // Calculate total earnings
  const totalEarnings = getDriftVaultTotalEarning({
    netDepositToken: netDeposit,
    requestWithdrawToken,
    balanceToken,
  })

  const netEarnings = totalEarnings - pendingProfitShareFee
  const totalDeposit = balanceToken + requestWithdrawToken

  return {
    balanceToken,
    balanceUsd,
    netEarnings,
    netEarningsUsd: netEarnings * spotPrice,
    totalDepositUsd: totalDeposit * spotPrice,
    totalDeposit,
    requestWithdrawToken,
    spotPrice,
    netDeposit,
    vaultShares: vaultDepositorShare,
    profitShareFeePaid,
    totalFeeCharged: profitShareFeePaid, // Alias for profitShareFeePaid (Drift naming)
    highWaterMark,
    pendingProfitShareFee,
    asset,
  }
}
