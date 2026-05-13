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
import { parseAmountRawToBigInt } from './amount-raw'
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
  /** Smallest token units (decimal string), same scale as SPL token `amount`. */
  amountRaw: string
}

export interface BuildBundleRequestWithdrawInstructionParams {
  bundleProgram: Program<Ntbundle>
  bundleCluster?: BundleCluster
  vault: VaultRegistryEntry
  user: PublicKey
  /** Smallest token units (decimal string) to request withdrawing. */
  amountRaw: string
}

/**
 * Shares to burn for `requestWithdrawal`, from integer token raw and on-chain totals.
 * Full position: pass `amountRaw >= userTokenRaw` where `userTokenRaw = (userShares * totalEquity) / totalShares`.
 */
export function computeRequestWithdrawalSharesFromAmountRaw({
  amountRaw,
  userShares,
  totalEquity,
  totalShares,
}: {
  amountRaw: bigint
  userShares: BN
  totalEquity: bigint
  totalShares: bigint
}): BN {
  const us = BigInt(userShares.toString())
  if (totalShares === 0n || us === 0n)
    return new BN(0)
  const userTokenRaw = (us * totalEquity) / totalShares
  if (amountRaw >= userTokenRaw)
    return userShares
  if (totalEquity === 0n)
    return new BN(0)
  const computedShares = (amountRaw * totalShares) / totalEquity
  const sharesBn = new BN(computedShares.toString())
  return sharesBn.gt(userShares) ? userShares : sharesBn
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
 * `initializeBundleDepositor` (when missing) + `requestDeposit`. Fetches bundle + user bundle internally.
 */
export async function buildBundleDepositInstructions({
  bundleProgram,
  bundleCluster = 'mainnet',
  vault,
  user,
  amountRaw,
}: BuildBundleDepositInstructionsParams): Promise<TransactionInstruction[]> {
  assertBundleVault(vault)
  const bundlePDA = new PublicKey(vault.vaultAddress)
  const programId = bundleProgramIdForVault(vault, bundleCluster)
  if (programId !== bundleProgram.programId.toBase58()) {
    throw new Error(
      `Vault ${vault.vaultId} program id mismatch: vault=${programId}, client=${bundleProgram.programId.toBase58()}`,
    )
  }

  const programPk = bundleProgram.programId
  const userPDA = deriveUserPDA(user, bundlePDA, programPk)

  const connection = bundleProgram.provider.connection
  const [bundleAcc, userBundleAcc] = await connection.getMultipleAccountsInfo([bundlePDA, userPDA])
  if (!bundleAcc?.data?.length) {
    throw new Error(`Bundle account not found for vault ${vault.vaultId}`)
  }
  const bundleInfo = bundleProgram.coder.accounts.decode('bundle', bundleAcc.data) as BundleAccount
  const existingUserBundle
    = userBundleAcc?.data?.length
      ? (bundleProgram.coder.accounts.decode(
          'userBundleAccount',
          userBundleAcc.data,
        ) as UserBundleAccount)
      : null
  const needsInit = existingUserBundle === null

  const depositAmountBn = new BN(parseAmountRawToBigInt(amountRaw).toString())

  const oraclePDA = deriveOraclePDA(bundlePDA, programPk)
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
    .requestDeposit(depositAmountBn)
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
  amountRaw,
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

  const totalEquity
    = BigInt(oracleData.averageExternalEquity.toString())
      + BigInt(bundleAccount.bundleUnderlyingBalance.toString())
  const totalShares = BigInt(bundleAccount.totalShares.toString())
  const amountRawBn = parseAmountRawToBigInt(amountRaw)

  const sharesAmount = computeRequestWithdrawalSharesFromAmountRaw({
    amountRaw: amountRawBn,
    userShares: new BN(userBundle.shares.toString()),
    totalEquity,
    totalShares,
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
