import type { Address } from "@solana/kit";
import { expect } from "chai";

import {
  computeUserBundleBalance,
  fetchUserBundleBalance,
  fetchUserBundleBalances,
} from "../../src/extensions/balances";
import {
  findOracleDataPda,
  findUserBundleAccountPda,
  getBundleDecoder,
  getOracleDataDecoder,
  getUserBundleAccountDecoder,
  NTBUNDLE_PROGRAM_ADDRESS,
} from "../../src/generated";
import {
  accountsRegistry,
  buildEncodedBundleBytes,
  buildEncodedOracleDataBytes,
  buildEncodedUserBundleBytes,
  fakeAddress,
  fakeRpc,
} from "./testHelpers";

const SECONDS_IN_YEAR = 31_536_000n;

async function deriveRequestPdas(
  bundleAccount: Address,
  user: Address,
  programAddress: Address = NTBUNDLE_PROGRAM_ADDRESS,
) {
  const [[oraclePda], [userPda]] = await Promise.all([
    findOracleDataPda({ bundleAccount }, { programAddress }),
    findUserBundleAccountPda(
      { userBundleAccountOwner: user, bundleAccount },
      { programAddress },
    ),
  ]);
  return { oraclePda, userPda };
}

describe("balance extensions", () => {
  it("computes exact raw values and one year of management fees", () => {
    const bundleAccount = fakeAddress(10);
    const user = fakeAddress(11);
    const assetAddress = fakeAddress(12);
    const bundle = getBundleDecoder().decode(
      buildEncodedBundleBytes({
        bundleUnderlyingBalance: 2_000_000_000_000n,
        totalShares: 1_000_000_000_000n,
        assetPrecision: 1_000_000n,
        assetDecimals: 6,
        assetAddress,
        managementFeeBps: 200,
      }),
    );
    const oracleData = getOracleDataDecoder().decode(
      buildEncodedOracleDataBytes({
        averageExternalEquity: 1_000_000_000_000n,
      }),
    );
    const userBundle = getUserBundleAccountDecoder().decode(
      buildEncodedUserBundleBytes({
        owner: user,
        shares: 500_000_000_000n,
        netDeposits: 1_000_000_000_000n,
        pendingDeposit: 25_000_000n,
        totalFeeCharged: 75_000_000n,
        hwmPerShare: 0n,
        lastManagementFeeTimestamp: 100n,
      }),
    );

    const result = computeUserBundleBalance({
      bundleAccount,
      user,
      bundle,
      oracleData,
      userBundle,
      nowUnixSeconds: 100n + SECONDS_IN_YEAR,
    });

    expect(result).to.deep.equal({
      bundleAccount,
      user,
      sharesRaw: 500_000_000_000n,
      balanceRaw: 1_500_000_000_000n,
      netDepositsRaw: 1_000_000_000_000n,
      earningsRaw: 500_000_000_000n,
      pendingDepositRaw: 25_000_000n,
      feesPaidRaw: 75_000_000n,
      pendingFees: {
        managementFeeShares: 10_000_000_000n,
        performanceFeeShares: 0n,
        totalFeeShares: 10_000_000_000n,
        feeValueRaw: 30_000_000_000n,
        sharePrice: 3_000_000n,
      },
      hwmPerShare: 0n,
      totalEquityRaw: 3_000_000_000_000n,
      totalShares: 1_000_000_000_000n,
      assetPrecision: 1_000_000n,
      assetDecimals: 6,
      assetAddress,
    });
  });

  it("round-trips signed net deposits and calculates negative earnings", () => {
    const bundle = getBundleDecoder().decode(
      buildEncodedBundleBytes({
        bundleUnderlyingBalance: 1_000n,
        totalShares: 1_000n,
      }),
    );
    const oracleData = getOracleDataDecoder().decode(
      buildEncodedOracleDataBytes(),
    );
    const negativeDepositsUser = getUserBundleAccountDecoder().decode(
      buildEncodedUserBundleBytes({ shares: 500n, netDeposits: -200n }),
    );
    const negativeEarningsUser = getUserBundleAccountDecoder().decode(
      buildEncodedUserBundleBytes({ shares: 500n, netDeposits: 800n }),
    );
    const sharedArgs = {
      bundleAccount: fakeAddress(13),
      user: fakeAddress(14),
      bundle,
      oracleData,
      nowUnixSeconds: 1n,
    };

    const negativeDeposits = computeUserBundleBalance({
      ...sharedArgs,
      userBundle: negativeDepositsUser,
    });
    const negativeEarnings = computeUserBundleBalance({
      ...sharedArgs,
      userBundle: negativeEarningsUser,
    });

    expect(negativeDeposits.netDepositsRaw).to.equal(-200n);
    expect(negativeDeposits.balanceRaw).to.equal(500n);
    expect(negativeDeposits.earningsRaw).to.equal(700n);
    expect(negativeEarnings.earningsRaw).to.equal(-300n);
  });

  it("returns an aligned null for a missing user account in three batches", async () => {
    const bundleAccount = fakeAddress(20);
    const firstUser = fakeAddress(21);
    const missingUser = fakeAddress(22);
    const { oraclePda, userPda } = await deriveRequestPdas(
      bundleAccount,
      firstUser,
    );
    const { userPda: missingUserPda } = await deriveRequestPdas(
      bundleAccount,
      missingUser,
    );
    const baseRpc = fakeRpc(
      accountsRegistry([
        [
          bundleAccount,
          buildEncodedBundleBytes({
            bundleUnderlyingBalance: 1_000n,
            totalShares: 1_000n,
          }),
        ],
        [
          oraclePda,
          buildEncodedOracleDataBytes({ averageExternalEquity: 500n }),
        ],
        [
          userPda,
          buildEncodedUserBundleBytes({ owner: firstUser, shares: 200n }),
        ],
      ]),
    );
    const requestedAddressBatches: Array<Array<Address>> = [];
    const rpc = new Proxy(baseRpc, {
      get(target, property, receiver) {
        if (property === "getMultipleAccounts") {
          return (addresses: Array<Address>) => {
            requestedAddressBatches.push(addresses);
            return target.getMultipleAccounts(addresses);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const results = await fetchUserBundleBalances(rpc, {
      requests: [
        { bundleAccount, user: firstUser },
        { bundleAccount, user: missingUser },
      ],
      nowUnixSeconds: 1n,
    });

    expect(results).to.have.length(2);
    expect(results[0]?.balanceRaw).to.equal(300n);
    expect(results[1]).to.equal(null);
    expect(requestedAddressBatches).to.deep.equal([
      [bundleAccount, bundleAccount],
      [oraclePda, oraclePda],
      [userPda, missingUserPda],
    ]);
  });

  it("keeps duplicate bundle requests aligned with distinct users", async () => {
    const bundleAccount = fakeAddress(23);
    const firstUser = fakeAddress(24);
    const secondUser = fakeAddress(25);
    const { oraclePda, userPda: firstUserPda } = await deriveRequestPdas(
      bundleAccount,
      firstUser,
    );
    const { userPda: secondUserPda } = await deriveRequestPdas(
      bundleAccount,
      secondUser,
    );
    const rpc = fakeRpc(
      accountsRegistry([
        [
          bundleAccount,
          buildEncodedBundleBytes({
            bundleUnderlyingBalance: 2_000n,
            totalShares: 1_000n,
          }),
        ],
        [oraclePda, buildEncodedOracleDataBytes()],
        [
          firstUserPda,
          buildEncodedUserBundleBytes({
            owner: firstUser,
            shares: 100n,
            pendingDeposit: 11n,
          }),
        ],
        [
          secondUserPda,
          buildEncodedUserBundleBytes({
            owner: secondUser,
            shares: 300n,
            pendingDeposit: 22n,
          }),
        ],
      ]),
    );

    const results = await fetchUserBundleBalances(rpc, {
      requests: [
        { bundleAccount, user: firstUser },
        { bundleAccount, user: secondUser },
      ],
      nowUnixSeconds: 1n,
    });

    expect(results[0]?.user).to.equal(firstUser);
    expect(results[0]?.balanceRaw).to.equal(200n);
    expect(results[0]?.pendingDepositRaw).to.equal(11n);
    expect(results[1]?.user).to.equal(secondUser);
    expect(results[1]?.balanceRaw).to.equal(600n);
    expect(results[1]?.pendingDepositRaw).to.equal(22n);
  });

  it("threads a program address override through both PDA derivations", async () => {
    const programAddress = fakeAddress(50);
    const bundleAccount = fakeAddress(26);
    const user = fakeAddress(27);
    const { oraclePda, userPda } = await deriveRequestPdas(
      bundleAccount,
      user,
      programAddress,
    );
    const rpc = fakeRpc(
      accountsRegistry([
        [
          bundleAccount,
          buildEncodedBundleBytes({
            bundleUnderlyingBalance: 900n,
            totalShares: 900n,
          }),
        ],
        [oraclePda, buildEncodedOracleDataBytes()],
        [userPda, buildEncodedUserBundleBytes({ owner: user, shares: 300n })],
      ]),
      { owner: programAddress },
    );

    const overridden = await fetchUserBundleBalances(rpc, {
      requests: [{ bundleAccount, user }],
      programAddress,
      nowUnixSeconds: 1n,
    });
    const defaultProgram = await fetchUserBundleBalances(rpc, {
      requests: [{ bundleAccount, user }],
      nowUnixSeconds: 1n,
    });

    expect(overridden[0]?.balanceRaw).to.equal(300n);
    expect(defaultProgram).to.deep.equal([null]);
  });

  it("fetches one balance and returns null when the user account is absent", async () => {
    const bundleAccount = fakeAddress(28);
    const user = fakeAddress(29);
    const missingUser = fakeAddress(30);
    const { oraclePda, userPda } = await deriveRequestPdas(bundleAccount, user);
    const rpc = fakeRpc(
      accountsRegistry([
        [
          bundleAccount,
          buildEncodedBundleBytes({
            bundleUnderlyingBalance: 700n,
            totalShares: 700n,
          }),
        ],
        [oraclePda, buildEncodedOracleDataBytes()],
        [userPda, buildEncodedUserBundleBytes({ owner: user, shares: 350n })],
      ]),
    );

    const found = await fetchUserBundleBalance(rpc, {
      bundleAccount,
      user,
      nowUnixSeconds: 1n,
    });
    const missing = await fetchUserBundleBalance(rpc, {
      bundleAccount,
      user: missingUser,
      nowUnixSeconds: 1n,
    });

    expect(found?.balanceRaw).to.equal(350n);
    expect(missing).to.equal(null);
  });

  it("honors nowUnixSeconds when estimating pending fees", async () => {
    const bundleAccount = fakeAddress(31);
    const user = fakeAddress(32);
    const { oraclePda, userPda } = await deriveRequestPdas(bundleAccount, user);
    const rpc = fakeRpc(
      accountsRegistry([
        [
          bundleAccount,
          buildEncodedBundleBytes({
            bundleUnderlyingBalance: 10_000n,
            totalShares: 10_000n,
            managementFeeBps: 1_000,
          }),
        ],
        [oraclePda, buildEncodedOracleDataBytes()],
        [
          userPda,
          buildEncodedUserBundleBytes({
            owner: user,
            shares: 10_000n,
            lastManagementFeeTimestamp: 10n,
          }),
        ],
      ]),
    );

    const afterOneYear = await fetchUserBundleBalance(rpc, {
      bundleAccount,
      user,
      nowUnixSeconds: 10n + SECONDS_IN_YEAR,
    });
    const afterTwoYears = await fetchUserBundleBalance(rpc, {
      bundleAccount,
      user,
      nowUnixSeconds: 10n + 2n * SECONDS_IN_YEAR,
    });

    expect(afterOneYear?.pendingFees.managementFeeShares).to.equal(1_000n);
    expect(afterTwoYears?.pendingFees.managementFeeShares).to.equal(2_000n);
  });
});
