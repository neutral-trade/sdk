import type { VaultRegistry, VaultRegistryEntry } from '../types'
import type { BundleCluster } from './programs'
import vaultsDevnetJson from '../registry/vaults.devnet.json'
import vaultsMainnetJson from '../registry/vaults.json'
import { VaultRegistryArraySchema, VaultType } from '../types'
import { getDefaultBundleProgramIdByCluster } from './programs'

/**
 * Get Bundle Program ID for a vault config
 * Uses registry value if present, otherwise falls back to cluster default.
 */
export function getBundleProgramId(
  vault: VaultRegistryEntry,
  cluster: BundleCluster = 'mainnet',
): string | undefined {
  if (vault.type !== VaultType.Bundle) {
    return undefined
  }
  if (vault.bundleProgramId) {
    return vault.bundleProgramId
  }
  return getDefaultBundleProgramIdByCluster(cluster)
}

/**
 * Get Drift Program ID for a vault config as PublicKey
 * Uses registry value if present, otherwise defaults to VAULT_PROGRAM_ID
 */
export function getDriftProgramId(vault: VaultRegistryEntry): string | undefined {
  if (vault.type !== VaultType.Drift) {
    return undefined
  }
  if (vault.driftProgramId) {
    return vault.driftProgramId
  }
  return 'vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR'
}

// =============================================================================
// TRANSFORMATION FUNCTIONS
// =============================================================================

/**
 * Transform a registry entry to VaultConfig with program IDs
 * - Drift vaults get driftProgramId
 * - Bundle vaults get bundleProgramId (registry value or cluster default via {@link getBundleProgramId})
 */
export function toVaultConfig(
  entry: VaultRegistryEntry,
  cluster: BundleCluster = 'mainnet',
): VaultRegistryEntry {
  return {
    ...entry,
    driftProgramId: getDriftProgramId(entry),
    bundleProgramId: getBundleProgramId(entry, cluster),
  }
}

/**
 * Transform an array of registry entries to VaultRegistry
 * @param cluster - Used to resolve default bundle program id when `bundleProgramId` is omitted in JSON
 */
export function toVaultRegistry(
  entries: VaultRegistryEntry[],
  cluster: BundleCluster = 'mainnet',
): VaultRegistry {
  return Object.fromEntries(
    entries.map(entry => [entry.vaultId, toVaultConfig(entry, cluster)]),
  )
}

// =============================================================================
// VAULT REGISTRY VALIDATION & TRANSFORMATION
// =============================================================================

// Validate and transform JSON array to Record<number, VaultConfig>
const parsedVaultsMainnet = VaultRegistryArraySchema.parse(vaultsMainnetJson)
const parsedVaultsDevnet = VaultRegistryArraySchema.parse(vaultsDevnetJson)

const vaultsMainnetRegistry: VaultRegistry = toVaultRegistry(parsedVaultsMainnet, 'mainnet')
const vaultsDevnetRegistry: VaultRegistry = toVaultRegistry(parsedVaultsDevnet, 'devnet')

/** Mainnet registry (default; backward compatible). */
export const vaults: VaultRegistry = vaultsMainnetRegistry

/** Devnet-only vault registry (fixtures / local testing). */
export const vaultsDevnet: VaultRegistry = vaultsDevnetRegistry

export function getVaultRegistry(cluster: BundleCluster): VaultRegistry {
  return cluster === 'devnet' ? vaultsDevnetRegistry : vaultsMainnetRegistry
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function isValidVaultAddress(address: string, cluster: BundleCluster = 'mainnet'): boolean {
  return Object.values(getVaultRegistry(cluster))
    .map(vault => vault.vaultAddress)
    .includes(address)
}

export function getVaultByAddress(address: string, cluster: BundleCluster = 'mainnet'): VaultRegistryEntry | undefined {
  return Object.values(getVaultRegistry(cluster)).find(v => v.vaultAddress === address)
}

export function getVaultById(vaultId: number, cluster: BundleCluster = 'mainnet'): VaultRegistryEntry | undefined {
  return getVaultRegistry(cluster)[vaultId]
}
