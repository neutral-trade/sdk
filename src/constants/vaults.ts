import type { VaultConfig, VaultConfigRecord, VaultRegistryEntry } from '../types'
import { VAULT_PROGRAM_ID } from '@drift-labs/vaults-sdk'
import vaultsJson from '../registry/vaults.json'
import { VaultRegistryArraySchema } from '../types'
import { BundleProgramId } from './programs'

// =============================================================================
// PROGRAM ID HELPERS
// =============================================================================

/**
 * Get Bundle Program ID for a vault config
 * Uses registry value if present, otherwise defaults to V1
 */
export function getBundleProgramId(vault: VaultRegistryEntry): BundleProgramId {
  if (vault.bundleProgramId) {
    // Return as-is if it's already a valid BundleProgramId
    if (Object.values(BundleProgramId).includes(vault.bundleProgramId as BundleProgramId)) {
      return vault.bundleProgramId as BundleProgramId
    }
  }
  return BundleProgramId.V1
}

/**
 * Get Drift Program ID for a vault config as PublicKey
 * Uses registry value if present, otherwise defaults to VAULT_PROGRAM_ID
 */
export function getDriftProgramId(vault: VaultRegistryEntry): string {
  if (vault.driftProgramId) {
    return vault.driftProgramId
  }
  return VAULT_PROGRAM_ID.toBase58()
}

// =============================================================================
// TRANSFORMATION FUNCTIONS
// =============================================================================

/**
 * Transform a registry entry to VaultConfig with program IDs
 * - Drift vaults get driftProgramId
 * - Bundle vaults get bundleProgramId
 */
export function toVaultConfig(entry: VaultRegistryEntry): VaultConfig {
  return {
    ...entry,
    driftProgramId: getDriftProgramId(entry),
    bundleProgramId: getBundleProgramId(entry),
  }
}

/**
 * Transform an array of registry entries to VaultRegistry
 */
export function toVaultRegistry(entries: VaultRegistryEntry[]): VaultConfigRecord {
  return Object.fromEntries(
    entries.map(entry => [entry.vaultId, toVaultConfig(entry)]),
  )
}

// =============================================================================
// VAULT REGISTRY VALIDATION & TRANSFORMATION
// =============================================================================

// Validate and transform JSON array to Record<number, VaultConfig>
const parsedVaults = VaultRegistryArraySchema.parse(vaultsJson)

export const vaults: VaultConfigRecord = toVaultRegistry(parsedVaults)

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function isValidVaultAddress(address: string): boolean {
  return Object.values(vaults)
    .map(vault => vault.vaultAddress)
    .includes(address)
}

export function getVaultByAddress(address: string): VaultConfig | undefined {
  return Object.values(vaults).find(v => v.vaultAddress === address)
}

export function getVaultById(vaultId: number): VaultConfig | undefined {
  return vaults[vaultId]
}
