import type {
  Bundle,
  OracleData,
  ReferrerAccount,
  ReferralTier,
  UserBundleAccount,
} from "../generated";

import {
  BPS_DENOMINATOR,
  SECONDS_IN_YEAR,
  sharePriceRaw,
  totalEquityRaw,
} from "./math";

/** Mirrors the onchain `FEE_OVERRIDE_DEPOSIT` flag. */
export const FEE_OVERRIDE_DEPOSIT = 1 << 0;

/** Mirrors the onchain `FEE_OVERRIDE_WITHDRAWAL` flag. */
export const FEE_OVERRIDE_WITHDRAWAL = 1 << 1;

/** Mirrors the onchain `FEE_OVERRIDE_PERFORMANCE` flag. */
export const FEE_OVERRIDE_PERFORMANCE = 1 << 2;

/** Mirrors the onchain `FEE_OVERRIDE_MANAGEMENT` flag. */
export const FEE_OVERRIDE_MANAGEMENT = 1 << 3;

/** Mirrors the onchain `REFERRAL_OVERRIDE_PFEE` flag. */
export const REFERRAL_OVERRIDE_PFEE = 1 << 0;

/** Mirrors the onchain `REFERRAL_OVERRIDE_MFEE` flag. */
export const REFERRAL_OVERRIDE_MFEE = 1 << 1;

/** Maximum number of entries accepted by `set_referral_tier_config`. */
export const MAX_REFERRAL_TIERS = 5;

/** Result shape from the onchain `resolve_effective_fees` function. */
export type EffectiveFees = {
  depositFeeBps: number;
  withdrawalFeeBps: number;
  performanceFeeBps: number;
  managementFeeBps: number;
};

export type EffectiveReferralRates = {
  referralPfeeBps: number;
  referralMfeeBps: number;
  referralTierIndex: number | undefined;
};

type BundleReferralRateConfig = Pick<Bundle, "referralTiers" | "tierCount">;

type ReferrerRateConfig = Pick<
  ReferrerAccount,
  "rateOverrideFlags" | "customPfeeBps" | "customMfeeBps"
> &
  Partial<Pick<ReferrerAccount, "referredNetDeposits">>;

/** Resolves the bundle schedule before applying any per-referrer override. */
export function resolveBundleReferralRates(
  bundle: BundleReferralRateConfig,
  referredNetDeposits: bigint,
): EffectiveReferralRates {
  const activeTierCount = Math.min(
    bundle.tierCount,
    bundle.referralTiers.length,
    MAX_REFERRAL_TIERS,
  );
  let resolvedRates: EffectiveReferralRates = {
    referralPfeeBps: 0,
    referralMfeeBps: 0,
    referralTierIndex: undefined,
  };
  for (let tierIndex = 0; tierIndex < activeTierCount; tierIndex += 1) {
    const referralTier = bundle.referralTiers[tierIndex];
    if (
      referralTier === undefined ||
      referredNetDeposits < referralTier.threshold
    ) {
      break;
    }
    resolvedRates = {
      referralPfeeBps: referralTier.pfeeBps,
      referralMfeeBps: referralTier.mfeeBps,
      referralTierIndex: tierIndex,
    };
  }

  return resolvedRates;
}

/**
 * Resolves the live rates used by fee settlement. An empty schedule resolves
 * to zero. A partial override replaces only its flagged component; a full
 * override bypasses the tier schedule.
 */
export function resolveEffectiveReferralRates(
  bundle: BundleReferralRateConfig,
  referrerAccount: ReferrerRateConfig | undefined,
): EffectiveReferralRates {
  if (
    referrerAccount !== undefined &&
    (referrerAccount.rateOverrideFlags &
      (REFERRAL_OVERRIDE_PFEE | REFERRAL_OVERRIDE_MFEE)) ===
      (REFERRAL_OVERRIDE_PFEE | REFERRAL_OVERRIDE_MFEE)
  ) {
    return {
      referralPfeeBps: referrerAccount.customPfeeBps,
      referralMfeeBps: referrerAccount.customMfeeBps,
      referralTierIndex: undefined,
    };
  }

  const bundleRates = resolveBundleReferralRates(
    bundle,
    referrerAccount?.referredNetDeposits ?? 0n,
  );
  const pfeeOverridden =
    referrerAccount !== undefined &&
    (referrerAccount.rateOverrideFlags & REFERRAL_OVERRIDE_PFEE) !== 0;
  const mfeeOverridden =
    referrerAccount !== undefined &&
    (referrerAccount.rateOverrideFlags & REFERRAL_OVERRIDE_MFEE) !== 0;

  return {
    referralPfeeBps: pfeeOverridden
      ? referrerAccount.customPfeeBps
      : bundleRates.referralPfeeBps,
    referralMfeeBps: mfeeOverridden
      ? referrerAccount.customMfeeBps
      : bundleRates.referralMfeeBps,
    referralTierIndex: bundleRates.referralTierIndex,
  };
}

/** Mirrors onchain `resolve_effective_fees`, including zero-valued overrides. */
export function resolveEffectiveFees(
  bundle: Pick<
    Bundle,
    "depositFee" | "withdrawalFee" | "performanceFee" | "managementFeeBps"
  >,
  user: Pick<
    UserBundleAccount,
    | "feeOverrideFlags"
    | "customDepositFeeBps"
    | "customWithdrawalFeeBps"
    | "customPerformanceFeeBps"
    | "customManagementFeeBps"
  >,
): EffectiveFees {
  return {
    depositFeeBps:
      user.feeOverrideFlags & FEE_OVERRIDE_DEPOSIT
        ? user.customDepositFeeBps
        : bundle.depositFee,
    withdrawalFeeBps:
      user.feeOverrideFlags & FEE_OVERRIDE_WITHDRAWAL
        ? user.customWithdrawalFeeBps
        : bundle.withdrawalFee,
    performanceFeeBps:
      user.feeOverrideFlags & FEE_OVERRIDE_PERFORMANCE
        ? user.customPerformanceFeeBps
        : bundle.performanceFee,
    managementFeeBps:
      user.feeOverrideFlags & FEE_OVERRIDE_MANAGEMENT
        ? user.customManagementFeeBps
        : bundle.managementFeeBps,
  };
}

/** Read-only estimate of the user-fee totals represented by `ChargedUserFees`. */
export type PendingFeeEstimate = {
  managementFeeShares: bigint;
  performanceFeeShares: bigint;
  totalFeeShares: bigint;
  feeValueRaw: bigint;
  sharePrice: bigint;
};

/**
 * Estimates the user-share deductions calculated by `charge_user_fees_at_time`.
 * Referral handling is omitted because it only divides the same deducted
 * shares between manager and referrer. If `assetPrecision` is zero, this helper
 * returns a zero fee value; onchain settlement rejects zero asset precision
 * during its value calculations.
 */
export function estimatePendingUserFees(args: {
  bundle: Pick<
    Bundle,
    | "depositFee"
    | "withdrawalFee"
    | "performanceFee"
    | "managementFeeBps"
    | "assetPrecision"
    | "bundleUnderlyingBalance"
    | "totalShares"
  >;
  oracleData: Pick<OracleData, "averageExternalEquity">;
  userBundle: Pick<
    UserBundleAccount,
    | "shares"
    | "hwmPerShare"
    | "lastManagementFeeTimestamp"
    | "feeOverrideFlags"
    | "customDepositFeeBps"
    | "customWithdrawalFeeBps"
    | "customPerformanceFeeBps"
    | "customManagementFeeBps"
  >;
  nowUnixSeconds: number | bigint;
}): PendingFeeEstimate {
  const totalAssets = totalEquityRaw({
    bundleUnderlyingBalance: args.bundle.bundleUnderlyingBalance,
    averageExternalEquity: args.oracleData.averageExternalEquity,
  });
  const sharePrice = sharePriceRaw({
    totalAssets,
    totalShares: args.bundle.totalShares,
    assetPrecision: args.bundle.assetPrecision,
  });
  const effectiveFees = resolveEffectiveFees(args.bundle, args.userBundle);

  let managementFeeShares = 0n;
  if (args.userBundle.lastManagementFeeTimestamp > 0n) {
    const nowUnixSeconds = BigInt(args.nowUnixSeconds);
    const elapsed = nowUnixSeconds - args.userBundle.lastManagementFeeTimestamp;
    const secondsElapsed = elapsed > 0n ? elapsed : 0n;
    managementFeeShares =
      (args.userBundle.shares *
        secondsElapsed *
        BigInt(effectiveFees.managementFeeBps)) /
      (SECONDS_IN_YEAR * BPS_DENOMINATOR);
  }

  const hwmValue =
    args.userBundle.hwmPerShare === 0n
      ? sharePrice
      : args.userBundle.hwmPerShare;
  let performanceFeeShares = 0n;
  if (sharePrice !== 0n && sharePrice > hwmValue) {
    performanceFeeShares =
      ((sharePrice - hwmValue) *
        args.userBundle.shares *
        BigInt(effectiveFees.performanceFeeBps)) /
      (sharePrice * BPS_DENOMINATOR);
  }

  managementFeeShares =
    managementFeeShares < args.userBundle.shares
      ? managementFeeShares
      : args.userBundle.shares;
  const remainingShares = args.userBundle.shares - managementFeeShares;
  performanceFeeShares =
    performanceFeeShares < remainingShares
      ? performanceFeeShares
      : remainingShares;
  const totalFeeShares = managementFeeShares + performanceFeeShares;
  const feeValueRaw =
    args.bundle.assetPrecision === 0n
      ? 0n
      : (totalFeeShares * sharePrice) / args.bundle.assetPrecision;

  return {
    managementFeeShares,
    performanceFeeShares,
    totalFeeShares,
    feeValueRaw,
    sharePrice,
  };
}
