import type { Address } from "@solana/kit";

import {
  fetchAllMaybeBundle,
  fetchAllMaybeOracleData,
  fetchAllMaybeUserBundleAccount,
  findOracleDataPda,
  findUserBundleAccountPda,
  NTBUNDLE_PROGRAM_ADDRESS,
  type Bundle,
  type OracleData,
  type UserBundleAccount,
} from "../generated";
import { estimatePendingUserFees, type PendingFeeEstimate } from "./fees";
import { calculateAssetsFromShares, totalEquityRaw } from "./math";
import type { ExtensionsRpc } from "./rpc";

export type UserBundleBalance = {
  bundleAccount: Address;
  user: Address;
  sharesRaw: bigint;
  /** Current redeemable value of the shares in token smallest units (integer floor, mirrors onchain calculate_assets_from_shares). */
  balanceRaw: bigint;
  /** Signed (i128 onchain): lifetime deposits minus withdrawals. */
  netDepositsRaw: bigint;
  /** balanceRaw - netDepositsRaw (signed). */
  earningsRaw: bigint;
  pendingDepositRaw: bigint;
  /** userBundle.totalFeeCharged. */
  feesPaidRaw: bigint;
  pendingFees: PendingFeeEstimate;
  hwmPerShare: bigint;
  totalEquityRaw: bigint;
  totalShares: bigint;
  assetPrecision: bigint;
  assetDecimals: number;
  assetAddress: Address;
};

/**
 * Calculates the raw balance fields returned by the legacy SDK's
 * `calculateBundleUserBalance`. The legacy helper used floating-point PPS and
 * `Math.round`; this helper uses the exact integer floor from
 * `calculate_assets_from_shares` at `bundle.rs:259-270`.
 */
export function computeUserBundleBalance(args: {
  bundleAccount: Address;
  user: Address;
  bundle: Bundle;
  oracleData: OracleData;
  userBundle: UserBundleAccount;
  nowUnixSeconds: number | bigint;
}): UserBundleBalance {
  const totalEquity = totalEquityRaw({
    bundleUnderlyingBalance: args.bundle.bundleUnderlyingBalance,
    averageExternalEquity: args.oracleData.averageExternalEquity,
  });
  const balanceRaw = calculateAssetsFromShares({
    shares: args.userBundle.shares,
    totalAssets: totalEquity,
    totalShares: args.bundle.totalShares,
  });

  return {
    bundleAccount: args.bundleAccount,
    user: args.user,
    sharesRaw: args.userBundle.shares,
    balanceRaw,
    netDepositsRaw: args.userBundle.netDeposits,
    earningsRaw: balanceRaw - args.userBundle.netDeposits,
    pendingDepositRaw: args.userBundle.pendingDeposit,
    feesPaidRaw: args.userBundle.totalFeeCharged,
    pendingFees: estimatePendingUserFees({
      bundle: args.bundle,
      oracleData: args.oracleData,
      userBundle: args.userBundle,
      nowUnixSeconds: args.nowUnixSeconds,
    }),
    hwmPerShare: args.userBundle.hwmPerShare,
    totalEquityRaw: totalEquity,
    totalShares: args.bundle.totalShares,
    assetPrecision: args.bundle.assetPrecision,
    assetDecimals: args.bundle.assetDecimals,
    assetAddress: args.bundle.assetAddress,
  };
}

/**
 * Mirrors the three aligned `fetchMultiple` batches in the legacy SDK's
 * `getBundleBalances`. Duplicate addresses remain in every request array so
 * each output index corresponds directly to its input request.
 */
export async function fetchUserBundleBalances(
  rpc: ExtensionsRpc,
  args: {
    requests: ReadonlyArray<{ bundleAccount: Address; user: Address }>;
    programAddress?: Address;
    nowUnixSeconds?: number | bigint;
  },
): Promise<Array<UserBundleBalance | null>> {
  const programAddress = args.programAddress ?? NTBUNDLE_PROGRAM_ADDRESS;
  const derivedAddresses = await Promise.all(
    args.requests.map(async (request) => {
      const [[oraclePda], [userPda]] = await Promise.all([
        findOracleDataPda(
          { bundleAccount: request.bundleAccount },
          { programAddress },
        ),
        findUserBundleAccountPda(
          {
            userBundleAccountOwner: request.user,
            bundleAccount: request.bundleAccount,
          },
          { programAddress },
        ),
      ]);
      return { oraclePda, userPda };
    }),
  );
  const bundleAddresses = args.requests.map((request) => request.bundleAccount);
  const oraclePdas = derivedAddresses.map(({ oraclePda }) => oraclePda);
  const userPdas = derivedAddresses.map(({ userPda }) => userPda);

  const [bundles, oracleDataAccounts, userBundles] = await Promise.all([
    fetchAllMaybeBundle(rpc, bundleAddresses),
    fetchAllMaybeOracleData(rpc, oraclePdas),
    fetchAllMaybeUserBundleAccount(rpc, userPdas),
  ]);
  const nowUnixSeconds = args.nowUnixSeconds ?? Math.floor(Date.now() / 1_000);

  return args.requests.map((request, index) => {
    const bundle = bundles[index];
    const oracleData = oracleDataAccounts[index];
    const userBundle = userBundles[index];
    if (!bundle.exists || !oracleData.exists || !userBundle.exists) {
      return null;
    }

    return computeUserBundleBalance({
      bundleAccount: request.bundleAccount,
      user: request.user,
      bundle: bundle.data,
      oracleData: oracleData.data,
      userBundle: userBundle.data,
      nowUnixSeconds,
    });
  });
}

export async function fetchUserBundleBalance(
  rpc: ExtensionsRpc,
  args: {
    bundleAccount: Address;
    user: Address;
    programAddress?: Address;
    nowUnixSeconds?: number | bigint;
  },
): Promise<UserBundleBalance | null> {
  const [balance] = await fetchUserBundleBalances(rpc, {
    requests: [{ bundleAccount: args.bundleAccount, user: args.user }],
    programAddress: args.programAddress,
    nowUnixSeconds: args.nowUnixSeconds,
  });
  return balance;
}
