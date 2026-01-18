// Re-export all types

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
  highWaterMark?: number | null
  profitShareFeePaid?: number | null
  /** Alias for profitShareFeePaid (Bundle vault naming) */
  totalFeeCharged?: number | null
  pendingProfitShareFee?: number
  spotPrice: number
  /** User's vault shares (raw number, not divided by decimals) */
  vaultShares?: number
  /** User's net deposits in token amount (already divided by decimals) */
  netDeposit?: number
  asset: import('./tokens').SupportedToken
}

// Result type for getUserBalanceByVaultIds
export type UserBalanceResult = Record<import('./vault-types').VaultId, VaultBalanceData | null>
