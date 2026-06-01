import type { Connection, TransactionInstruction } from '@solana/web3.js'
import type { BundleCluster } from './constants/programs'
import type { NeutralTradeConfig } from './NeutralTrade'
import type {
  BuildBundleDepositInstructionsCoreParams,
  BuildBundleRequestWithdrawInstructionCoreParams,
} from './utils/bundle-instructions-core'
import { PublicKey } from '@solana/web3.js'
import { createAnchorProvider, createConnection } from './constants/client'
import { createAllowlistedBundleProgram } from './constants/programs'
import { getBundleProgramId, getVaultRegistry } from './constants/vaults'
import { VaultType } from './types'
import {
  buildBundleDepositInstructions,
  buildBundleRequestWithdrawInstruction,
} from './utils/bundle-instructions'
import {
  buildBundleDepositInstructionsWithVault,
  buildBundleRequestWithdrawInstructionWithVault,
} from './utils/bundle-instructions-core'
import { initializePrices } from './utils/price'

export type {
  BuildBundleDepositInstructionsCoreParams,
  BuildBundleRequestWithdrawInstructionCoreParams,
}

export {
  buildBundleDepositInstructionsWithVault,
  buildBundleRequestWithdrawInstructionWithVault,
}

export interface NeutralTradeCoreContext {
  connection: Connection
  bundlePrograms: Record<string, ReturnType<typeof createAllowlistedBundleProgram>>
  vaults: ReturnType<typeof getVaultRegistry>
  priceMap: Map<import('./types').SupportedToken, number>
}

export async function initNeutralTradeCore(config: NeutralTradeConfig): Promise<NeutralTradeCoreContext> {
  const connection = createConnection(config.rpcUrl)
  const provider = createAnchorProvider(connection)
  const cluster = config.bundleCluster ?? 'mainnet'
  const vaults = { ...getVaultRegistry(cluster) }

  const programIds = new Set<string>()
  for (const vault of Object.values(vaults)) {
    const programId = getBundleProgramId(vault, cluster)
    if (programId) {
      programIds.add(programId)
    }
  }

  const bundlePrograms: NeutralTradeCoreContext['bundlePrograms'] = {}
  for (const programId of programIds) {
    bundlePrograms[programId] = createAllowlistedBundleProgram(provider, programId, cluster)
  }

  const priceMap = await initializePrices(config.fallbackPrices)

  return {
    connection,
    bundlePrograms,
    vaults,
    priceMap,
  }
}

export async function buildDepositInstructionsForVaultId(
  core: NeutralTradeCoreContext,
  cluster: BundleCluster,
  params: { vaultId: number, userAddress: string, amountRaw: string },
): Promise<TransactionInstruction[]> {
  return buildBundleDepositInstructions({
    connection: core.connection,
    bundleCluster: cluster,
    vaultId: params.vaultId,
    user: new PublicKey(params.userAddress),
    amountRaw: params.amountRaw,
  })
}

export async function buildRequestWithdrawInstructionForVaultId(
  core: NeutralTradeCoreContext,
  cluster: BundleCluster,
  params: { vaultId: number, userAddress: string, amountRaw: string },
): Promise<TransactionInstruction> {
  return buildBundleRequestWithdrawInstruction({
    connection: core.connection,
    bundleCluster: cluster,
    vaultId: params.vaultId,
    user: new PublicKey(params.userAddress),
    amountRaw: params.amountRaw,
  })
}

export function getBundleProgramForVault(
  core: NeutralTradeCoreContext,
  vaultId: number,
  cluster: BundleCluster,
): ReturnType<typeof createAllowlistedBundleProgram> {
  const vault = core.vaults[vaultId]
  if (!vault) {
    throw new Error(`Vault config not found for vaultId ${vaultId}`)
  }
  if (vault.type !== VaultType.Bundle) {
    throw new Error(`Vault ${vaultId} is not a Bundle vault`)
  }
  const programId = getBundleProgramId(vault, cluster)
  if (!programId) {
    throw new Error(`Vault ${vaultId} has no Bundle program id`)
  }
  const bundleProgram = core.bundlePrograms[programId]
  if (!bundleProgram) {
    throw new Error(`Bundle program client not initialized for vault ${vaultId}: ${programId}`)
  }
  return bundleProgram
}
