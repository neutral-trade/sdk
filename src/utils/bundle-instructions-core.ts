// Internal bundle deposit / request-withdraw instruction builders (vault + program supplied by caller).
// Public integrators should use buildBundleDepositInstructions / buildBundleRequestWithdrawInstruction (vaultId-only).

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
import { computeRequestWithdrawalSharesFromAmountRaw } from './request-withdraw-shares'

export interface BuildBundleDepositInstructionsCoreParams {
  bundleProgram: Program<Ntbundle>
  bundleCluster?: BundleCluster
  vault: VaultRegistryEntry
  user: PublicKey
  /** Smallest token units (decimal string), same scale as SPL token `amount`. */
  amountRaw: string
}

export interface BuildBundleRequestWithdrawInstructionCoreParams {
  bundleProgram: Program<Ntbundle>
  bundleCluster?: BundleCluster
  vault: VaultRegistryEntry
  user: PublicKey
  /** Smallest token units (decimal string) to request withdrawing. */
  amountRaw: string
}

export interface BuildBundleRequestSwitchInstructionCoreParams {
  bundleProgram: Program<Ntbundle>
  bundleCluster?: BundleCluster
  sourceVault: VaultRegistryEntry
  targetVault: VaultRegistryEntry
  user: PublicKey
  /** Smallest token units (decimal string) to switch out of the source vault. */
  amountRaw: string
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
 * @internal
 */
export async function buildBundleDepositInstructionsWithVault({
  bundleProgram,
  bundleCluster = 'mainnet',
  vault,
  user,
  amountRaw,
}: BuildBundleDepositInstructionsCoreParams): Promise<TransactionInstruction[]> {
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
 * @internal
 */
export async function buildBundleRequestWithdrawInstructionWithVault({
  bundleProgram,
  bundleCluster = 'mainnet',
  vault,
  user,
  amountRaw,
}: BuildBundleRequestWithdrawInstructionCoreParams): Promise<TransactionInstruction> {
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

function assertSwitchVaultPair(
  sourceVault: VaultRegistryEntry,
  targetVault: VaultRegistryEntry,
  bundleCluster: BundleCluster,
): void {
  assertBundleVault(sourceVault)
  assertBundleVault(targetVault)

  if (sourceVault.vaultId === targetVault.vaultId) {
    throw new Error('Source and target vault must differ')
  }
  if (sourceVault.vaultAddress === targetVault.vaultAddress) {
    throw new Error('Source and target bundle must differ')
  }
  if (sourceVault.depositToken !== targetVault.depositToken) {
    throw new Error(
      `Switch requires the same deposit token: source=${sourceVault.depositToken}, target=${targetVault.depositToken}`,
    )
  }

  const sourceProgramId = bundleProgramIdForVault(sourceVault, bundleCluster)
  const targetProgramId = bundleProgramIdForVault(targetVault, bundleCluster)
  if (sourceProgramId !== targetProgramId) {
    throw new Error('Source and target vault must use the same bundle program')
  }
}

/**
 * `requestBundleSwitch` only. Fetches source bundle, oracle, user bundle, and target bundle internally.
 * @internal
 */
export async function buildBundleRequestSwitchInstructionWithVault({
  bundleProgram,
  bundleCluster = 'mainnet',
  sourceVault,
  targetVault,
  user,
  amountRaw,
}: BuildBundleRequestSwitchInstructionCoreParams): Promise<TransactionInstruction> {
  assertSwitchVaultPair(sourceVault, targetVault, bundleCluster)

  const sourceBundlePDA = new PublicKey(sourceVault.vaultAddress)
  const targetBundlePDA = new PublicKey(targetVault.vaultAddress)
  const programId = bundleProgramIdForVault(sourceVault, bundleCluster)
  if (programId !== bundleProgram.programId.toBase58()) {
    throw new Error(
      `Vault ${sourceVault.vaultId} program id mismatch: vault=${programId}, client=${bundleProgram.programId.toBase58()}`,
    )
  }
  const programPk = bundleProgram.programId

  const oraclePDA = deriveOraclePDA(sourceBundlePDA, programPk)
  const userPDA = deriveUserPDA(user, sourceBundlePDA, programPk)
  const tempDataPDA = deriveTempDataPDA(sourceBundlePDA, programPk)
  const targetUserPDA = deriveUserPDA(user, targetBundlePDA, programPk)

  const [sourceBundleAccount, oracleData, userBundle, targetBundleAccount] = await Promise.all([
    bundleProgram.account.bundle.fetch(sourceBundlePDA),
    bundleProgram.account.oracleData.fetch(oraclePDA),
    bundleProgram.account.userBundleAccount.fetch(userPDA),
    bundleProgram.account.bundle.fetch(targetBundlePDA),
  ]) as [BundleAccount, OracleData, UserBundleAccount, BundleAccount]

  if (sourceBundleAccount.assetAddress.toBase58() !== targetBundleAccount.assetAddress.toBase58()) {
    throw new Error('Switch requires the same asset mint on-chain')
  }

  const totalEquity
    = BigInt(oracleData.averageExternalEquity.toString())
      + BigInt(sourceBundleAccount.bundleUnderlyingBalance.toString())
  const totalShares = BigInt(sourceBundleAccount.totalShares.toString())
  const amountRawBn = parseAmountRawToBigInt(amountRaw)

  const sharesAmount = computeRequestWithdrawalSharesFromAmountRaw({
    amountRaw: amountRawBn,
    userShares: new BN(userBundle.shares.toString()),
    totalEquity,
    totalShares,
  })

  return await bundleProgram.methods
    .requestBundleSwitch(sharesAmount)
    .accounts({
      withdrawalRequest: {
        user,
        userBundleAccount: userPDA,
        bundleAccount: sourceBundlePDA,
        oracleData: oraclePDA,
        bundleTempData: tempDataPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      },
      targetBundleAccount: targetBundlePDA,
      targetUserBundleAccount: targetUserPDA,
    } as never)
    .instruction()
}
