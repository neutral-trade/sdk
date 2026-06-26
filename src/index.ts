export { createDummyWallet } from './constants/client'
// Constants
export {
  ALLOWLISTED_BUNDLE_PROGRAM_IDS_BY_CLUSTER,
  assertAllowlistedBundleProgramId,
  BUNDLE_PROGRAM_ID_V2_MAINNET,
  createAllowlistedBundleProgram,
  createBundleProgramById,
  DEFAULT_BUNDLE_PROGRAM_ID_DEVNET,
  DEFAULT_BUNDLE_PROGRAM_ID_MAINNET,
  getDefaultBundleProgramIdByCluster,
  isAllowlistedBundleProgramId,
} from './constants/programs'
export type { BundleCluster, BundleProgram, BundleProvider } from './constants/programs'
export { VaultId } from './constants/vault-ids'
// Auto-generated vault IDs (for backward compatibility)
export { DevnetVaultId } from './constants/vault-ids.devnet'
export {
  getBundleProgramId,
  getVaultByAddress,
  getVaultById,
  getVaultRegistry,
  isValidVaultAddress,
  vaults,
  vaultsDevnet,
} from './constants/vaults'

export type { NeutralTradeCoreContext } from './neutral-trade-core'

// Main class
export { NeutralTrade } from './NeutralTrade'
export type { NeutralTradeConfig } from './NeutralTrade'
// Types
export type {
  BundleAccount,
  OracleData,
  Token,
  UserBalanceResult,
  UserBundleAccount,
  UserBundleTempData,
  VaultBalanceData,
  VaultRegistry,
  VaultRegistryEntry,
} from './types'
export {
  getSolanaTokenDecimals,
  getSolanaTokenMint,
  SupportedChain,
  SupportedToken,
  tokens,
  VaultCategory,
  VaultType,
} from './types'

export { humanFloatToAmountRawString, parseAmountRawToBigInt } from './utils/amount-raw'
export {
  bpsToFeeDecimal,
  computeDepositFeePreview,
  effectiveFeeBpsToDecimals,
  FEE_OVERRIDE,
  feeDecimalToBps,
  hasAnyFeeOverride,
  hasCustomFeeRate,
  resolveEffectiveFeeBps,
  resolveEffectiveFeeBpsFromDefaults,
  resolveEffectiveVaultFees,
  vaultFeeDecimalsToBps,
} from './utils/bundle-fee-override'
export type { EffectiveFeeBps, EffectiveVaultFeeDecimals } from './utils/bundle-fee-override'
export {
  buildBundleDepositInstructions,
  buildBundleRequestWithdrawInstruction,
  computeRequestWithdrawalSharesFromAmountRaw,
} from './utils/bundle-instructions'
export type {
  BuildBundleDepositInstructionsParams,
  BuildBundleRequestWithdrawInstructionParams,
} from './utils/bundle-instructions'

// Utils (for advanced users)
export {
  deriveOraclePDA,
  derivePendingAuthPDA,
  deriveTempDataPDA,
  deriveUserPDA,
  getVaultDepositorAddressSync,
  SEED_ORACLE,
  SEED_PENDING_AUTH,
  SEED_TEMP,
  SEED_USER,
} from './utils/pda'
