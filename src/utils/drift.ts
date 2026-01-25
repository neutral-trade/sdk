// Drift vault balance calculation

import type { Vault, VaultClient, VaultDepositor } from '@drift-labs/vaults-sdk'
import type { VaultBalanceData, VaultConfig, VaultId } from '../types'
import { BN } from '@coral-xyz/anchor'
import { convertToNumber, QUOTE_PRECISION, TEN } from '@drift-labs/sdk'
import { VAULT_PROGRAM_ID } from '@drift-labs/vaults-sdk'

// Get Drift vault balances using fetchMultiple

import { PublicKey } from '@solana/web3.js'
import { SupportedToken } from '../types'
import { getVaultDepositorAddressSync } from './pda'

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
    feesPaid: 0,
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
    feesPaid: profitShareFeePaid,
    highWaterMark,
    pendingProfitShareFee,
    asset,
  }
}

export async function getDriftBalances({
  vaultIds,
  userAddress,
  vaults,
  driftVaultClient,
}: {
  vaultIds: VaultId[]
  userAddress: string
  vaults: Partial<Record<VaultId, VaultConfig>>
  driftVaultClient: VaultClient
}): Promise<Record<VaultId, VaultBalanceData | null>> {
  const result: Record<VaultId, VaultBalanceData | null> = {} as Record<VaultId, VaultBalanceData | null>
  const userPublicKey = new PublicKey(userAddress)

  // Get all vault configs
  const vaultConfigs = vaultIds.map(id => vaults[id]!).filter(Boolean)

  if (vaultConfigs.length === 0) {
    return result
  }

  // Prepare vault addresses and depositor PDAs
  const vaultAddresses = vaultConfigs.map(c => new PublicKey(c.vaultAddress))

  const vaultDepositorPDAs = vaultConfigs.map((c) => {
    const vaultPubkey = new PublicKey(c.vaultAddress)
    const programId = c.driftProgramId
      ? new PublicKey(c.driftProgramId)
      : VAULT_PROGRAM_ID
    return getVaultDepositorAddressSync(programId, vaultPubkey, userPublicKey)
  })

  // Fetch all vaults and depositors using fetchMultiple
  const [vaultsData, vaultDepositors] = await Promise.all([
    driftVaultClient.program.account.vault.fetchMultiple(vaultAddresses),
    driftVaultClient.program.account.vaultDepositor.fetchMultiple(vaultDepositorPDAs),
  ])

  // Calculate balance for each vault
  for (let i = 0; i < vaultIds.length; i++) {
    const vaultId = vaultIds[i]
    const config = vaultConfigs[i]
    const vault = vaultsData[i]
    const vaultDepositor = vaultDepositors[i]

    if (!vault || !vaultDepositor) {
      result[vaultId] = null
      continue
    }

    try {
      result[vaultId] = await calculateDriftVaultBalance({
        vault,
        vaultDepositor,
        driftVaultClient,
        profitShareFeePercent: (config.pfee ?? 0) * 100,
        asset: config.depositToken,
      })
    }
    catch (e) {
      console.error(`Error calculating balance for drift vault ${vaultId}:`, e)
      result[vaultId] = null
    }
  }

  return result
}
