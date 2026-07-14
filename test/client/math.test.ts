import { expect } from "chai";

import {
  U64_MAX,
  assertValidAmountRaw,
  calculateAssetsFromShares,
  calculateOnChainPps,
  computeWithdrawalShares,
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
