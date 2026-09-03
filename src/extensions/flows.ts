import type { Address, Instruction, TransactionSigner } from "@solana/kit";

import {
  fetchMaybeBundle,
  fetchMaybeOracleData,
  fetchMaybeUserBundleAccount,
  findBundleTempDataPda,
  findOracleDataPda,
  findUserBundleAccountPda,
  getInitializeBundleDepositorInstructionAsync,
  getRequestBundleSwitchInstructionAsync,
  getRequestWithdrawalInstructionAsync,
  NTBUNDLE_PROGRAM_ADDRESS,
} from "../generated";
import {
  buildDepositInstructionContext,
  type BuildDepositInstructionsParams,
} from "./deposit";
import {
  assertValidAmountRaw,
  computeWithdrawalShares,
  totalEquityRaw,
} from "./math";
import type { ExtensionsRpc } from "./rpc";

export type { BuildDepositInstructionsParams } from "./deposit";

/** Mirrors the legacy `buildBundleDepositInstructionsWithVault` flow. */
export async function buildDepositInstructions(
  rpc: ExtensionsRpc,
  params: BuildDepositInstructionsParams,
): Promise<Instruction[]> {
  const context = await buildDepositInstructionContext(rpc, params);
  const instructions: Array<Instruction> = [];
  if (context.initializeInstruction) {
    instructions.push(context.initializeInstruction);
  }
  instructions.push(context.requestInstruction);

  return instructions;
}

export type BuildRequestWithdrawInstructionParams = {
  user: TransactionSigner;
  bundleAccount: Address;
  amountRaw: bigint;
  programAddress?: Address;
};

/**
 * Mirrors the legacy `buildBundleRequestWithdrawInstructionWithVault` flow.
 * This helper rejects a zero-share result instead of forwarding it to the
 * program as the legacy helper did. Prepend an idempotent associated token
 * account create, using `buildEnsureAssociatedTokenAccountInstruction` or
 * `createAssociatedTokenAccountIdempotentInstruction`, so the user's asset
 * token account exists when the withdrawal is processed after its cooldown.
 */
export async function buildRequestWithdrawInstruction(
  rpc: ExtensionsRpc,
  params: BuildRequestWithdrawInstructionParams,
): Promise<Instruction> {
  assertValidAmountRaw(params.amountRaw);
  const programAddress = params.programAddress ?? NTBUNDLE_PROGRAM_ADDRESS;

  const [oracleDataPda, userBundleAccountPda, bundleTempDataPda] =
    await Promise.all([
      findOracleDataPda(
        { bundleAccount: params.bundleAccount },
        { programAddress },
      ),
      findUserBundleAccountPda(
        {
          userBundleAccountOwner: params.user.address,
          bundleAccount: params.bundleAccount,
        },
        { programAddress },
      ),
      findBundleTempDataPda(
        { bundleAccount: params.bundleAccount },
        { programAddress },
      ),
    ]);

  const [bundle, oracleData, userBundle] = await Promise.all([
    fetchMaybeBundle(rpc, params.bundleAccount),
    fetchMaybeOracleData(rpc, oracleDataPda[0]),
    fetchMaybeUserBundleAccount(rpc, userBundleAccountPda[0]),
  ]);
  if (!bundle.exists) {
    throw new Error("BUNDLE_ACCOUNT_NOT_FOUND");
  }
  if (!oracleData.exists) {
    throw new Error("ORACLE_DATA_NOT_FOUND");
  }
  if (!userBundle.exists) {
    throw new Error("USER_BUNDLE_ACCOUNT_NOT_FOUND");
  }

  const sharesAmount = computeWithdrawalShares({
    amountRaw: params.amountRaw,
    userShares: userBundle.data.shares,
    totalEquity: totalEquityRaw({
      bundleUnderlyingBalance: bundle.data.bundleUnderlyingBalance,
      averageExternalEquity: oracleData.data.averageExternalEquity,
    }),
    totalShares: bundle.data.totalShares,
  });
  if (sharesAmount === 0n) {
    throw new Error("ZERO_WITHDRAWAL_SHARES");
  }

  return await getRequestWithdrawalInstructionAsync(
    {
      user: params.user,
      bundleAccount: params.bundleAccount,
      userBundleAccount: userBundleAccountPda[0],
      oracleData: oracleDataPda[0],
      bundleTempData: bundleTempDataPda[0],
      sharesAmount,
    },
    { programAddress },
  );
}

export type BuildRequestSwitchInstructionsParams = {
  user: TransactionSigner;
  sourceBundleAccount: Address;
  targetBundleAccount: Address;
  amountRaw: bigint;
  programAddress?: Address;
};

/**
 * Mirrors the legacy `buildBundleRequestSwitchInstructionsWithVaults` flow.
 * This version-locked client does not perform the legacy runtime IDL capability
 * probe for `request_bundle_switch`. Before these instructions, add an
 * idempotent associated token account create using
 * `buildEnsureAssociatedTokenAccountInstruction` or
 * `createAssociatedTokenAccountIdempotentInstruction`. `processSwitch`
 * validates the user's asset token account and transfers the redemption there
 * if the target bundle cannot accept the switch.
 */
export async function buildRequestSwitchInstructions(
  rpc: ExtensionsRpc,
  params: BuildRequestSwitchInstructionsParams,
): Promise<Instruction[]> {
  assertValidAmountRaw(params.amountRaw);
  const programAddress = params.programAddress ?? NTBUNDLE_PROGRAM_ADDRESS;

  if (params.sourceBundleAccount === params.targetBundleAccount) {
    throw new Error("SOURCE_TARGET_IDENTICAL");
  }

  const [
    sourceOracleDataPda,
    sourceUserBundleAccountPda,
    sourceBundleTempDataPda,
    targetUserBundleAccountPda,
  ] = await Promise.all([
    findOracleDataPda(
      { bundleAccount: params.sourceBundleAccount },
      { programAddress },
    ),
    findUserBundleAccountPda(
      {
        userBundleAccountOwner: params.user.address,
        bundleAccount: params.sourceBundleAccount,
      },
      { programAddress },
    ),
    findBundleTempDataPda(
      { bundleAccount: params.sourceBundleAccount },
      { programAddress },
    ),
    findUserBundleAccountPda(
      {
        userBundleAccountOwner: params.user.address,
        bundleAccount: params.targetBundleAccount,
      },
      { programAddress },
    ),
  ]);

  const [
    sourceBundle,
    targetBundle,
    sourceOracleData,
    sourceUserBundle,
    targetUserBundle,
  ] = await Promise.all([
    fetchMaybeBundle(rpc, params.sourceBundleAccount),
    fetchMaybeBundle(rpc, params.targetBundleAccount),
    fetchMaybeOracleData(rpc, sourceOracleDataPda[0]),
    fetchMaybeUserBundleAccount(rpc, sourceUserBundleAccountPda[0]),
    fetchMaybeUserBundleAccount(rpc, targetUserBundleAccountPda[0]),
  ]);
  if (!sourceBundle.exists || !targetBundle.exists) {
    throw new Error("BUNDLE_ACCOUNT_NOT_FOUND");
  }
  if (!sourceOracleData.exists) {
    throw new Error("ORACLE_DATA_NOT_FOUND");
  }
  if (!sourceUserBundle.exists) {
    throw new Error("USER_BUNDLE_ACCOUNT_NOT_FOUND");
  }
  if (sourceBundle.data.assetAddress !== targetBundle.data.assetAddress) {
    throw new Error("ASSET_MINT_MISMATCH");
  }

  const sharesAmount = computeWithdrawalShares({
    amountRaw: params.amountRaw,
    userShares: sourceUserBundle.data.shares,
    totalEquity: totalEquityRaw({
      bundleUnderlyingBalance: sourceBundle.data.bundleUnderlyingBalance,
      averageExternalEquity: sourceOracleData.data.averageExternalEquity,
    }),
    totalShares: sourceBundle.data.totalShares,
  });
  if (sharesAmount === 0n) {
    throw new Error("ZERO_WITHDRAWAL_SHARES");
  }

  const instructions: Array<Instruction> = [];
  if (!targetUserBundle.exists) {
    instructions.push(
      await getInitializeBundleDepositorInstructionAsync(
        {
          payer: params.user,
          authority: params.user,
          bundleAccount: params.targetBundleAccount,
          userBundleAccount: targetUserBundleAccountPda[0],
        },
        { programAddress },
      ),
    );
  }

  instructions.push(
    await getRequestBundleSwitchInstructionAsync(
      {
        user: params.user,
        bundleAccount: params.sourceBundleAccount,
        userBundleAccount: sourceUserBundleAccountPda[0],
        oracleData: sourceOracleDataPda[0],
        bundleTempData: sourceBundleTempDataPda[0],
        targetBundleAccount: params.targetBundleAccount,
        targetUserBundleAccount: targetUserBundleAccountPda[0],
        sharesAmount,
      },
      { programAddress },
    ),
  );

  return instructions;
}
