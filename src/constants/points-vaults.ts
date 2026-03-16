import type { VaultRegistry, VaultRegistryEntry, VaultType } from '../types'

/** Points-ready vault entry (no full Token - consumer resolves depositToken) */
export interface PointsVaultEntry {
  vaultId: number
  name: string
  address: string
  depositToken: string
  type: VaultType
  multiplier: number
  enabled: boolean
  bundleProgramId?: string
}

/**
 * Get vaults that earn points, filtered by pointsEnabled !== false.
 * Returns entries ready for points backend consumption.
 */
export function getPointsVaults(registry: VaultRegistry): PointsVaultEntry[] {
  return Object.values(registry)
    .filter(v => v.pointsEnabled !== false)
    .map(v => toPointsVaultEntry(v))
}

function toPointsVaultEntry(entry: VaultRegistryEntry): PointsVaultEntry {
  return {
    vaultId: entry.vaultId,
    name: entry.subname ? `${entry.name} -- ${entry.subname}` : entry.name,
    address: entry.vaultAddress,
    depositToken: entry.depositToken,
    type: entry.type,
    multiplier: entry.pointsMultiplier ?? 1,
    enabled: entry.pointsEnabled !== false,
    bundleProgramId: entry.bundleProgramId,
  }
}
