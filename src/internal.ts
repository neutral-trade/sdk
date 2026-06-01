/**
 * @internal
 * Public integrators should use the main `@neutral-trade/sdk` entry and vaultId-based builders.
 */
export {
  buildDepositInstructionsForVaultId,
  buildRequestWithdrawInstructionForVaultId,
  getBundleProgramForVault,
  initNeutralTradeCore,
  type NeutralTradeCoreContext,
} from './neutral-trade-core'

export type {
  BuildBundleDepositInstructionsCoreParams,
  BuildBundleRequestWithdrawInstructionCoreParams,
} from './utils/bundle-instructions-core'

export {
  buildBundleDepositInstructionsWithVault,
  buildBundleRequestWithdrawInstructionWithVault,
} from './utils/bundle-instructions-core'
