export {
  createDummyWallet,
} from './constants/client'
// Constants
export {
  DEFAULT_BUNDLE_PROGRAM_ID_DEVNET,
  DEFAULT_BUNDLE_PROGRAM_ID_MAINNET,
  getDefaultBundleProgramIdByCluster,
} from './constants/programs'
export type { BundleCluster } from './constants/programs'
// Auto-generated vault IDs (for backward compatibility)
export { VaultId } from './constants/vault-ids'
export {
  getBundleProgramId,
  getVaultByAddress,
  getVaultById,
  isValidVaultAddress,
  vaults,
} from './constants/vaults'

// Main class
export { NeutralTrade } from './NeutralTrade'

export type { NeutralTradeConfig, NeutralTradeCoreContext } from './NeutralTrade'
// Types
export type {
  BundleAccount,
  OracleData,
  Token,
  UserBalanceResult,
  UserBundleAccount,
  UserBundleTempData,
  VaultBalanceData,
  VaultRegistryEntry as VaultConfig,
  VaultRegistry as VaultConfigRecord,
} from './types'
export {
  SupportedChain,
  SupportedToken,
  tokens,
  VaultCategory,
  VaultType,
} from './types'

export {
  buildBundleDepositInstructions,
  buildBundleRequestWithdrawInstruction,
} from './utils/bundle-instructions'

// Utils (for advanced users)
export {
  deriveOraclePDA,
  deriveUserPDA,
  getVaultDepositorAddressSync,
} from './utils/pda'
