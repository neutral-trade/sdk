import { expect } from "chai";

import {
  FEE_OVERRIDE_DEPOSIT,
  FEE_OVERRIDE_MANAGEMENT,
  FEE_OVERRIDE_PERFORMANCE,
  FEE_OVERRIDE_WITHDRAWAL,
  REFERRAL_OVERRIDE_MFEE,
  REFERRAL_OVERRIDE_PFEE,
  estimatePendingUserFees,
  resolveBundleReferralRates,
  resolveEffectiveFees,
  resolveEffectiveReferralRates,
} from "../../src/extensions/fees";

const defaultFees = {
  depositFee: 100,
  withdrawalFee: 200,
  performanceFee: 2_000,
  managementFeeBps: 500,
};

const defaultUserOverrides = {
  feeOverrideFlags: 0,
  customDepositFeeBps: 10,
  customWithdrawalFeeBps: 20,
  customPerformanceFeeBps: 30,
  customManagementFeeBps: 40,
};

const estimateBundle = {
  ...defaultFees,
  assetPrecision: 1_000_000n,
  bundleUnderlyingBalance: 1_000_000_000_000n,
  totalShares: 1_000_000_000_000n,
};

const estimateUser = {
  shares: 1_000_000_000_000n,
  hwmPerShare: 1_000_000n,
  lastManagementFeeTimestamp: 1n,
  ...defaultUserOverrides,
};

function estimate(
  overrides: {
    bundle?: Partial<typeof estimateBundle>;
    oracleData?: { averageExternalEquity: bigint };
    userBundle?: Partial<typeof estimateUser>;
    nowUnixSeconds?: number | bigint;
  } = {},
) {
  return estimatePendingUserFees({
    bundle: { ...estimateBundle, ...overrides.bundle },
    oracleData: overrides.oracleData ?? { averageExternalEquity: 0n },
    userBundle: { ...estimateUser, ...overrides.userBundle },
    nowUnixSeconds: overrides.nowUnixSeconds ?? 1n,
  });
}

describe("fee extensions", () => {
  describe("resolveEffectiveReferralRates", () => {
    const bundleRates = {
      referralTiers: [{ threshold: 0n, pfeeBps: 1_000, mfeeBps: 2_000 }],
      tierCount: 1,
    };
    const referrerOverrides = {
      rateOverrideFlags: 0,
      customPfeeBps: 3_000,
      customMfeeBps: 4_000,
    };

    it("uses the bundle tier for unregistered and unmasked referrers", () => {
      expect(
        resolveEffectiveReferralRates(bundleRates, undefined),
      ).to.deep.equal({
        referralPfeeBps: 1_000,
        referralMfeeBps: 2_000,
        referralTierIndex: 0,
      });
      expect(
        resolveEffectiveReferralRates(bundleRates, referrerOverrides),
      ).to.deep.equal({
        referralPfeeBps: 1_000,
        referralMfeeBps: 2_000,
        referralTierIndex: 0,
      });
    });

    it("resolves every referral override mask independently", () => {
      expect(
        resolveEffectiveReferralRates(bundleRates, {
          ...referrerOverrides,
          rateOverrideFlags: REFERRAL_OVERRIDE_PFEE,
        }),
      ).to.deep.equal({
        referralPfeeBps: 3_000,
        referralMfeeBps: 2_000,
        referralTierIndex: 0,
      });
      expect(
        resolveEffectiveReferralRates(bundleRates, {
          ...referrerOverrides,
          rateOverrideFlags: REFERRAL_OVERRIDE_MFEE,
        }),
      ).to.deep.equal({
        referralPfeeBps: 1_000,
        referralMfeeBps: 4_000,
        referralTierIndex: 0,
      });
      expect(
        resolveEffectiveReferralRates(bundleRates, {
          ...referrerOverrides,
          rateOverrideFlags: REFERRAL_OVERRIDE_PFEE | REFERRAL_OVERRIDE_MFEE,
        }),
      ).to.deep.equal({
        referralPfeeBps: 3_000,
        referralMfeeBps: 4_000,
        referralTierIndex: undefined,
      });
    });

    it("returns zero rates for an empty schedule", () => {
      expect(
        resolveBundleReferralRates({ referralTiers: [], tierCount: 0 }, 500n),
      ).to.deep.equal({
        referralPfeeBps: 0,
        referralMfeeBps: 0,
        referralTierIndex: undefined,
      });
    });

    it("resolves inclusive tiers and returns zero below the first threshold", () => {
      const tieredBundle = {
        ...bundleRates,
        referralTiers: [
          { threshold: 100n, pfeeBps: 1_500, mfeeBps: 2_500 },
          { threshold: 500n, pfeeBps: 3_500, mfeeBps: 4_500 },
        ],
        tierCount: 2,
      };

      expect(resolveBundleReferralRates(tieredBundle, -1n)).to.deep.equal({
        referralPfeeBps: 0,
        referralMfeeBps: 0,
        referralTierIndex: undefined,
      });
      expect(resolveBundleReferralRates(tieredBundle, 100n)).to.deep.equal({
        referralPfeeBps: 1_500,
        referralMfeeBps: 2_500,
        referralTierIndex: 0,
      });
      expect(resolveBundleReferralRates(tieredBundle, 500n)).to.deep.equal({
        referralPfeeBps: 3_500,
        referralMfeeBps: 4_500,
        referralTierIndex: 1,
      });
    });

    it("combines tier rates with partial overrides and bypasses tiers for a full override", () => {
      const tieredBundle = {
        ...bundleRates,
        referralTiers: [{ threshold: 100n, pfeeBps: 1_500, mfeeBps: 2_500 }],
        tierCount: 1,
      };
      const tieredReferrer = {
        ...referrerOverrides,
        referredNetDeposits: 100n,
      };

      expect(
        resolveEffectiveReferralRates(tieredBundle, {
          ...tieredReferrer,
          rateOverrideFlags: REFERRAL_OVERRIDE_PFEE,
        }),
      ).to.deep.equal({
        referralPfeeBps: 3_000,
        referralMfeeBps: 2_500,
        referralTierIndex: 0,
      });
      expect(
        resolveEffectiveReferralRates(tieredBundle, {
          ...tieredReferrer,
          rateOverrideFlags: REFERRAL_OVERRIDE_PFEE | REFERRAL_OVERRIDE_MFEE,
        }),
      ).to.deep.equal({
        referralPfeeBps: 3_000,
        referralMfeeBps: 4_000,
        referralTierIndex: undefined,
      });
    });
  });

  describe("resolveEffectiveFees", () => {
    it("falls back to bundle defaults", () => {
      expect(
        resolveEffectiveFees(defaultFees, defaultUserOverrides),
      ).to.deep.equal({
        depositFeeBps: 100,
        withdrawalFeeBps: 200,
        performanceFeeBps: 2_000,
        managementFeeBps: 500,
      });
    });

    it("applies each override flag independently", () => {
      expect(
        resolveEffectiveFees(defaultFees, {
          ...defaultUserOverrides,
          feeOverrideFlags: FEE_OVERRIDE_DEPOSIT,
        }),
      ).to.deep.equal({
        depositFeeBps: 10,
        withdrawalFeeBps: 200,
        performanceFeeBps: 2_000,
        managementFeeBps: 500,
      });
      expect(
        resolveEffectiveFees(defaultFees, {
          ...defaultUserOverrides,
          feeOverrideFlags: FEE_OVERRIDE_WITHDRAWAL,
        }),
      ).to.deep.equal({
        depositFeeBps: 100,
        withdrawalFeeBps: 20,
        performanceFeeBps: 2_000,
        managementFeeBps: 500,
      });
      expect(
        resolveEffectiveFees(defaultFees, {
          ...defaultUserOverrides,
          feeOverrideFlags: FEE_OVERRIDE_PERFORMANCE,
        }),
      ).to.deep.equal({
        depositFeeBps: 100,
        withdrawalFeeBps: 200,
        performanceFeeBps: 30,
        managementFeeBps: 500,
      });
      expect(
        resolveEffectiveFees(defaultFees, {
          ...defaultUserOverrides,
          feeOverrideFlags: FEE_OVERRIDE_MANAGEMENT,
        }),
      ).to.deep.equal({
        depositFeeBps: 100,
        withdrawalFeeBps: 200,
        performanceFeeBps: 2_000,
        managementFeeBps: 40,
      });
    });

    it("honors a zero-valued override", () => {
      expect(
        resolveEffectiveFees(defaultFees, {
          ...defaultUserOverrides,
          feeOverrideFlags: FEE_OVERRIDE_DEPOSIT,
          customDepositFeeBps: 0,
        }).depositFeeBps,
      ).to.equal(0);
    });

    it("applies all override flags together", () => {
      expect(
        resolveEffectiveFees(defaultFees, {
          ...defaultUserOverrides,
          feeOverrideFlags:
            FEE_OVERRIDE_DEPOSIT |
            FEE_OVERRIDE_WITHDRAWAL |
            FEE_OVERRIDE_PERFORMANCE |
            FEE_OVERRIDE_MANAGEMENT,
        }),
      ).to.deep.equal({
        depositFeeBps: 10,
        withdrawalFeeBps: 20,
        performanceFeeBps: 30,
        managementFeeBps: 40,
      });
    });
  });

  describe("estimatePendingUserFees", () => {
    it("calculates an exact one-year management fee", () => {
      const result = estimate({
        bundle: { managementFeeBps: 200, performanceFee: 0 },
        userBundle: { lastManagementFeeTimestamp: 10n },
        nowUnixSeconds: 31_536_010,
      });

      expect(result.managementFeeShares).to.equal(20_000_000_000n);
      expect(result.performanceFeeShares).to.equal(0n);
      expect(result.totalFeeShares).to.equal(20_000_000_000n);
    });

    it("calculates an exact performance fee above the high-water mark", () => {
      const result = estimate({
        bundle: {
          bundleUnderlyingBalance: 2_000_000_000_000n,
          managementFeeBps: 0,
          performanceFee: 2_000,
        },
        userBundle: {
          hwmPerShare: 1_000_000n,
          lastManagementFeeTimestamp: 0n,
        },
      });

      expect(result.sharePrice).to.equal(2_000_000n);
      expect(result.performanceFeeShares).to.equal(100_000_000_000n);
      expect(result.totalFeeShares).to.equal(100_000_000_000n);
    });

    it("estimates no performance fee when the high-water mark is unset", () => {
      const result = estimate({
        bundle: { bundleUnderlyingBalance: 2_000_000_000_000n },
        userBundle: { hwmPerShare: 0n },
      });

      expect(result.performanceFeeShares).to.equal(0n);
    });

    it("estimates no management fee when its timestamp is unset", () => {
      const result = estimate({
        userBundle: { lastManagementFeeTimestamp: 0n },
        nowUnixSeconds: 31_536_000n,
      });

      expect(result.managementFeeShares).to.equal(0n);
    });

    it("clamps negative management elapsed time to zero", () => {
      const result = estimate({
        userBundle: { lastManagementFeeTimestamp: 1_000n },
        nowUnixSeconds: 999,
      });

      expect(result.managementFeeShares).to.equal(0n);
    });

    it("caps management first and performance to the remaining shares", () => {
      const result = estimate({
        bundle: {
          assetPrecision: 100n,
          bundleUnderlyingBalance: 200n,
          totalShares: 100n,
          managementFeeBps: 20_000,
          performanceFee: 10_000,
        },
        userBundle: {
          shares: 100n,
          hwmPerShare: 100n,
          lastManagementFeeTimestamp: 1n,
        },
        nowUnixSeconds: 31_536_001n,
      });

      expect(result.managementFeeShares).to.equal(100n);
      expect(result.performanceFeeShares).to.equal(0n);
      expect(result.totalFeeShares).to.equal(100n);
    });

    it("uses asset precision as share price for a zero total share supply", () => {
      const result = estimate({
        bundle: { assetPrecision: 1_000n, totalShares: 0n },
      });

      expect(result.sharePrice).to.equal(1_000n);
    });

    it("floors the fee value using share price and asset precision", () => {
      const result = estimate({
        bundle: {
          assetPrecision: 10n,
          bundleUnderlyingBalance: 30n,
          totalShares: 20n,
          managementFeeBps: 3_000,
          performanceFee: 0,
        },
        userBundle: {
          shares: 10n,
          hwmPerShare: 15n,
          lastManagementFeeTimestamp: 1n,
        },
        nowUnixSeconds: 31_536_001n,
      });

      expect(result.sharePrice).to.equal(15n);
      expect(result.totalFeeShares).to.equal(3n);
      expect(result.feeValueRaw).to.equal(4n);
      expect(result.feeValueRaw).to.equal(
        (result.totalFeeShares * result.sharePrice) / 10n,
      );
    });

    it("uses fee overrides in the estimate", () => {
      const withoutOverride = estimate({
        bundle: { managementFeeBps: 100, performanceFee: 0 },
        userBundle: {
          shares: 10_000n,
          customManagementFeeBps: 200,
          lastManagementFeeTimestamp: 1n,
        },
        nowUnixSeconds: 31_536_001n,
      });
      const withOverride = estimate({
        bundle: { managementFeeBps: 100, performanceFee: 0 },
        userBundle: {
          shares: 10_000n,
          feeOverrideFlags: FEE_OVERRIDE_MANAGEMENT,
          customManagementFeeBps: 200,
          lastManagementFeeTimestamp: 1n,
        },
        nowUnixSeconds: 31_536_001n,
      });

      expect(withoutOverride.managementFeeShares).to.equal(100n);
      expect(withOverride.managementFeeShares).to.equal(200n);
    });
  });
});
