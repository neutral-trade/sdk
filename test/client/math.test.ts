import { expect } from "chai";

import {
  MAX_DEPOSIT_FEE_BPS,
  U64_MAX,
  assertValidAmountRaw,
  calculateAssetsFromShares,
  calculateGrossDepositAmount,
  calculateOnChainPps,
  computeWithdrawalShares,
  estimateWithdrawalAvailableTimestamp,
  estimateWithdrawalCooldownSeconds,
  humanFloatToAmountRaw,
  parseAmountRaw,
  sharePriceRaw,
  totalEquityRaw,
} from "../../src/extensions/math";

describe("math extensions", () => {
  describe("parseAmountRaw", () => {
    it("accepts trimmed decimal digits and the u64 maximum", () => {
      expect(parseAmountRaw(" 42 ")).to.equal(42n);
      expect(parseAmountRaw(U64_MAX.toString())).to.equal(U64_MAX);
    });

    it("rejects zero, empty input, and non-digits", () => {
      for (const invalid of ["0", "", "   ", "1.5", "-1", "+1", "1e3"]) {
        expect(() => parseAmountRaw(invalid)).to.throw("INVALID_AMOUNT_RAW");
      }
    });

    it("rejects the first value above the u64 maximum", () => {
      expect(() => parseAmountRaw((U64_MAX + 1n).toString())).to.throw(
        "INVALID_AMOUNT_RAW",
      );
    });
  });

  describe("assertValidAmountRaw", () => {
    it("accepts both valid bounds and rejects values outside them", () => {
      expect(() => assertValidAmountRaw(1n)).not.to.throw();
      expect(() => assertValidAmountRaw(U64_MAX)).not.to.throw();
      expect(() => assertValidAmountRaw(0n)).to.throw("INVALID_AMOUNT_RAW");
      expect(() => assertValidAmountRaw(-1n)).to.throw("INVALID_AMOUNT_RAW");
      expect(() => assertValidAmountRaw(U64_MAX + 1n)).to.throw(
        "INVALID_AMOUNT_RAW",
      );
    });
  });

  describe("calculateGrossDepositAmount", () => {
    function netAfterProgramFee(
      grossAmount: bigint,
      depositFeeBps: number,
    ): bigint {
      const fee = (grossAmount * BigInt(depositFeeBps) + 9_999n) / 10_000n;
      return grossAmount - fee;
    }

    it("returns the exact fee-free amount and zero boundary", () => {
      expect(
        calculateGrossDepositAmount({
          minimumNetAmount: 0n,
          depositFeeBps: 0,
        }),
      ).to.equal(0n);
      expect(
        calculateGrossDepositAmount({
          minimumNetAmount: U64_MAX,
          depositFeeBps: 0,
        }),
      ).to.equal(U64_MAX);
    });

    it("produces the smallest sufficient gross across generated inputs", () => {
      const feeRates = [0, 1, 17, 100, 333, 2_500, MAX_DEPOSIT_FEE_BPS];
      let generatedMinimum = 7_919n;
      for (const depositFeeBps of feeRates) {
        for (let caseIndex = 0; caseIndex < 200; caseIndex += 1) {
          generatedMinimum =
            (generatedMinimum * 48_271n + 1n) % 1_000_000_000_000n;
          const minimumNetAmount = generatedMinimum + 1n;
          const grossAmount = calculateGrossDepositAmount({
            minimumNetAmount,
            depositFeeBps,
          });

          expect(
            netAfterProgramFee(grossAmount, depositFeeBps) >= minimumNetAmount,
          ).to.equal(true);
          expect(
            netAfterProgramFee(grossAmount - 1n, depositFeeBps) <
              minimumNetAmount,
          ).to.equal(true);
        }
      }
    });

    it("rejects invalid domains and gross amounts above u64", () => {
      for (const depositFeeBps of [-1, 1.5, MAX_DEPOSIT_FEE_BPS + 1]) {
        expect(() =>
          calculateGrossDepositAmount({
            minimumNetAmount: 1n,
            depositFeeBps,
          }),
        ).to.throw("INVALID_DEPOSIT_FEE_BPS");
      }
      for (const minimumNetAmount of [-1n, U64_MAX + 1n]) {
        expect(() =>
          calculateGrossDepositAmount({
            minimumNetAmount,
            depositFeeBps: 0,
          }),
        ).to.throw("INVALID_NET_DEPOSIT_AMOUNT");
      }
      expect(() =>
        calculateGrossDepositAmount({
          minimumNetAmount: U64_MAX,
          depositFeeBps: 1,
        }),
      ).to.throw("GROSS_DEPOSIT_AMOUNT_EXCEEDS_U64");
    });
  });

  describe("humanFloatToAmountRaw", () => {
    it("rounds scaled amounts and accepts decimals at both bounds", () => {
      expect(humanFloatToAmountRaw(1.000000499, 6)).to.equal(1_000_000n);
      expect(humanFloatToAmountRaw(1.0000005, 6)).to.equal(1_000_001n);
      expect(humanFloatToAmountRaw(1.4, 0)).to.equal(1n);
      expect(humanFloatToAmountRaw(0.000000000000000001, 18)).to.equal(1n);
    });

    it("rejects invalid human values and decimal counts", () => {
      for (const human of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
        expect(() => humanFloatToAmountRaw(human, 6)).to.throw(
          "INVALID_HUMAN_AMOUNT",
        );
      }
      for (const decimals of [-1, 1.5, 19]) {
        expect(() => humanFloatToAmountRaw(1, decimals)).to.throw(
          "INVALID_HUMAN_AMOUNT",
        );
      }
      expect(() => humanFloatToAmountRaw(Number.MIN_VALUE, 0)).to.throw(
        "INVALID_HUMAN_AMOUNT",
      );
    });

    it("propagates the raw u64 bounds error after rounding", () => {
      expect(() => humanFloatToAmountRaw(2 ** 64, 0)).to.throw(
        "INVALID_AMOUNT_RAW",
      );
    });
  });

  it("sums underlying and external equity", () => {
    expect(
      totalEquityRaw({
        bundleUnderlyingBalance: 2_000n,
        averageExternalEquity: 345n,
      }),
    ).to.equal(2_345n);
  });

  describe("sharePriceRaw", () => {
    it("uses asset precision when there are no shares", () => {
      expect(
        sharePriceRaw({
          totalAssets: 123n,
          totalShares: 0n,
          assetPrecision: 1_000_000n,
        }),
      ).to.equal(1_000_000n);
    });

    it("uses floor division for an active share supply", () => {
      expect(
        sharePriceRaw({
          totalAssets: 10n,
          totalShares: 6n,
          assetPrecision: 100n,
        }),
      ).to.equal(166n);
    });
  });

  describe("calculateAssetsFromShares", () => {
    it("uses floor division and returns zero for a zero share supply", () => {
      expect(
        calculateAssetsFromShares({
          shares: 7n,
          totalAssets: 10n,
          totalShares: 6n,
        }),
      ).to.equal(11n);
      expect(
        calculateAssetsFromShares({
          shares: 7n,
          totalAssets: 10n,
          totalShares: 0n,
        }),
      ).to.equal(0n);
    });
  });

  describe("estimateWithdrawalCooldownSeconds", () => {
    it("returns the maximum when total shares are zero", () => {
      expect(
        estimateWithdrawalCooldownSeconds({
          sharesAmount: 25n,
          totalShares: 0n,
          withdrawalTMin: 10n,
          withdrawalTMax: 90n,
          withdrawalCurve: 2,
        }),
      ).to.equal(90n);
    });

    it("matches linear endpoints and rounds fractional seconds up", () => {
      expect(
        estimateWithdrawalCooldownSeconds({
          sharesAmount: 25n,
          totalShares: 100n,
          withdrawalTMin: 10n,
          withdrawalTMax: 30n,
          withdrawalCurve: 1,
        }),
      ).to.equal(15n);
      expect(
        estimateWithdrawalCooldownSeconds({
          sharesAmount: 1n,
          totalShares: 3n,
          withdrawalTMin: 10n,
          withdrawalTMax: 20n,
          withdrawalCurve: 1,
        }),
      ).to.equal(14n);
      expect(
        estimateWithdrawalCooldownSeconds({
          sharesAmount: 100n,
          totalShares: 100n,
          withdrawalTMin: 10n,
          withdrawalTMax: 30n,
          withdrawalCurve: 1,
        }),
      ).to.equal(30n);
    });

    it("stays bounded and monotonic across share fractions and curves", () => {
      const withdrawalTMin = 17n;
      const withdrawalTMax = 503n;
      const totalShares = 200n;

      for (const withdrawalCurve of [0.5, 1, 2, 4]) {
        let previousCooldown = withdrawalTMin;
        for (
          let sharesAmount = 0n;
          sharesAmount <= totalShares;
          sharesAmount += 1n
        ) {
          const cooldown = estimateWithdrawalCooldownSeconds({
            sharesAmount,
            totalShares,
            withdrawalTMin,
            withdrawalTMax,
            withdrawalCurve,
          });
          expect(cooldown >= withdrawalTMin).to.equal(true);
          expect(cooldown <= withdrawalTMax).to.equal(true);
          expect(cooldown >= previousCooldown).to.equal(true);
          previousCooldown = cooldown;
        }
      }
    });
  });

  describe("estimateWithdrawalAvailableTimestamp", () => {
    it("returns the cooldown end when no redemption schedule is configured", () => {
      expect(
        estimateWithdrawalAvailableTimestamp({
          nowUnixSeconds: 100n,
          cooldownSeconds: 20n,
          withdrawalRedemptionRequestCutoffTs: 0n,
          withdrawalRedemptionUnlockCurrentCycleTs: 500n,
          withdrawalRedemptionUnlockNextCycleTs: 700n,
        }),
      ).to.equal(120n);
    });

    it("selects the current cycle at the cutoff and the next cycle after it", () => {
      expect(
        estimateWithdrawalAvailableTimestamp({
          nowUnixSeconds: 100n,
          cooldownSeconds: 20n,
          withdrawalRedemptionRequestCutoffTs: 100n,
          withdrawalRedemptionUnlockCurrentCycleTs: 200n,
          withdrawalRedemptionUnlockNextCycleTs: 300n,
        }),
      ).to.equal(200n);
      expect(
        estimateWithdrawalAvailableTimestamp({
          nowUnixSeconds: 101n,
          cooldownSeconds: 20n,
          withdrawalRedemptionRequestCutoffTs: 100n,
          withdrawalRedemptionUnlockCurrentCycleTs: 200n,
          withdrawalRedemptionUnlockNextCycleTs: 300n,
        }),
      ).to.equal(300n);
    });

    it("uses the later of cooldown end and the selected policy unlock", () => {
      expect(
        estimateWithdrawalAvailableTimestamp({
          nowUnixSeconds: 100n,
          cooldownSeconds: 150n,
          withdrawalRedemptionRequestCutoffTs: 200n,
          withdrawalRedemptionUnlockCurrentCycleTs: 220n,
          withdrawalRedemptionUnlockNextCycleTs: 400n,
        }),
      ).to.equal(250n);
      expect(
        estimateWithdrawalAvailableTimestamp({
          nowUnixSeconds: 100n,
          cooldownSeconds: 20n,
          withdrawalRedemptionRequestCutoffTs: 200n,
          withdrawalRedemptionUnlockCurrentCycleTs: 220n,
          withdrawalRedemptionUnlockNextCycleTs: 400n,
        }),
      ).to.equal(220n);
    });
  });

  describe("computeWithdrawalShares", () => {
    const position = {
      userShares: 400n,
      totalEquity: 1_000n,
      totalShares: 2_000n,
    };

    it("returns the full position at and above the user's token value", () => {
      expect(
        computeWithdrawalShares({ ...position, amountRaw: 200n }),
      ).to.equal(400n);
      expect(
        computeWithdrawalShares({ ...position, amountRaw: 201n }),
      ).to.equal(400n);
    });

    it("calculates the exact partial share amount", () => {
      expect(computeWithdrawalShares({ ...position, amountRaw: 75n })).to.equal(
        150n,
      );
    });

    it("clamps a computed result to the user's shares", () => {
      expect(
        computeWithdrawalShares({
          amountRaw: -20n,
          userShares: 100n,
          totalEquity: -100n,
          totalShares: 1_000n,
        }),
      ).to.equal(100n);
    });

    it("preserves the legacy zero-equity branch ordering", () => {
      expect(
        computeWithdrawalShares({
          amountRaw: -1n,
          userShares: 100n,
          totalEquity: 0n,
          totalShares: 1_000n,
        }),
      ).to.equal(0n);
      expect(
        computeWithdrawalShares({
          amountRaw: 1n,
          userShares: 100n,
          totalEquity: 0n,
          totalShares: 1_000n,
        }),
      ).to.equal(100n);
    });

    it("returns zero for zero user shares or zero total shares", () => {
      expect(
        computeWithdrawalShares({
          amountRaw: 1n,
          userShares: 0n,
          totalEquity: 1_000n,
          totalShares: 2_000n,
        }),
      ).to.equal(0n);
      expect(
        computeWithdrawalShares({
          amountRaw: 1n,
          userShares: 100n,
          totalEquity: 1_000n,
          totalShares: 0n,
        }),
      ).to.equal(0n);
    });
  });

  describe("calculateOnChainPps", () => {
    it("calculates the UI ratio and guards a zero share supply", () => {
      expect(
        calculateOnChainPps({ totalEquity: 7n, totalShares: 2n }),
      ).to.equal(3.5);
      expect(
        calculateOnChainPps({ totalEquity: 7n, totalShares: 0n }),
      ).to.equal(0);
    });
  });
});
