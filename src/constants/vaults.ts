import type { VaultConfig, VaultConfigRecord, VaultRegistryEntry } from '../types'
import { VAULT_PROGRAM_ID } from '@drift-labs/vaults-sdk'
import { PublicKey } from '@solana/web3.js'
import vaultsJson from '../registry/vaults.json'
import { VaultRegistryArraySchema, VaultType } from '../types'
import { BundleProgramId } from './programs'

// =============================================================================
// PROGRAM ID CONSTANTS
// =============================================================================

/** Special Drift Program ID for jlpdnv1 (vaultId: 0) */
const JLPDNV1_DRIFT_PROGRAM_ID = '9Fcn3Fd4d5ocrb12xCUtEvezxcjFEAyHBPfrZDiPt9Qj'

/** V2 Bundle vault IDs */
const V2_BUNDLE_VAULT_IDS = [69, 72] // jlpdnjupiter, ctamomentumatlas

/**
 * Get Bundle Program ID for a vault
 * All bundle vaults use V1 except vaultId 69 and 72 which use V2
 */
export function getBundleProgramId(vaultId: number): BundleProgramId {
  if (V2_BUNDLE_VAULT_IDS.includes(vaultId)) {
    return BundleProgramId.V2
  }
  return BundleProgramId.V1
}

/**
 * Get Drift Program ID for a vault
 * All drift vaults use default program ID except vaultId 0
 */
export function getDriftProgramPK(vaultId: number): PublicKey {
  if (vaultId === 0) {
    return new PublicKey(JLPDNV1_DRIFT_PROGRAM_ID)
  }
  return VAULT_PROGRAM_ID
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
    driftProgramId: entry.type === VaultType.Drift
      ? getDriftProgramPK(entry.vaultId).toBase58()
      : undefined,
    bundleProgramId: entry.type === VaultType.Bundle
      ? getBundleProgramId(entry.vaultId)
      : undefined,
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
