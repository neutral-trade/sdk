import type { VaultRegistryEntry } from '../src/types/vault-types'
import { z } from 'zod'
import { DEFAULT_BUNDLE_PROGRAM_ID_MAINNET } from '../src/constants/programs'
import {
  ETHEREUM_CHAIN_ID,
  MONAD_CHAIN_ID,
  MONAD_TESTNET_CHAIN_ID,
  ROBINHOOD_CHAIN_ID,
} from '../src/types/tokens'
import {
  SupportedChain,
  SupportedToken,
  VaultCategory,
  VaultRegistryEntrySchema,
  VaultType,
} from '../src/types/vault-types'

/** Only the /v2/vaults fields the sync reads; everything else is stripped. */
const indexerVaultSchema = z.object({
  legacyVaultId: z.number().int().nonnegative().nullable(),
  name: z.string().nullable(),
  category: z.string().nullable(),
  chain: z.string(),
  bundleKey: z.string(),
  programId: z.string(),
  ntMultiplier: z.number().positive().nullable(),
  asset: z.object({ symbol: z.string().nullable() }),
  evm: z.object({
    strategy: z.string(),
    accountableLoanId: z.number().int().nonnegative().nullable(),
  }).optional(),
})

export type IndexerVault = z.infer<typeof indexerVaultSchema>

const indexerResponseSchema = z.object({
  data: z.object({ vaults: z.array(indexerVaultSchema) }),
})

/** Validates a raw /v2/vaults response body and returns its vault rows. */
export function parseIndexerVaults(body: unknown): IndexerVault[] {
  return indexerResponseSchema.parse(body).data.vaults
}

const EVM_CHAINS: Record<number, SupportedChain> = {
  [ETHEREUM_CHAIN_ID]: SupportedChain.Ethereum,
  [MONAD_CHAIN_ID]: SupportedChain.Monad,
  [ROBINHOOD_CHAIN_ID]: SupportedChain.Robinhood,
  [MONAD_TESTNET_CHAIN_ID]: SupportedChain.MonadTestnet,
}

function toToken(symbol: string | null): SupportedToken | undefined {
  const token = symbol === 'WSOL' ? 'SOL' : symbol
  return Object.values(SupportedToken).find(value => value === token)
}

function toCategory(key: string | null): VaultCategory | undefined {
  return key !== null && Object.hasOwn(VaultCategory, key)
    ? VaultCategory[key as keyof typeof VaultCategory]
    : undefined
}

function sameAddress(a: string, b: string): boolean {
  // EVM addresses may differ only in checksum casing.
  return a.startsWith('0x') ? a.toLowerCase() === b.toLowerCase() : a === b
}

/** Mutates an existing entry in place, touching only indexer-owned fields that actually changed. */
function updateEntry(entry: VaultRegistryEntry, row: IndexerVault): void {
  if (!sameAddress(entry.vaultAddress, row.bundleKey))
    entry.vaultAddress = row.bundleKey

  const token = toToken(row.asset.symbol)
  if (token && token !== entry.depositToken)
    entry.depositToken = token

  if (row.chain === 'solana' && row.programId !== (entry.bundleProgramId ?? DEFAULT_BUNDLE_PROGRAM_ID_MAINNET)) {
    if (row.programId === DEFAULT_BUNDLE_PROGRAM_ID_MAINNET)
      delete entry.bundleProgramId
    else
      entry.bundleProgramId = row.programId
  }

  if (row.ntMultiplier !== null && row.ntMultiplier !== (entry.pointsMultiplier ?? 1))
    entry.pointsMultiplier = row.ntMultiplier
}

/** Builds a registry entry for a vault the SDK does not know yet, or undefined when the row cannot form a valid one. */
function newEntry(vaultId: number, row: IndexerVault): VaultRegistryEntry | undefined {
  const category = toCategory(row.category)
  const depositToken = toToken(row.asset.symbol)
  if (row.name === null || !category || !depositToken)
    return undefined

  const points = {
    ...(row.ntMultiplier !== null && { pointsMultiplier: row.ntMultiplier }),
    // Points are opt-in after human review of the sync PR.
    pointsEnabled: false,
  }

  let entry: VaultRegistryEntry
  if (row.chain === 'solana') {
    entry = {
      vaultId,
      name: row.name,
      type: VaultType.Bundle,
      category,
      vaultAddress: row.bundleKey,
      depositToken,
      ...(row.programId !== DEFAULT_BUNDLE_PROGRAM_ID_MAINNET && { bundleProgramId: row.programId }),
      ...points,
    }
  }
  else {
    const chain = EVM_CHAINS[Number(row.chain.replace(/^evm:/, ''))]
    if (!chain || !row.evm)
      return undefined
    entry = {
      vaultId,
      name: row.name,
      type: VaultType.AccountableNav,
      category,
      chain,
      vaultAddress: row.bundleKey,
      strategyAddress: row.evm.strategy,
      ...(row.evm.accountableLoanId !== null && { accountableLoanId: row.evm.accountableLoanId }),
      depositToken,
      ...points,
    }
  }
  return VaultRegistryEntrySchema.safeParse(entry).success ? entry : undefined
}

/**
 * Upserts indexer /v2/vaults rows into the mainnet registry, keyed by legacyVaultId.
 * Registry entries the indexer does not list are left untouched; an in-sync
 * registry comes back deep-equal (and byte-identical once serialized).
 */
export function syncVaultRegistry(rows: IndexerVault[], registry: VaultRegistryEntry[]): VaultRegistryEntry[] {
  const result = structuredClone(registry)
  const byId = new Map(result.map(entry => [entry.vaultId, entry]))

  for (const row of rows) {
    if (row.legacyVaultId === null)
      continue
    const existing = byId.get(row.legacyVaultId)
    if (existing) {
      updateEntry(existing, row)
      continue
    }
    const created = newEntry(row.legacyVaultId, row)
    if (created) {
      result.push(created)
      byId.set(created.vaultId, created)
    }
  }

  return result.sort((a, b) => b.vaultId - a.vaultId)
}
