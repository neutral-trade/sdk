// Constants
export { BundleProgramId } from './constants/programs'

// Auto-generated vault IDs (for backward compatibility)
export { VaultId } from './constants/vault-ids'

export { getBundleProgramId, getDriftProgramId, getVaultByAddress, getVaultById, isValidVaultAddress, vaults } from './constants/vaults'

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
  VaultBalanceData,
  VaultRegistryEntry as VaultConfig,
  VaultRegistry as VaultConfigRecord,
} from './types'
export {
  SupportedChain,
  SupportedToken,
  tokens,
  VaultType,
} from './types'

// Utils (for advanced users)
export {
  deriveOraclePDA,
  deriveUserPDA,
  getVaultDepositorAddressSync,
} from './utils/pda'
