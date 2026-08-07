import type { Address, Instruction, TransactionSigner } from "@solana/kit";

import {
  fetchMaybeBundle,
  fetchMaybeUserBundleAccount,
  findBundleTempDataPda,
  findOracleDataPda,
  findPendingBundleAssetAuthorityPda,
  findUserBundleAccountPda,
  getInitializeBundleDepositorInstructionAsync,
  getRequestDepositInstructionAsync,
  NTBUNDLE_PROGRAM_ADDRESS,
  type Bundle,
  type UserBundleAccount,
} from "../generated";
import { findAssociatedTokenPda } from "./ata";
import { assertValidAmountRaw } from "./math";
import type { ExtensionsRpc } from "./rpc";

export type BuildDepositInstructionsParams = {
  user: TransactionSigner;
  bundleAccount: Address;
  amountRaw: bigint;
  /** Defaults to the user's associated token account for the bundle's asset mint. */
  userTokenAccount?: Address;
  /** Defaults to NTBUNDLE_PROGRAM_ADDRESS. */
  programAddress?: Address;
};

export type DepositInstructionContext = {
  bundle: Bundle;
  userBundleAccount: Address;
  userBundle: UserBundleAccount | undefined;
  initializeInstruction: Instruction | undefined;
  requestInstruction: Instruction;
};

export async function buildDepositInstructionContext(
  rpc: ExtensionsRpc,
  params: BuildDepositInstructionsParams,
): Promise<DepositInstructionContext> {
  assertValidAmountRaw(params.amountRaw);
  const programAddress = params.programAddress ?? NTBUNDLE_PROGRAM_ADDRESS;

  const bundle = await fetchMaybeBundle(rpc, params.bundleAccount);
  if (!bundle.exists) {
    throw new Error("BUNDLE_ACCOUNT_NOT_FOUND");
  }

  const [userBundleAccount] = await findUserBundleAccountPda(
    {
      userBundleAccountOwner: params.user.address,
      bundleAccount: params.bundleAccount,
    },
    { programAddress },
  );
  const userBundle = await fetchMaybeUserBundleAccount(rpc, userBundleAccount);

  const userTokenAccount =
    params.userTokenAccount ??
    (
      await findAssociatedTokenPda({
        owner: params.user.address,
        mint: bundle.data.assetAddress,
      })
    )[0];
  const [pendingBundleAssetAuthorityPda, oracleDataPda, bundleTempDataPda] =
    await Promise.all([
      findPendingBundleAssetAuthorityPda(
        { bundleAccount: params.bundleAccount },
        { programAddress },
      ),
      findOracleDataPda(
        { bundleAccount: params.bundleAccount },
        { programAddress },
      ),
      findBundleTempDataPda(
        { bundleAccount: params.bundleAccount },
        { programAddress },
      ),
    ]);
  const [pendingDepositTokenAccount] = await findAssociatedTokenPda({
    owner: pendingBundleAssetAuthorityPda[0],
    mint: bundle.data.assetAddress,
  });

  const initializeInstruction = userBundle.exists
    ? undefined
    : await getInitializeBundleDepositorInstructionAsync(
        {
          payer: params.user,
          authority: params.user,
          bundleAccount: params.bundleAccount,
          userBundleAccount,
        },
        { programAddress },
      );
  const requestInstruction = await getRequestDepositInstructionAsync(
    {
      user: params.user,
      bundleAccount: params.bundleAccount,
      userTokenAccount,
      pendingDepositTokenAccount,
      treasuryAccount: bundle.data.treasuryAccount,
      assetAddress: bundle.data.assetAddress,
      userBundleAccount,
      oracleData: oracleDataPda[0],
      bundleTempData: bundleTempDataPda[0],
      pendingBundleAssetAuthority: pendingBundleAssetAuthorityPda[0],
      amount: params.amountRaw,
    },
    { programAddress },
  );

  return {
    bundle: bundle.data,
    userBundleAccount,
    userBundle: userBundle.exists ? userBundle.data : undefined,
    initializeInstruction,
    requestInstruction,
  };
}
