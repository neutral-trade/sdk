/** Mirrors `BPS_DENOMINATOR` in `constants.rs:12` and its use in `charge_user_fees` at `bundle.rs:693-695`. */
export const BPS_DENOMINATOR = 10_000n;

/** Mirrors `SECONDS_IN_YEAR` in `constants.rs:11` and its use in `charge_user_fees` at `bundle.rs:693-695`. */
export const SECONDS_IN_YEAR = 31_536_000n;

/** Upper bound for the Rust `u64` amounts consumed by `fetch_total_equity` at `bundle.rs:244-257`. */
export const U64_MAX = 18_446_744_073_709_551_615n;

/**
 * Parses a positive decimal `u64` amount for Rust amount paths such as
 * `calculate_assets_from_shares` at `bundle.rs:259-270`.
 */
export function parseAmountRaw(amountRaw: string): bigint {
  const trimmedAmountRaw = amountRaw.trim();
  if (!/^\d+$/.test(trimmedAmountRaw)) {
    throw new Error("INVALID_AMOUNT_RAW");
  }

  const amount = BigInt(trimmedAmountRaw);
  assertValidAmountRaw(amount);
  return amount;
}

/**
 * Enforces the positive Rust `u64` bounds used by amount parameters such as
 * `total_assets` in `calculate_assets_from_shares` at `bundle.rs:259-270`.
 */
export function assertValidAmountRaw(amountRaw: bigint): void {
  if (amountRaw <= 0n || amountRaw > U64_MAX) {
    throw new Error("INVALID_AMOUNT_RAW");
  }
}

/**
 * Converts a UI float to the integer amount domain used by
 * `calculate_assets_from_shares` at `bundle.rs:259-270`.
 */
export function humanFloatToAmountRaw(human: number, decimals: number): bigint {
  if (
    !Number.isFinite(human) ||
    human <= 0 ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18
  ) {
    throw new Error("INVALID_HUMAN_AMOUNT");
  }

  const scaledAmount = human * 10 ** decimals;
  if (!Number.isFinite(scaledAmount)) {
    throw new Error("INVALID_HUMAN_AMOUNT");
  }

  const roundedAmount = Math.round(scaledAmount);
  if (roundedAmount <= 0) {
    throw new Error("INVALID_HUMAN_AMOUNT");
  }

  const amountRaw = BigInt(roundedAmount);
  assertValidAmountRaw(amountRaw);
  return amountRaw;
}

/** Mirrors `fetch_total_equity` at `bundle.rs:244-257`. */
export function totalEquityRaw(args: {
  bundleUnderlyingBalance: bigint;
  averageExternalEquity: bigint;
}): bigint {
  return args.bundleUnderlyingBalance + args.averageExternalEquity;
}

/** Mirrors the share-price calculation in `charge_user_fees` at `bundle.rs:662-670`. */
export function sharePriceRaw(args: {
  totalAssets: bigint;
  totalShares: bigint;
  assetPrecision: bigint;
}): bigint {
  return args.totalShares > 0n
    ? (args.totalAssets * args.assetPrecision) / args.totalShares
    : args.assetPrecision;
}

/**
 * Mirrors `calculate_assets_from_shares` at `bundle.rs:259-270`. When
 * `totalShares` is zero this read-only helper returns zero, while the Rust
 * function reports a division error.
 */
export function calculateAssetsFromShares(args: {
  shares: bigint;
  totalAssets: bigint;
  totalShares: bigint;
}): bigint {
  return args.totalShares === 0n
    ? 0n
    : (args.shares * args.totalAssets) / args.totalShares;
}

/**
 * Applies the legacy withdrawal-share ratio using the integer division from
 * `calculate_assets_from_shares` at `bundle.rs:259-270`.
 */
export function computeWithdrawalShares(args: {
  amountRaw: bigint;
  userShares: bigint;
  totalEquity: bigint;
  totalShares: bigint;
}): bigint {
  if (args.totalShares === 0n || args.userShares === 0n) {
    return 0n;
  }

  const userTokenRaw = (args.userShares * args.totalEquity) / args.totalShares;
  if (args.amountRaw >= userTokenRaw) {
    return args.userShares;
  }
  if (args.totalEquity === 0n) {
    return 0n;
  }

  const computedShares = (args.amountRaw * args.totalShares) / args.totalEquity;
  return computedShares > args.userShares ? args.userShares : computedShares;
}

/**
 * Returns the UI ratio corresponding to the price calculation in
 * `charge_user_fees` at `bundle.rs:662-670`. Converting bigints to numbers can
 * lose precision.
 */
export function calculateOnChainPps(args: {
  totalEquity: bigint;
  totalShares: bigint;
}): number {
  return args.totalShares === 0n
    ? 0
    : Number(args.totalEquity) / Number(args.totalShares);
}
