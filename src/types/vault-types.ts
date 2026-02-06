import type { Token } from './tokens'
import { z } from 'zod'
import {
  SupportedChain,
  SupportedToken,
  tokens,
} from './tokens'

export {
  SupportedChain,
  SupportedToken,
  tokens,
}
export type { Token }

export enum VaultType {
  Drift = 'Drift',
  Bundle = 'Bundle',
  Hyperliquid = 'Hyperliquid',
  Kamino = 'Kamino',
}

// =============================================================================
// REGISTRY TYPES (raw data from JSON, no program IDs)
// =============================================================================

/** Raw vault entry from registry JSON */
export interface VaultRegistryEntry {
  vaultId: number
  name: string
  subname?: string
  type: VaultType
  vaultAddress: string
  depositToken: SupportedToken
  pfee?: number
  /** Optional Drift program ID (only for Drift vaults with non-default program) */
  driftProgramId?: string
  /** Optional Bundle program ID (only for Bundle vaults with non-default V2 program) */
  bundleProgramId?: string
}

/** Zod schema for validating registry entries */
export const VaultRegistryEntrySchema = z.object({
  vaultId: z.number().int().min(0),
  name: z.string().min(1).max(100),
  subname: z.string().max(100).optional(),
  type: z.nativeEnum(VaultType),
  vaultAddress: z.string().min(32).max(44),
  depositToken: z.nativeEnum(SupportedToken),
  pfee: z.number().min(0).max(1).optional(),
  driftProgramId: z.string().min(32).max(44).optional(),
  bundleProgramId: z.string().min(32).max(44).optional(),
})

/** Schema for validating array of registry entries */
export const VaultRegistryArraySchema = z.array(VaultRegistryEntrySchema).superRefine(
  (vaults, ctx) => {
    const seen = new Set<number>()
    for (const vault of vaults) {
      if (seen.has(vault.vaultId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate vaultId: ${vault.vaultId}`,
        })
      }
      seen.add(vault.vaultId)
    }
  },
)

// =============================================================================
// CONFIG TYPES (transformed with required program IDs)
// =============================================================================

/** Vault config (same as registry entry, program IDs are optional) */
export interface VaultConfig extends VaultRegistryEntry {
  /** Required for Drift vaults */
  driftProgramId: string
  /** Required for Bundle vaults */
  bundleProgramId: string
}

/** Vault registry as a record keyed by vaultId */
export type VaultConfigRecord = Record<number, VaultConfig>
