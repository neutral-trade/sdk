// Re-export all types

import type { SupportedToken } from './tokens'

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
  /** Unpaid / accrued fees in deposit token; null if not applicable. Bundle: mgmt+perf estimate; Drift: pending profit share. */
  pendingFee: number | null
  pendingFeeUsd: number | null
  spotPrice: number
  /** User's vault shares (raw number, not divided by decimals) */
  vaultShares?: number
  /** User's net deposits in token amount (already divided by decimals) */
  netDeposit?: number
  asset: SupportedToken
}

// Result type for getUserBalanceByVaultIds
export type UserBalanceResult = Record<number, VaultBalanceData | null>
