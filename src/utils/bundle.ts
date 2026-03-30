// Bundle vault balance calculation (using on-chain PPS)

import type { Program } from '@coral-xyz/anchor'
import type { Program as Program32 } from '@coral-xyz/anchor-32'
import type { NtbundleV1 } from '../idl/bundle-v1'

// Get Bundle vault balances using fetchMultiple (with on-chain PPS)

import type { NtbundleV2 } from '../idl/bundle-v2'
import type { SupportedToken, VaultBalanceData, VaultRegistry, VaultRegistryEntry } from '../types'
import type { BundleAccount, OracleData, UserBundleAccount } from '../types/bundle-types'

import { PublicKey } from '@solana/web3.js'
import { BundleProgramId } from '../constants/programs'
import { tokens } from '../types'
import { deriveOraclePDA, deriveUserPDA } from './pda'

const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n

function bnToBigInt(v: { toString: () => string } | null | undefined): bigint {
  if (v == null)
    return 0n
  return BigInt(v.toString())
}

interface BundleFeeFields {
  managementFeeBps?: number
  performanceFee?: number
  assetPrecision?: { toString: () => string }
}

/**
 * Estimated unpaid bundle fees in deposit token (mgmt + performance), matching on-chain `charge_user_fees`.
 */
export function estimatePendingBundleFeeToken({
  oracleData,
  bundleData,
  userBundle,
  assetDecimals,
  nowUnixSeconds = Math.floor(Date.now() / 1000),
}: {
  oracleData: OracleData
  bundleData: BundleAccount
  userBundle: UserBundleAccount
  assetDecimals: number
  nowUnixSeconds?: number
}): number {
  const userShares = bnToBigInt(userBundle.shares)
  if (userShares <= 0n)
    return 0

  const totalShares = bnToBigInt(bundleData.totalShares)
  const totalAssets
    = bnToBigInt(oracleData.averageExternalEquity)
      + bnToBigInt(bundleData.bundleUnderlyingBalance)

  const extra = bundleData as BundleAccount & BundleFeeFields
  const assetPrec = extra.assetPrecision != null
    ? BigInt(extra.assetPrecision.toString())
    : BigInt(10 ** assetDecimals)

  const sharePrice = totalShares > 0n
    ? (totalAssets * assetPrec) / totalShares
    : assetPrec

  const managementFeeBps = BigInt(Number(extra.managementFeeBps ?? 0))
  const performanceFeeBps = BigInt(Number(extra.performanceFee ?? 0))

  const lastMgmtTs = bnToBigInt(userBundle.lastManagementFeeTimestamp)
  const nowTs = BigInt(nowUnixSeconds)

  let managementFeeShares = 0n
  if (lastMgmtTs > 0n && managementFeeBps > 0n) {
    const secondsElapsed = nowTs > lastMgmtTs ? nowTs - lastMgmtTs : 0n
    if (secondsElapsed > 0n) {
      const numerator = userShares * secondsElapsed * managementFeeBps
      const denominator = SECONDS_PER_YEAR * 10000n
      managementFeeShares = numerator / denominator
    }
  }

  const hwmPerShare = bnToBigInt(userBundle.hwmPerShare)
  let performanceFeeShares = 0n
  if (performanceFeeBps > 0n && sharePrice > 0n) {
    const hwmValue = hwmPerShare === 0n ? sharePrice : hwmPerShare
    if (sharePrice > hwmValue) {
      const pnlPerShare = sharePrice - hwmValue
      const numerator = pnlPerShare * userShares * performanceFeeBps
      const denominator = sharePrice * 10000n
      performanceFeeShares = numerator / denominator
    }
  }

  const totalFeeShares = managementFeeShares + performanceFeeShares
  if (totalFeeShares === 0n)
    return 0

  const feeValueRaw = (totalFeeShares * sharePrice) / assetPrec
  const divisor = 10 ** assetDecimals
  return Number(feeValueRaw) / divisor
}

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
    pendingFee: 0,
    pendingFeeUsd: 0,
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

  const pendingFeeToken = estimatePendingBundleFeeToken({
    oracleData,
    bundleData,
    userBundle,
    assetDecimals,
  })

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
    pendingFee: pendingFeeToken,
    pendingFeeUsd: pendingFeeToken * spotPrice,
    spotPrice,
    vaultShares: userSharesNum,
    netDeposit: netDeposits,
    asset,
  }
}

export async function getBundleBalances({
  vaultIds,
  userAddress,
  vaults,
  bundleProgramV1,
  bundleProgramV2,
  priceMap,
}: {
  vaultIds: number[]
  userAddress: string
  vaults: VaultRegistry
  bundleProgramV1: Program<NtbundleV1>
  bundleProgramV2: Program32<NtbundleV2>
  priceMap: Map<SupportedToken, number>
}): Promise<Record<number, VaultBalanceData | null>> {
  const result: Record<number, VaultBalanceData | null> = {}
  const userPublicKey = new PublicKey(userAddress)

  // Group vaults by program version
  const v1Vaults: { vaultId: number, config: VaultRegistryEntry }[] = []
  const v2Vaults: { vaultId: number, config: VaultRegistryEntry }[] = []

  for (const vaultId of vaultIds) {
    const config = vaults[vaultId]
    if (!config)
      continue

    if (config.bundleProgramId === BundleProgramId.V2) {
      v2Vaults.push({ vaultId, config })
    }
    else {
      v1Vaults.push({ vaultId, config })
    }
  }

  // Process V1 vaults
  if (v1Vaults.length > 0) {
    const v1BundlePDAs = v1Vaults.map(({ config }) => new PublicKey(config.vaultAddress))
    const v1OraclePDAs = v1BundlePDAs.map(bundlePDA =>
      deriveOraclePDA(bundlePDA, bundleProgramV1.programId),
    )
    const v1UserPDAs = v1BundlePDAs.map(bundlePDA =>
      deriveUserPDA(userPublicKey, bundlePDA, bundleProgramV1.programId),
    )

    // Fetch all accounts using fetchMultiple (3 calls instead of 3*N calls)
    const [v1Bundles, v1Oracles, v1Users] = await Promise.all([
      bundleProgramV1.account.bundle.fetchMultiple(v1BundlePDAs),
      bundleProgramV1.account.oracleData.fetchMultiple(v1OraclePDAs),
      bundleProgramV1.account.userBundleAccount.fetchMultiple(v1UserPDAs),
    ])

    for (let i = 0; i < v1Vaults.length; i++) {
      const { vaultId, config } = v1Vaults[i]
      const bundle = v1Bundles[i]
      const oracle = v1Oracles[i]
      const userBundle = v1Users[i]

      if (!bundle || !oracle || !userBundle) {
        result[vaultId] = null
        continue
      }

      const assetKey = config.depositToken as keyof typeof tokens
      const assetDecimals = tokens[assetKey]?.onChain?.Solana?.decimals || 6

      // Get price from priceMap
      const spotPrice = priceMap.get(config.depositToken)
      if (spotPrice === undefined) {
        throw new Error(`Price not found for token ${config.depositToken}. This should not happen as prices are initialized during creation.`)
      }

      result[vaultId] = calculateBundleUserBalance({
        oracleData: oracle,
        bundleData: bundle,
        userBundle,
        assetDecimals,
        spotPrice,
        asset: config.depositToken,
      })
    }
  }

  // Process V2 vaults
  if (v2Vaults.length > 0) {
    const v2BundlePDAs = v2Vaults.map(({ config }) => new PublicKey(config.vaultAddress))
    const v2OraclePDAs = v2BundlePDAs.map(bundlePDA =>
      deriveOraclePDA(bundlePDA, bundleProgramV2.programId),
    )
    const v2UserPDAs = v2BundlePDAs.map(bundlePDA =>
      deriveUserPDA(userPublicKey, bundlePDA, bundleProgramV2.programId),
    )

    // Fetch all accounts using fetchMultiple
    const [v2Bundles, v2Oracles, v2Users] = await Promise.all([
      bundleProgramV2.account.bundle.fetchMultiple(v2BundlePDAs),
      bundleProgramV2.account.oracleData.fetchMultiple(v2OraclePDAs),
      bundleProgramV2.account.userBundleAccount.fetchMultiple(v2UserPDAs),
    ])

    for (let i = 0; i < v2Vaults.length; i++) {
      const { vaultId, config } = v2Vaults[i]
      const bundle = v2Bundles[i]
      const oracle = v2Oracles[i]
      const userBundle = v2Users[i]

      if (!bundle || !oracle || !userBundle) {
        result[vaultId] = null
        continue
      }

      const assetKey = config.depositToken as keyof typeof tokens
      const assetDecimals = tokens[assetKey]?.onChain?.Solana?.decimals || 6

      // Get price from priceMap
      const spotPrice = priceMap.get(config.depositToken)
      if (spotPrice === undefined) {
        throw new Error(`Price not found for token ${config.depositToken}. This should not happen as prices are initialized during creation.`)
      }

      result[vaultId] = calculateBundleUserBalance({
        oracleData: oracle,
        bundleData: bundle,
        userBundle,
        assetDecimals,
        spotPrice,
        asset: config.depositToken,
      })
    }
  }

  return result
}
