import type {
  Bundle,
  OracleData,
  ReferrerAccount,
  UserBundleAccount,
} from "../generated";

import {
  BPS_DENOMINATOR,
  SECONDS_IN_YEAR,
  sharePriceRaw,
  totalEquityRaw,
} from "./math";

/** Mirrors `FEE_OVERRIDE_DEPOSIT` in `constants.rs:15`. */
export const FEE_OVERRIDE_DEPOSIT = 1 << 0;

/** Mirrors `FEE_OVERRIDE_WITHDRAWAL` in `constants.rs:16`. */
export const FEE_OVERRIDE_WITHDRAWAL = 1 << 1;

/** Mirrors `FEE_OVERRIDE_PERFORMANCE` in `constants.rs:17`. */
export const FEE_OVERRIDE_PERFORMANCE = 1 << 2;

/** Mirrors `FEE_OVERRIDE_MANAGEMENT` in `constants.rs:18`. */
export const FEE_OVERRIDE_MANAGEMENT = 1 << 3;

/** Mirrors `REFERRAL_OVERRIDE_PFEE` in `constants.rs:41`. */
export const REFERRAL_OVERRIDE_PFEE = 1 << 0;

/** Mirrors `REFERRAL_OVERRIDE_MFEE` in `constants.rs:42`. */
export const REFERRAL_OVERRIDE_MFEE = 1 << 1;

/** Result shape from `resolve_effective_fees` at `bundle.rs:433-457`. */
export type EffectiveFees = {
  depositFeeBps: number;
  withdrawalFeeBps: number;
  performanceFeeBps: number;
  managementFeeBps: number;
};

export type EffectiveReferralRates = {
  referralPfeeBps: number;
  referralMfeeBps: number;
};

/**
 * Mirrors `resolve_effective_referral_rates` at `bundle.rs:879-896`.
 * An unregistered referrer has no overrides, so bundle defaults apply.
 */
export function resolveEffectiveReferralRates(
  bundle: Pick<Bundle, "referralPfeeBps" | "referralMfeeBps">,
  referrerAccount:
    | Pick<
        ReferrerAccount,
        "rateOverrideFlags" | "customPfeeBps" | "customMfeeBps"
      >
    | undefined,
): EffectiveReferralRates {
  return {
    referralPfeeBps:
      referrerAccount &&
      (referrerAccount.rateOverrideFlags & REFERRAL_OVERRIDE_PFEE) !== 0
        ? referrerAccount.customPfeeBps
        : bundle.referralPfeeBps,
    referralMfeeBps:
      referrerAccount &&
      (referrerAccount.rateOverrideFlags & REFERRAL_OVERRIDE_MFEE) !== 0
        ? referrerAccount.customMfeeBps
        : bundle.referralMfeeBps,
  };
}

/** Mirrors `resolve_effective_fees` at `bundle.rs:433-457`, including zero-valued overrides. */
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

/** Read-only result corresponding to `ChargedUserFees` returned at `bundle.rs:842-850`. */
export type PendingFeeEstimate = {
  managementFeeShares: bigint;
  performanceFeeShares: bigint;
  totalFeeShares: bigint;
  feeValueRaw: bigint;
  sharePrice: bigint;
};

/**
 * Estimates the user-share deductions in `charge_user_fees` at
 * `bundle.rs:653-851`. Referral handling at `bundle.rs:767-800` is omitted
 * because it only divides the same deducted shares between manager and
 * referrer. If `assetPrecision` is zero, this helper returns a zero fee value;
 * the Rust function reports a division error at `bundle.rs:829-834`.
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
