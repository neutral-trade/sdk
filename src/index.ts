export { getPointsVaults } from './constants/points-vaults'

export type { PointsVaultEntry } from './constants/points-vaults'

// Constants
export {
  BundleProgramId,
  createBundlePrograms,
  createBundleProgramV1,
  createBundleProgramV2,
} from './constants/programs'
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

export { estimatePendingBundleFeeToken } from './utils/bundle'
// Utils (for advanced users)
export {
  deriveOraclePDA,
  deriveUserPDA,
  getVaultDepositorAddressSync,
} from './utils/pda'
