import { expect } from "chai";

import {
  fetchAllMaybeUserBundleAccount,
  fetchBundle,
  fetchMaybeBundle,
  fetchMaybeOracleData,
} from "../../src/generated";
import {
  accountsRegistry,
  buildEncodedBundleBytes,
  buildEncodedOracleDataBytes,
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
          }),
        ],
      ]),
    );

    const bundle = await fetchBundle(rpc, TEST_BUNDLE_ADDRESS);
    expect(bundle.address).to.equal(TEST_BUNDLE_ADDRESS);
    expect(bundle.data.totalShares).to.equal(123_456_789n);
    expect(bundle.data.assetPrecision).to.equal(1_000_000n);
    expect(bundle.data.bundleUnderlyingBalance).to.equal(42n);
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
});
