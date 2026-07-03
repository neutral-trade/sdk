/**
 * Public integrators should use the main `@neutral-trade/sdk` entry and vaultId-based builders.
 * @internal
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
  BuildBundleRequestSwitchInstructionCoreParams,
  BuildBundleRequestWithdrawInstructionCoreParams,
} from './utils/bundle-instructions-core'

export {
  buildBundleDepositInstructionsWithVault,
  buildBundleRequestSwitchInstructionWithVault,
  buildBundleRequestWithdrawInstructionWithVault,
} from './utils/bundle-instructions-core'
