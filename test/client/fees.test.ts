import { expect } from "chai";

import {
  FEE_OVERRIDE_DEPOSIT,
  FEE_OVERRIDE_MANAGEMENT,
  FEE_OVERRIDE_PERFORMANCE,
  FEE_OVERRIDE_WITHDRAWAL,
  estimatePendingUserFees,
  resolveEffectiveFees,
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
