// Bundle deposit / request-withdraw instruction builders (built-in vault registry only).

import type { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js'
import type { BundleCluster } from '../constants/programs'
import type { VaultRegistryEntry } from '../types/vault-types'
import { createAnchorProvider } from '../constants/client'
import { assertAllowlistedBundleProgramId, createAllowlistedBundleProgram } from '../constants/programs'
import { getBundleProgramId, getVaultById } from '../constants/vaults'
import { VaultType } from '../types/vault-types'
import {
  buildBundleDepositInstructionsWithVault,
  buildBundleRequestWithdrawInstructionWithVault,
} from './bundle-instructions-core'

export { computeRequestWithdrawalSharesFromAmountRaw } from './request-withdraw-shares'

export interface BuildBundleDepositInstructionsParams {
  connection: Connection
  bundleCluster?: BundleCluster
  vaultId: number
  user: PublicKey
  /** Smallest token units (decimal string), same scale as SPL token `amount`. */
  amountRaw: string
}

export interface BuildBundleRequestWithdrawInstructionParams {
  connection: Connection
  bundleCluster?: BundleCluster
  vaultId: number
  user: PublicKey
  /** Smallest token units (decimal string) to request withdrawing. */
  amountRaw: string
}

function resolveTrustedBundleVault(
  vaultId: number,
  bundleCluster: BundleCluster,
): { vault: VaultRegistryEntry, programId: string } {
  const vault = getVaultById(vaultId, bundleCluster)
  if (!vault) {
    throw new Error(`Unknown vaultId ${vaultId} for cluster ${bundleCluster}`)
  }
  if (vault.type !== VaultType.Bundle) {
    throw new Error(`Vault ${vaultId} is not a Bundle vault`)
  }
  const programId = getBundleProgramId(vault, bundleCluster)
  if (!programId) {
    throw new Error(`Vault ${vaultId} has no Bundle program id`)
  }
  assertAllowlistedBundleProgramId(programId, bundleCluster)
  return { vault, programId }
}

/**
 * `initializeBundleDepositor` (when needed) + `requestDeposit` for a built-in registry vault.
 */
export async function buildBundleDepositInstructions({
  connection,
  bundleCluster = 'mainnet',
  vaultId,
  user,
  amountRaw,
}: BuildBundleDepositInstructionsParams): Promise<TransactionInstruction[]> {
  const { vault, programId } = resolveTrustedBundleVault(vaultId, bundleCluster)
  const provider = createAnchorProvider(connection)
  const bundleProgram = createAllowlistedBundleProgram(provider, programId, bundleCluster)
  return buildBundleDepositInstructionsWithVault({
    bundleProgram,
    bundleCluster,
    vault,
    user,
    amountRaw,
  })
}

/**
 * `requestWithdrawal` for a built-in registry vault.
 */
export async function buildBundleRequestWithdrawInstruction({
  connection,
  bundleCluster = 'mainnet',
  vaultId,
  user,
  amountRaw,
}: BuildBundleRequestWithdrawInstructionParams): Promise<TransactionInstruction> {
  const { vault, programId } = resolveTrustedBundleVault(vaultId, bundleCluster)
  const provider = createAnchorProvider(connection)
  const bundleProgram = createAllowlistedBundleProgram(provider, programId, bundleCluster)
  return buildBundleRequestWithdrawInstructionWithVault({
    bundleProgram,
    bundleCluster,
    vault,
    user,
    amountRaw,
  })
}
