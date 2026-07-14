export type BundleCluster = 'mainnet' | 'devnet'

export const DEFAULT_BUNDLE_PROGRAM_ID_MAINNET = 'BUNDDh4P5XviMm1f3gCvnq2qKx6TGosAGnoUK12e7cXU'

/**
 * Secondary mainnet ntbundle program id used by vaults that explicitly select it.
 */
export const BUNDLE_PROGRAM_ID_V2_MAINNET = 'BUNDeH5A4c47bcEoAjBhN3sCjLgYnRsmt9ibMztqVkC9'

// Source: bundle-sc/Anchor.toml [programs.devnet]
export const DEFAULT_BUNDLE_PROGRAM_ID_DEVNET = 'CcR9whVnaW3STx6LLYotwy5JJXmnC8KDjtRotA3NCL8v'

export function getDefaultBundleProgramIdByCluster(cluster: BundleCluster = 'mainnet'): string {
  return cluster === 'devnet'
    ? DEFAULT_BUNDLE_PROGRAM_ID_DEVNET
    : DEFAULT_BUNDLE_PROGRAM_ID_MAINNET
}

export const ALLOWLISTED_BUNDLE_PROGRAM_IDS_BY_CLUSTER: Record<BundleCluster, readonly string[]> = {
  mainnet: [DEFAULT_BUNDLE_PROGRAM_ID_MAINNET, BUNDLE_PROGRAM_ID_V2_MAINNET],
  devnet: [DEFAULT_BUNDLE_PROGRAM_ID_DEVNET],
}

export function isAllowlistedBundleProgramId(programId: string, cluster: BundleCluster): boolean {
  return ALLOWLISTED_BUNDLE_PROGRAM_IDS_BY_CLUSTER[cluster].includes(programId)
}

export function assertAllowlistedBundleProgramId(programId: string, cluster: BundleCluster): void {
  if (!isAllowlistedBundleProgramId(programId, cluster)) {
    throw new Error(`Unsupported bundle program id for ${cluster}: ${programId}`)
  }
}
