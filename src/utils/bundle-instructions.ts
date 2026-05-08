// Bundle deposit / request-withdraw instruction builders (no wallet signing).

import type { Program } from '@coral-xyz/anchor'
import type { TransactionInstruction } from '@solana/web3.js'
import type { BundleCluster } from '../constants/programs'
import type { Ntbundle } from '../idl/ntbundle'
import type { BundleAccount, OracleData, UserBundleAccount } from '../types/bundle-types'
import type { VaultRegistryEntry } from '../types/vault-types'
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import BN from 'bn.js'
import { getBundleProgramId } from '../constants/vaults'
import { VaultType } from '../types/vault-types'
import { calculateOnChainPps } from './bundle'
import {
  deriveOraclePDA,
  derivePendingAuthPDA,
  deriveTempDataPDA,
  deriveUserPDA,
} from './pda'

export interface BuildBundleDepositInstructionsParams {
  bundleProgram: Program<Ntbundle>
  bundleCluster?: BundleCluster
  vault: VaultRegistryEntry
  user: PublicKey
  /** UI token amount (multiplied by 10**on-chain decimals inside). */
  amount: number
  needsInit?: boolean
}

export interface BuildBundleRequestWithdrawInstructionParams {
  bundleProgram: Program<Ntbundle>
  bundleCluster?: BundleCluster
  vault: VaultRegistryEntry
  user: PublicKey
  amount: number
}

/** Same share math as legacy app `useBundleRequestWithdrawMutation`. */
export function computeRequestWithdrawalSharesAmount({
  amount,
  userVaultBalance,
  pps,
  assetDecimals,
  userShares,
}: {
  amount: number
  userVaultBalance: number
  pps: number
  assetDecimals: number
  userShares: BN
}): BN {
  let sharesAmount: BN
  if (Number(amount) >= Number(userVaultBalance)) {
    sharesAmount = userShares
  }
  else {
    sharesAmount = new BN(Math.floor((amount * 10 ** assetDecimals) / pps))
  }
  return sharesAmount.lte(userShares) ? sharesAmount : userShares
}

function assertBundleVault(vault: VaultRegistryEntry): void {
  if (vault.type !== VaultType.Bundle) {
    throw new Error(`Vault ${vault.vaultId} is not a Bundle vault`)
  }
}

function bundleProgramIdForVault(vault: VaultRegistryEntry, bundleCluster: BundleCluster = 'mainnet'): string {
  const id = getBundleProgramId(vault, bundleCluster)
  if (!id) {
    throw new Error(`Vault ${vault.vaultId} has no Bundle program id`)
  }
  return id
}

/**
 * Optional `initializeBundleDepositor` + `requestDeposit`. Fetches bundle account internally.
 */
export async function buildBundleDepositInstructions({
  bundleProgram,
  bundleCluster = 'mainnet',
  vault,
  user,
  amount,
  needsInit = false,
}: BuildBundleDepositInstructionsParams): Promise<TransactionInstruction[]> {
  assertBundleVault(vault)
  const bundlePDA = new PublicKey(vault.vaultAddress)
  const programId = bundleProgramIdForVault(vault, bundleCluster)
  if (programId !== bundleProgram.programId.toBase58()) {
    throw new Error(
      `Vault ${vault.vaultId} program id mismatch: vault=${programId}, client=${bundleProgram.programId.toBase58()}`,
    )
  }

  const bundleInfo = await bundleProgram.account.bundle.fetch(bundlePDA)

  const depositAmountBN = new BN(Math.floor(amount * 10 ** bundleInfo.assetDecimals))

  const programPk = bundleProgram.programId
  const oraclePDA = deriveOraclePDA(bundlePDA, programPk)
  const userPDA = deriveUserPDA(user, bundlePDA, programPk)
  const tempDataPDA = deriveTempDataPDA(bundlePDA, programPk)
  const pendingAuthPDA = derivePendingAuthPDA(bundlePDA, programPk)

  const userTokenAcct = getAssociatedTokenAddressSync(
    bundleInfo.assetAddress,
    user,
    true,
  )
  const pendingTokenAcct = getAssociatedTokenAddressSync(
    bundleInfo.assetAddress,
    pendingAuthPDA,
    true,
  )

  const instructions: TransactionInstruction[] = []

  if (needsInit) {
    const initIx = await bundleProgram.methods
      .initializeBundleDepositor()
      .accounts({
        payer: user,
        authority: user,
        systemProgram: SystemProgram.programId,
        bundleAccount: bundlePDA,
        userBundleAccount: userPDA,
      } as never)
      .instruction()
    instructions.push(initIx)
  }

  const depositIx = await bundleProgram.methods
    .requestDeposit(depositAmountBN)
    .accounts({
      user,
      userTokenAccount: userTokenAcct,
      pendingDepositTokenAccount: pendingTokenAcct,
      treasuryAccount: bundleInfo.treasuryAccount,
      userBundleAccount: userPDA,
      assetAddress: bundleInfo.assetAddress,
      oracleData: oraclePDA,
      bundleTempData: tempDataPDA,
      bundleAccount: bundlePDA,
      pendingBundleAssetAuthority: pendingAuthPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as never)
    .instruction()
  instructions.push(depositIx)
  return instructions
}

/**
 * `requestWithdrawal` only. Fetches bundle, oracle, and user bundle internally.
 */
export async function buildBundleRequestWithdrawInstruction({
  bundleProgram,
  bundleCluster = 'mainnet',
  vault,
  user,
  amount,
}: BuildBundleRequestWithdrawInstructionParams): Promise<TransactionInstruction> {
  assertBundleVault(vault)
  const bundlePDA = new PublicKey(vault.vaultAddress)
  const programId = bundleProgramIdForVault(vault, bundleCluster)
  if (programId !== bundleProgram.programId.toBase58()) {
    throw new Error(
      `Vault ${vault.vaultId} program id mismatch: vault=${programId}, client=${bundleProgram.programId.toBase58()}`,
    )
  }
  const programPk = bundleProgram.programId

  const oraclePDA = deriveOraclePDA(bundlePDA, programPk)
  const userPDA = deriveUserPDA(user, bundlePDA, programPk)
  const tempDataPDA = deriveTempDataPDA(bundlePDA, programPk)

  const [bundleAccount, oracleData, userBundle] = await Promise.all([
    bundleProgram.account.bundle.fetch(bundlePDA),
    bundleProgram.account.oracleData.fetch(oraclePDA),
    bundleProgram.account.userBundleAccount.fetch(userPDA),
  ]) as [BundleAccount, OracleData, UserBundleAccount]

  const pps = calculateOnChainPps({
    oracleAverageExternalEquity: BigInt(oracleData.averageExternalEquity.toString()),
    bundleUnderlyingBalance: BigInt(bundleAccount.bundleUnderlyingBalance.toString()),
    totalShares: BigInt(bundleAccount.totalShares.toString()),
  })

  const divisor = 10 ** bundleAccount.assetDecimals
  const userSharesNum = Number(userBundle.shares.toString())
  const userVaultBalance = Math.round(userSharesNum * pps) / divisor

  const sharesAmount = computeRequestWithdrawalSharesAmount({
    amount,
    userVaultBalance,
    pps,
    assetDecimals: bundleAccount.assetDecimals,
    userShares: new BN(userBundle.shares.toString()),
  })

  return await bundleProgram.methods
    .requestWithdrawal(sharesAmount)
    .accounts({
      user,
      userBundleAccount: userPDA,
      bundleAccount: bundlePDA,
      oracleData: oraclePDA,
      bundleTempData: tempDataPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as never)
    .instruction()
}
