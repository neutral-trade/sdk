import type { VaultConfig, VaultId } from '../types'
import { bundle_vaults } from './bundle-vaults'
import { drift_vaults } from './drift-vaults'

// =============================================================================
// COMBINED VAULTS
// =============================================================================

export const vaults: Partial<Record<VaultId, VaultConfig>> = {
  ...drift_vaults,
  ...bundle_vaults,
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function isValidVaultAddress(address: string): boolean {
  return Object.values(vaults)
    .filter((v): v is VaultConfig => v !== undefined)
    .map(vault => vault.vaultAddress)
    .includes(address)
}

export function getVaultByAddress(address: string): VaultConfig | undefined {
  return Object.values(vaults).find(v => v?.vaultAddress === address)
}

export function getVaultById(vaultId: VaultId): VaultConfig | undefined {
  return vaults[vaultId]
}
