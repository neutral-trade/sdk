import { expect } from "chai";

import {
  fetchAllMaybeUserBundleAccount,
  fetchBundle,
  fetchMaybeBundle,
  fetchMaybeOracleData,
  fetchMaybeReferrerAccount,
  getReferrerAccountSize,
} from "../../src/generated";
import {
  accountsRegistry,
  buildEncodedBundleBytes,
  buildEncodedOracleDataBytes,
  buildEncodedReferrerAccountBytes,
  buildEncodedUserBundleBytes,
  fakeAddress,
  fakeRpc,
  TEST_BUNDLE_ADDRESS,
  TEST_USER_ADDRESS,
} from "./testHelpers";

describe("testHelpers fakeRpc", () => {
  it("round-trips a Bundle account through the generated fetcher", async () => {
    const rpc = fakeRpc(
      accountsRegistry([
        [
          TEST_BUNDLE_ADDRESS,
          buildEncodedBundleBytes({
            totalShares: 123_456_789n,
            assetPrecision: 1_000_000n,
            bundleUnderlyingBalance: 42n,
            referralTiers: [
              { threshold: 100n, pfeeBps: 1_000, mfeeBps: 2_000 },
              { threshold: 500n, pfeeBps: 3_000, mfeeBps: 4_000 },
              { threshold: 0n, pfeeBps: 0, mfeeBps: 0 },
              { threshold: 0n, pfeeBps: 0, mfeeBps: 0 },
              { threshold: 0n, pfeeBps: 0, mfeeBps: 0 },
            ],
            tierCount: 2,
          }),
        ],
      ]),
    );

    const bundle = await fetchBundle(rpc, TEST_BUNDLE_ADDRESS);
    expect(bundle.address).to.equal(TEST_BUNDLE_ADDRESS);
    expect(bundle.data.totalShares).to.equal(123_456_789n);
    expect(bundle.data.assetPrecision).to.equal(1_000_000n);
    expect(bundle.data.bundleUnderlyingBalance).to.equal(42n);
    expect(bundle.data.tierCount).to.equal(2);
    expect(bundle.data.referralTiers[1]).to.deep.equal({
      threshold: 500n,
      pfeeBps: 3_000,
      mfeeBps: 4_000,
    });
  });

  it("returns exists=false for missing accounts via fetchMaybe*", async () => {
    const rpc = fakeRpc(accountsRegistry([]));
    const maybeBundle = await fetchMaybeBundle(rpc, TEST_BUNDLE_ADDRESS);
    const maybeOracle = await fetchMaybeOracleData(rpc, fakeAddress(7));
    expect(maybeBundle.exists).to.equal(false);
    expect(maybeOracle.exists).to.equal(false);
  });

  it("serves getMultipleAccounts for batch fetchers with per-slot misses", async () => {
    const present = fakeAddress(21);
    const missing = fakeAddress(22);
    const rpc = fakeRpc(
      accountsRegistry([
        [
          present,
          buildEncodedUserBundleBytes({
            shares: 55n,
            owner: TEST_USER_ADDRESS,
          }),
        ],
      ]),
    );

    const results = await fetchAllMaybeUserBundleAccount(rpc, [
      present,
      missing,
    ]);
    expect(results).to.have.length(2);
    expect(results[0].exists).to.equal(true);
    if (results[0].exists) {
      expect(results[0].data.shares).to.equal(55n);
      expect(results[0].data.owner).to.equal(TEST_USER_ADDRESS);
    }
    expect(results[1].exists).to.equal(false);
  });

  it("encodes OracleData overrides faithfully", async () => {
    const oracleAddress = fakeAddress(30);
    const rpc = fakeRpc(
      accountsRegistry([
        [
          oracleAddress,
          buildEncodedOracleDataBytes({ averageExternalEquity: 999n }),
        ],
      ]),
    );
    const oracle = await fetchMaybeOracleData(rpc, oracleAddress);
    expect(oracle.exists).to.equal(true);
    if (oracle.exists) {
      expect(oracle.data.averageExternalEquity).to.equal(999n);
    }
  });

  it("preserves ReferrerAccount size and signed net deposits", async () => {
    const referrerAccountAddress = fakeAddress(31);
    const encodedAccount = buildEncodedReferrerAccountBytes({
      referredNetDeposits: -123n,
    });
    expect(encodedAccount).to.have.length(getReferrerAccountSize());

    const rpc = fakeRpc(
      accountsRegistry([[referrerAccountAddress, encodedAccount]]),
    );
    const referrerAccount = await fetchMaybeReferrerAccount(
      rpc,
      referrerAccountAddress,
    );
    expect(referrerAccount.exists).to.equal(true);
    if (referrerAccount.exists) {
      expect(referrerAccount.data.referredNetDeposits).to.equal(-123n);
    }
  });
});
