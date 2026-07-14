import {
  getAddressDecoder,
  getBase64Decoder,
  type Address,
  type Base64EncodedBytes,
} from "@solana/kit";

import { type ExtensionsRpc } from "../../src/extensions/rpc";
import {
  getBundleEncoder,
  getOracleDataEncoder,
  getUserBundleAccountEncoder,
  NTBUNDLE_PROGRAM_ADDRESS,
  type BundleArgs,
  type OracleDataArgs,
  type UserBundleAccountArgs,
} from "../../src/generated";

const addressDecoder = getAddressDecoder();
const base64Decoder = getBase64Decoder();

/**
 * Builds a deterministic address from a single byte: a 32-byte array whose
 * last byte is the seed value (and the rest are zero). This sidesteps the
 * 32-byte-length and base58-alphabet constraints by going through the
 * canonical decoder, so tests don't have to author valid base58 by hand.
 */
export function fakeAddress(seed: number): Address {
  const bytes = new Uint8Array(32);
  bytes[31] = seed;
  return addressDecoder.decode(bytes);
}

export const ZERO_ADDRESS: Address = fakeAddress(0);
export const TEST_BUNDLE_ADDRESS: Address = fakeAddress(2);
export const TEST_USER_ADDRESS: Address = fakeAddress(3);
export const TEST_ASSET_MINT_ADDRESS: Address = fakeAddress(4);
export const TEST_TREASURY_ADDRESS: Address = fakeAddress(5);
export const TEST_TARGET_BUNDLE_ADDRESS: Address = fakeAddress(6);

type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (patch === undefined || patch === null) return base;
  if (typeof base !== "object" || base === null) return patch as T;
  if (Array.isArray(base) || base instanceof Uint8Array) return patch as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(patch as Record<string, unknown>)) {
    const baseVal = (base as Record<string, unknown>)[key];
    const patchVal = (patch as Record<string, unknown>)[key];
    out[key] = deepMerge(baseVal as never, patchVal as never);
  }
  return out as T;
}

/**
 * Zeroed Bundle args with a sane 6-decimal asset (assetPrecision 10^6),
 * matching the most common deployment shape. Override per test.
 */
export function emptyBundleArgs(): BundleArgs {
  return {
    name: new Uint8Array(32),
    manager: ZERO_ADDRESS,
    keeper: ZERO_ADDRESS,
    treasuryAccount: TEST_TREASURY_ADDRESS,
    allocatedReceivers: [],
    bundleUnderlyingBalance: 0n,
    maxDepositAmount: 0n,
    withdrawalDelay: 0n,
    performanceFee: 0,
    managementFeeBps: 0,
    depositFee: 0,
    withdrawalFee: 0,
    managerPfeeShares: 0n,
    currentAllocationBps: 0,
    oracleBuffer: 0n,
    totalShares: 0n,
    assetPrecision: 1_000_000n,
    assetAddress: TEST_ASSET_MINT_ADDRESS,
    assetDecimals: 6,
    withdrawalTMin: 0n,
    withdrawalTMax: 0n,
    withdrawalCurve: 0,
    permissionned: false,
    managerMfeeShares: 0n,
    minDepositAmount: 0n,
    oracleUpdateTimeLimit: 0n,
    oracleMaxAge: 0n,
    withdrawalRedemptionRequestCutoffTs: 0n,
    withdrawalRedemptionUnlockCurrentCycleTs: 0n,
    withdrawalRedemptionUnlockNextCycleTs: 0n,
    referralPfeeBps: 0,
    referralMfeeBps: 0,
    referrerEnabled: false,
    referrerMinDepositAmount: 0n,
    padding: new Uint8Array(190),
  };
}

export function emptyUserBundleArgs(): UserBundleAccountArgs {
  return {
    owner: TEST_USER_ADDRESS,
    lastDepositTimestamp: 0n,
    shares: 0n,
    pendingDeposit: 0n,
    pendingShares: 0n,
    estimatedPendingWithdrawalValue: 0n,
    withdrawalAvailableTimestamp: 0n,
    lastWithdrawalProcessTimestamp: 0n,
    lastHighWaterMark: 0n,
    hwmPerShare: 0n,
    lastManagementFeeTimestamp: 0n,
    netDeposits: 0n,
    totalFeeCharged: 0n,
    customDepositFeeBps: 0,
    customWithdrawalFeeBps: 0,
    customPerformanceFeeBps: 0,
    customManagementFeeBps: 0,
    feeOverrideFlags: 0,
    customWithdrawalDelay: 0n,
    customWithdrawalTMin: 0n,
    customWithdrawalTMax: 0n,
    customWithdrawalCurve: 0,
    withdrawalTimingOverrideFlags: 0,
    switchActive: false,
    switchTargetBundle: ZERO_ADDRESS,
    switchCreatedAt: 0n,
    referrer: ZERO_ADDRESS,
    referralPfeeBps: 0,
    referralMfeeBps: 0,
    referralFlags: 0,
    padding: new Uint8Array(136),
  };
}

export function emptyOracleDataArgs(): OracleDataArgs {
  return {
    averageExternalEquity: 0n,
    lastUpdateTime: 0n,
    padding: new Uint8Array(64),
  };
}

export function buildEncodedBundleBytes(
  overrides: DeepPartial<BundleArgs> = {},
): Uint8Array {
  const args = deepMerge(emptyBundleArgs(), overrides);
  return getBundleEncoder().encode(args) as Uint8Array;
}

export function buildEncodedUserBundleBytes(
  overrides: DeepPartial<UserBundleAccountArgs> = {},
): Uint8Array {
  const args = deepMerge(emptyUserBundleArgs(), overrides);
  return getUserBundleAccountEncoder().encode(args) as Uint8Array;
}

export function buildEncodedOracleDataBytes(
  overrides: DeepPartial<OracleDataArgs> = {},
): Uint8Array {
  const args = deepMerge(emptyOracleDataArgs(), overrides);
  return getOracleDataEncoder().encode(args) as Uint8Array;
}

function bytesToBase64String(bytes: Uint8Array): Base64EncodedBytes {
  return base64Decoder.decode(bytes) as Base64EncodedBytes;
}

function makeAccountInfoValue(data: Uint8Array, owner: Address) {
  return {
    data: [bytesToBase64String(data), "base64"] as const,
    executable: false,
    lamports: 1_000_000n,
    owner,
    rentEpoch: 0n,
    space: BigInt(data.length),
  };
}

export type FakeAccountRegistry = ReadonlyMap<Address, Uint8Array>;

/**
 * A minimal fake RPC backed by an address -> account-bytes registry.
 * `getAccountInfo` and `getMultipleAccounts` return base64 account data for
 * registered addresses and `null` values for unregistered ones (which is what
 * the generated `fetchMaybe*` helpers expect for missing accounts). Any other
 * RPC method access throws so unintended calls fail loudly.
 */
export function fakeRpc(
  accounts: FakeAccountRegistry,
  options: { owner?: Address } = {},
): ExtensionsRpc {
  const owner = options.owner ?? NTBUNDLE_PROGRAM_ADDRESS;

  const target = {
    getAccountInfo(requested: Address) {
      return {
        send: async () => ({
          context: { slot: 1n, apiVersion: "test" },
          value: (() => {
            const data = accounts.get(requested);
            return data ? makeAccountInfoValue(data, owner) : null;
          })(),
        }),
      };
    },
    getMultipleAccounts(requested: Address[]) {
      return {
        send: async () => ({
          context: { slot: 1n, apiVersion: "test" },
          value: requested.map((address) => {
            const data = accounts.get(address);
            return data ? makeAccountInfoValue(data, owner) : null;
          }),
        }),
      };
    },
  };

  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as keyof typeof obj];
      throw new Error(`fakeRpc: unexpected RPC method ${String(prop)}`);
    },
  }) as unknown as ExtensionsRpc;
}

/** Convenience: registry builder that keeps call sites terse. */
export function accountsRegistry(
  entries: Array<[Address, Uint8Array]>,
): FakeAccountRegistry {
  return new Map(entries);
}
