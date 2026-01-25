// Re-export all types

import type { SupportedToken } from './tokens'
import type { VaultId } from './vault-types'

export * from './bundle-types'
export * from './tokens'
export * from './vault-types'

// VaultBalanceData - returned from getUserBalance functions
export interface VaultBalanceData {
  balanceToken: number
  balanceUsd: number
  netEarnings: number
  netEarningsUsd: number
  totalDeposit: number
  totalDepositUsd: number
  pendingDeposit?: number
  requestWithdrawToken?: number
  highWaterMark?: number
  /** Total profit share fee paid by the user */
  feesPaid?: number
  pendingProfitShareFee?: number
  spotPrice: number
  /** User's vault shares (raw number, not divided by decimals) */
  vaultShares?: number
  /** User's net deposits in token amount (already divided by decimals) */
  netDeposit?: number
  asset: SupportedToken
}

// Result type for getUserBalanceByVaultIds
export type UserBalanceResult = Record<VaultId, VaultBalanceData | null>
