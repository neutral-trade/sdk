// Bundle deposit / request-withdraw instruction builders (no wallet signing).

import type { Program } from '@coral-xyz/anchor'
import type { Program as Program32 } from '@coral-xyz/anchor-32'
import type { TransactionInstruction } from '@solana/web3.js'
import type { NtbundleV1 } from '../idl/bundle-v1'
import type { NtbundleV2 } from '../idl/bundle-v2'
import type { VaultRegistryEntry } from '../types/vault-types'
import { BN } from '@coral-xyz/anchor'
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { BundleProgramId } from '../constants/programs'
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
  bundleProgramV1: Program<NtbundleV1>
  bundleProgramV2: Program32<NtbundleV2>
  vault: VaultRegistryEntry
  user: PublicKey
  /** UI token amount (multiplied by 10**on-chain decimals inside). */
  amount: number
  needsInit?: boolean
}

export interface BuildBundleRequestWithdrawInstructionParams {
  bundleProgramV1: Program<NtbundleV1>
  bundleProgramV2: Program32<NtbundleV2>
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

function bundleProgramIdForVault(vault: VaultRegistryEntry): BundleProgramId {
  const id = getBundleProgramId(vault)
  if (!id) {
    throw new Error(`Vault ${vault.vaultId} has no Bundle program id`)
  }
  return id
}

/**
 * Optional `initializeBundleDepositor` + `requestDeposit`. Fetches bundle account internally.
 */
export async function buildBundleDepositInstructions({
  bundleProgramV1,
  bundleProgramV2,
  vault,
  user,
  amount,
  needsInit = false,
}: BuildBundleDepositInstructionsParams): Promise<TransactionInstruction[]> {
  assertBundleVault(vault)
  const bundlePDA = new PublicKey(vault.vaultAddress)
  const programId = bundleProgramIdForVault(vault)
  const isV2 = programId === BundleProgramId.V2

  const bundleInfo = isV2
    ? await bundleProgramV2.account.bundle.fetch(bundlePDA)
    : await bundleProgramV1.account.bundle.fetch(bundlePDA)

  const depositAmountBN = new BN(Math.floor(amount * 10 ** bundleInfo.assetDecimals))

  const programPk = isV2 ? bundleProgramV2.programId : bundleProgramV1.programId
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
    const initIx = isV2
      ? await bundleProgramV2.methods
          .initializeBundleDepositor()
          // Anchor 0.32 PartialAccounts omit const-address program ids; cast keeps runtime accounts identical to V1.
          .accounts({
            payer: user,
            authority: user,
            systemProgram: SystemProgram.programId,
            bundleAccount: bundlePDA,
            userBundleAccount: userPDA,
          } as never)
          .instruction()
      : await bundleProgramV1.methods
          .initializeBundleDepositor()
          .accounts({
            payer: user,
            authority: user,
            systemProgram: SystemProgram.programId,
            bundleAccount: bundlePDA,
            userBundleAccount: userPDA,
          })
          .instruction()
    instructions.push(initIx)
  }

  const depositIx = isV2
    ? await bundleProgramV2.methods
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
    : await bundleProgramV1.methods
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
        })
        .instruction()
  instructions.push(depositIx)
  return instructions
}

/**
 * `requestWithdrawal` only. Fetches bundle, oracle, and user bundle internally.
 */
export async function buildBundleRequestWithdrawInstruction({
  bundleProgramV1,
  bundleProgramV2,
  vault,
  user,
  amount,
}: BuildBundleRequestWithdrawInstructionParams): Promise<TransactionInstruction> {
  assertBundleVault(vault)
  const bundlePDA = new PublicKey(vault.vaultAddress)
  const programId = bundleProgramIdForVault(vault)
  const isV2 = programId === BundleProgramId.V2
  const programPk = isV2 ? bundleProgramV2.programId : bundleProgramV1.programId

  const oraclePDA = deriveOraclePDA(bundlePDA, programPk)
  const userPDA = deriveUserPDA(user, bundlePDA, programPk)
  const tempDataPDA = deriveTempDataPDA(bundlePDA, programPk)

  const [bundleAccount, oracleData, userBundle] = await Promise.all([
    isV2
      ? bundleProgramV2.account.bundle.fetch(bundlePDA)
      : bundleProgramV1.account.bundle.fetch(bundlePDA),
    isV2
      ? bundleProgramV2.account.oracleData.fetch(oraclePDA)
      : bundleProgramV1.account.oracleData.fetch(oraclePDA),
    isV2
      ? bundleProgramV2.account.userBundleAccount.fetch(userPDA)
      : bundleProgramV1.account.userBundleAccount.fetch(userPDA),
  ])

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

  return isV2
    ? await bundleProgramV2.methods
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
    : await bundleProgramV1.methods
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
        })
        .instruction()
}
