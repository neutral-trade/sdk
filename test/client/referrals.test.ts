import { expect } from "chai";
import {
  assertIsInstructionWithAccounts,
  assertIsInstructionWithData,
  createNoopSigner,
  type AccountMeta,
  type Address,
  type Instruction,
  type InstructionWithAccounts,
  type InstructionWithData,
  type ReadonlyUint8Array,
} from "@solana/kit";

import {
  BuilderDepositAmountTooLowError,
  buildAttributedDepositTx,
  buildBuilderRegistrationTx,
  buildReferrerWithdrawRequestTx,
  calculateReferrerTierProgress,
  calculateReferrerTierScheduleProgress,
  deriveReferrerAccountForUser,
  fetchReferrerStatus,
} from "../../src/extensions/referrals";
import {
  REFERRAL_OVERRIDE_MFEE,
  REFERRAL_OVERRIDE_PFEE,
} from "../../src/extensions/fees";
import {
  findBundleTempDataPda,
  findOracleDataPda,
  findReferrerAccountPda,
  findUserBundleAccountPda,
  getSetReferralTierConfigInstruction,
  NTBUNDLE_PROGRAM_ADDRESS,
  parseInitializeBundleDepositorInstruction,
  parseRegisterReferrerInstruction,
  parseReferrerRequestWithdrawInstruction,
  parseRequestDepositInstruction,
  parseSetUserReferrerInstruction,
  parseSetReferralTierConfigInstruction,
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

type ParsableInstruction = Instruction &
  InstructionWithAccounts<ReadonlyArray<AccountMeta>> &
  InstructionWithData<ReadonlyUint8Array>;

const referrer = createNoopSigner(fakeAddress(51));
const user = createNoopSigner(TEST_USER_ADDRESS);
const MEMO_PROGRAM_ADDRESS = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

function oneTierReferralSchedule(pfeeBps: number, mfeeBps: number) {
  return [
    { threshold: 0n, pfeeBps, mfeeBps },
    ...Array.from({ length: 4 }, () => ({
      threshold: 0n,
      pfeeBps: 0,
      mfeeBps: 0,
    })),
  ];
}

function assertParsableInstruction(
  instruction: Instruction,
): asserts instruction is ParsableInstruction {
  assertIsInstructionWithAccounts(instruction);
  assertIsInstructionWithData(instruction);
}

async function expectError(
  promise: Promise<unknown>,
  expectedMessage: string,
): Promise<Error> {
  let thrownError: Error | undefined;
  try {
    await promise;
  } catch (thrownObject: unknown) {
    if (!(thrownObject instanceof Error)) {
      throw thrownObject;
    }
    thrownError = thrownObject;
  }
  expect(thrownError?.message).to.equal(expectedMessage);
  return thrownError!;
}

type ReferralRpcOptions = {
  bundleOverrides?: Parameters<typeof buildEncodedBundleBytes>[0];
  userAddress?: Address;
  userOverrides?: Parameters<typeof buildEncodedUserBundleBytes>[0];
  programAddress?: Address;
  includeRegisteredReferrer?: boolean;
  includeReferrerUserBundle?: boolean;
  referrerAccountOverrides?: Parameters<
    typeof buildEncodedReferrerAccountBytes
  >[0];
  referrerUserOverrides?: Parameters<typeof buildEncodedUserBundleBytes>[0];
  includeOracleData?: boolean;
  oracleOverrides?: Parameters<typeof buildEncodedOracleDataBytes>[0];
};

async function referralRpc(options: ReferralRpcOptions = {}) {
  const userAddress = options.userAddress ?? user.address;
  const programAddress = options.programAddress ?? NTBUNDLE_PROGRAM_ADDRESS;
  const [
    [userBundleAccount],
    [referrerAccount],
    [referrerUserBundleAccount],
    [oracleDataAddress],
  ] = await Promise.all([
    findUserBundleAccountPda(
      {
        userBundleAccountOwner: userAddress,
        bundleAccount: TEST_BUNDLE_ADDRESS,
      },
      { programAddress },
    ),
    findReferrerAccountPda(
      {
        bundleAccount: TEST_BUNDLE_ADDRESS,
        referrer: referrer.address,
      },
      { programAddress },
    ),
    findUserBundleAccountPda(
      {
        userBundleAccountOwner: referrer.address,
        bundleAccount: TEST_BUNDLE_ADDRESS,
      },
      { programAddress },
    ),
    findOracleDataPda(
      { bundleAccount: TEST_BUNDLE_ADDRESS },
      { programAddress },
    ),
  ]);
  const entries: Array<[Address, Uint8Array]> = [
    [
      TEST_BUNDLE_ADDRESS,
      buildEncodedBundleBytes({
        referrerEnabled: true,
        referralTiers: oneTierReferralSchedule(1_000, 0),
        tierCount: 1,
        ...options.bundleOverrides,
      }),
    ],
  ];
  const includeRegisteredReferrer = options.includeRegisteredReferrer ?? true;
  if (includeRegisteredReferrer) {
    entries.push([
      referrerAccount,
      buildEncodedReferrerAccountBytes({
        bundle: TEST_BUNDLE_ADDRESS,
        referrer: referrer.address,
        active: true,
        ...options.referrerAccountOverrides,
      }),
    ]);
    if (
      options.includeReferrerUserBundle !== false &&
      (referrerUserBundleAccount !== userBundleAccount ||
        options.userOverrides === undefined)
    ) {
      entries.push([
        referrerUserBundleAccount,
        buildEncodedUserBundleBytes({
          owner: referrer.address,
          ...options.referrerUserOverrides,
        }),
      ]);
    }
  }
  if (options.userOverrides) {
    entries.push([
      userBundleAccount,
      buildEncodedUserBundleBytes({
        owner: userAddress,
        ...options.userOverrides,
      }),
    ]);
  }
  if (options.includeOracleData ?? true) {
    entries.push([
      oracleDataAddress,
      buildEncodedOracleDataBytes(options.oracleOverrides),
    ]);
  }
  return {
    rpc: fakeRpc(accountsRegistry(entries), { owner: programAddress }),
    referrerAccount,
    referrerUserBundleAccount,
    userBundleAccount,
    oracleDataAddress,
  };
}

async function attributedDepositRpc(options: ReferralRpcOptions = {}) {
  return await referralRpc({ includeRegisteredReferrer: true, ...options });
}

describe("referral extensions", () => {
  describe("calculateReferrerTierProgress", () => {
    it("reports exact progress before, within, and after a tier", () => {
      expect(
        calculateReferrerTierProgress({
          referredNetDeposits: -25n,
          currentTierMinimum: 0n,
          nextTierMinimum: 100n,
        }),
      ).to.deep.equal({
        referredNetDeposits: -25n,
        currentTierMinimum: 0n,
        nextTierMinimum: 100n,
        remainingNetDeposits: 125n,
        progressBps: 0,
        isComplete: false,
      });
      expect(
        calculateReferrerTierProgress({
          referredNetDeposits: 175n,
          currentTierMinimum: 100n,
          nextTierMinimum: 300n,
        }),
      ).to.include({
        remainingNetDeposits: 125n,
        progressBps: 3_750,
        isComplete: false,
      });
      expect(
        calculateReferrerTierProgress({
          referredNetDeposits: 350n,
          currentTierMinimum: 100n,
          nextTierMinimum: 300n,
        }),
      ).to.include({
        remainingNetDeposits: 0n,
        progressBps: 10_000,
        isComplete: true,
      });
    });

    it("rejects negative, equal, and descending tier thresholds", () => {
      for (const [currentTierMinimum, nextTierMinimum] of [
        [-1n, 100n],
        [100n, 100n],
        [101n, 100n],
      ]) {
        expect(() =>
          calculateReferrerTierProgress({
            referredNetDeposits: 0n,
            currentTierMinimum,
            nextTierMinimum,
          }),
        ).to.throw("INVALID_REFERRER_TIER_THRESHOLDS");
      }
    });

    it("derives current and next tiers from the stored bundle schedule", () => {
      const referralTiers = [
        { threshold: 100n, pfeeBps: 1_000, mfeeBps: 2_000 },
        { threshold: 500n, pfeeBps: 3_000, mfeeBps: 4_000 },
        { threshold: 1_000n, pfeeBps: 5_000, mfeeBps: 6_000 },
      ];

      expect(
        calculateReferrerTierScheduleProgress({
          referredNetDeposits: -25n,
          referralTiers,
          tierCount: 3,
        }),
      ).to.include({
        currentTierIndex: undefined,
        nextTierIndex: 0,
        remainingNetDeposits: 125n,
        progressBps: 0,
        isHighestTier: false,
      });
      expect(
        calculateReferrerTierScheduleProgress({
          referredNetDeposits: 300n,
          referralTiers,
          tierCount: 3,
        }),
      ).to.include({
        currentTierIndex: 0,
        nextTierIndex: 1,
        remainingNetDeposits: 200n,
        progressBps: 5_000,
        isHighestTier: false,
      });
      expect(
        calculateReferrerTierScheduleProgress({
          referredNetDeposits: 1_500n,
          referralTiers,
          tierCount: 3,
        }),
      ).to.include({
        currentTierIndex: 2,
        nextTierIndex: undefined,
        remainingNetDeposits: 0n,
        progressBps: 10_000,
        isHighestTier: true,
      });
    });

    it("rejects malformed stored tier schedules", () => {
      expect(() =>
        calculateReferrerTierScheduleProgress({
          referredNetDeposits: 0n,
          referralTiers: [
            { threshold: 100n, pfeeBps: 1_000, mfeeBps: 2_000 },
            { threshold: 100n, pfeeBps: 3_000, mfeeBps: 4_000 },
          ],
          tierCount: 2,
        }),
      ).to.throw("INVALID_REFERRAL_TIER_SCHEDULE");
    });
  });

  describe("deriveReferrerAccountForUser", () => {
    it("matches the generated PDA helper for raw and registry vault inputs", async () => {
      const programAddress = fakeAddress(52);
      const expected = await findReferrerAccountPda(
        {
          bundleAccount: TEST_BUNDLE_ADDRESS,
          referrer: referrer.address,
        },
        { programAddress },
      );

      expect(
        await deriveReferrerAccountForUser({
          vault: TEST_BUNDLE_ADDRESS,
          referrer: referrer.address,
          programAddress,
        }),
      ).to.deep.equal(expected);
      expect(
        await deriveReferrerAccountForUser({
          vault: {
            type: "Bundle",
            vaultAddress: TEST_BUNDLE_ADDRESS,
            bundleProgramId: programAddress,
          },
          referrer: referrer.address,
        }),
      ).to.deep.equal(expected);
    });

    it("rejects a non-bundle registry entry", async () => {
      await expectError(
        deriveReferrerAccountForUser({
          vault: {
            type: "Drift",
            vaultAddress: TEST_BUNDLE_ADDRESS,
          },
          referrer: referrer.address,
        }),
        "UNSUPPORTED_VAULT_TYPE",
      );
    });
  });

  describe("generated referral tier config", () => {
    it("encodes and parses the fixed schedule input", () => {
      const instruction = getSetReferralTierConfigInstruction({
        manager: referrer,
        bundleAccount: TEST_BUNDLE_ADDRESS,
        referralTiers: [
          { threshold: 100n, pfeeBps: 1_000, mfeeBps: 2_000 },
          { threshold: 500n, pfeeBps: 3_000, mfeeBps: 4_000 },
        ],
      });
      assertParsableInstruction(instruction);

      const parsed = parseSetReferralTierConfigInstruction(instruction);
      expect(parsed.accounts.manager.address).to.equal(referrer.address);
      expect(parsed.accounts.bundleAccount.address).to.equal(
        TEST_BUNDLE_ADDRESS,
      );
      expect(parsed.data.referralTiers).to.deep.equal([
        { threshold: 100n, pfeeBps: 1_000, mfeeBps: 2_000 },
        { threshold: 500n, pfeeBps: 3_000, mfeeBps: 4_000 },
      ]);
    });
  });

  describe("buildAttributedDepositTx", () => {
    it("builds initialize, referral binding, and deposit in the required order", async () => {
      const { rpc, userBundleAccount } = await attributedDepositRpc();
      const instructions = await buildAttributedDepositTx(rpc, {
        user,
        referrer: referrer.address,
        vault: TEST_BUNDLE_ADDRESS,
        amount: 123_456n,
      });

      expect(instructions).to.have.length(4);
      for (const instruction of instructions.slice(0, 3)) {
        assertParsableInstruction(instruction);
      }
      const initialize = parseInitializeBundleDepositorInstruction(
        instructions[0] as ParsableInstruction,
      );
      const setReferrer = parseSetUserReferrerInstruction(
        instructions[1] as ParsableInstruction,
      );
      const deposit = parseRequestDepositInstruction(
        instructions[2] as ParsableInstruction,
      );
      const [expectedReferrerAccount] = await deriveReferrerAccountForUser({
        vault: TEST_BUNDLE_ADDRESS,
        referrer: referrer.address,
      });
      const [expectedReferrerUserBundle] = await findUserBundleAccountPda({
        userBundleAccountOwner: referrer.address,
        bundleAccount: TEST_BUNDLE_ADDRESS,
      });

      expect(initialize.accounts.userBundleAccount.address).to.equal(
        userBundleAccount,
      );
      expect(setReferrer.accounts.userBundleAccount.address).to.equal(
        userBundleAccount,
      );
      expect(setReferrer.accounts.referrerAccount.address).to.equal(
        expectedReferrerAccount,
      );
      expect(setReferrer.accounts.referrerUserBundleAccount.address).to.equal(
        expectedReferrerUserBundle,
      );
      expect(deposit.accounts.userBundleAccount.address).to.equal(
        userBundleAccount,
      );
      expect(deposit.data.amount).to.equal(123_456n);
    });

    it("appends a points attribution memo carrying the referrer address", async () => {
      const { rpc } = await attributedDepositRpc();
      const instructions = await buildAttributedDepositTx(rpc, {
        user,
        referrer: referrer.address,
        vault: TEST_BUNDLE_ADDRESS,
        amount: 123_456n,
      });

      expect(instructions).to.have.length(4);
      const memo = instructions[3];
      expect(memo.programAddress).to.equal(MEMO_PROGRAM_ADDRESS);
      expect(new TextDecoder().decode(memo.data as Uint8Array)).to.equal(
        `NT_REF=v1|op=register|ref=${referrer.address}`,
      );
    });

    it("resolves and trims a code and skips initialization for a virgin account", async () => {
      const { rpc } = await attributedDepositRpc({ userOverrides: {} });
      const seenCodes: Array<string> = [];
      const instructions = await buildAttributedDepositTx(rpc, {
        user,
        code: "  partner-one  ",
        resolveCode(code) {
          seenCodes.push(code);
          return referrer.address;
        },
        vault: TEST_BUNDLE_ADDRESS,
        amount: 25n,
      });

      expect(seenCodes).to.deep.equal(["partner-one"]);
      expect(instructions).to.have.length(3);
      assertParsableInstruction(instructions[0]!);
      assertParsableInstruction(instructions[1]!);
      expect(() =>
        parseSetUserReferrerInstruction(instructions[0] as ParsableInstruction),
      ).not.to.throw();
      expect(
        parseRequestDepositInstruction(instructions[1] as ParsableInstruction)
          .data.amount,
      ).to.equal(25n);
    });

    it("rejects every onchain freshness field before building a doomed transaction", async () => {
      const activityOverrides = [
        { shares: 1n },
        { pendingDeposit: 1n },
        { pendingShares: 1n },
        { estimatedPendingWithdrawalValue: 1n },
        { netDeposits: 1n },
        { totalFeeCharged: 1n },
        { lastDepositTimestamp: 1n },
      ];
      for (const userOverrides of activityOverrides) {
        const { rpc } = await attributedDepositRpc({ userOverrides });
        await expectError(
          buildAttributedDepositTx(rpc, {
            user,
            referrer: referrer.address,
            vault: TEST_BUNDLE_ADDRESS,
            amount: 1n,
          }),
          "USER_BUNDLE_ACCOUNT_HAS_ACTIVITY",
        );
      }
    });

    it("distinguishes an existing referral from other prior activity", async () => {
      const { rpc } = await attributedDepositRpc({
        userOverrides: { referrer: referrer.address },
      });
      await expectError(
        buildAttributedDepositTx(rpc, {
          user,
          referrer: referrer.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 1n,
        }),
        "REFERRAL_ALREADY_SET",
      );
    });

    it("rejects an attributed deposit below the vault minimum", async () => {
      const { rpc } = await attributedDepositRpc({
        bundleOverrides: { minDepositAmount: 100n },
      });
      const thrownError = await expectError(
        buildAttributedDepositTx(rpc, {
          user,
          referrer: referrer.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 99n,
        }),
        "BUILDER_DEPOSIT_AMOUNT_TOO_LOW",
      );

      expect(thrownError).to.be.instanceOf(BuilderDepositAmountTooLowError);
      expect(
        (thrownError as BuilderDepositAmountTooLowError)
          .requiredGrossDepositAmount,
      ).to.equal(100n);
    });

    it("rejects missing referrer accounts and depositor accounts", async () => {
      const missingReferrer = await attributedDepositRpc({
        includeRegisteredReferrer: false,
      });
      await expectError(
        buildAttributedDepositTx(missingReferrer.rpc, {
          user,
          referrer: referrer.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 1n,
        }),
        "REFERRER_NOT_REGISTERED",
      );

      const missingReferrerUser = await attributedDepositRpc({
        includeReferrerUserBundle: false,
      });
      await expectError(
        buildAttributedDepositTx(missingReferrerUser.rpc, {
          user,
          referrer: referrer.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 1n,
        }),
        "REFERRER_DEPOSIT_TOO_LOW",
      );
    });

    it("rejects inactive and under-minimum referrers", async () => {
      const inactive = await attributedDepositRpc({
        referrerAccountOverrides: { active: false },
      });
      await expectError(
        buildAttributedDepositTx(inactive.rpc, {
          user,
          referrer: referrer.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 1n,
        }),
        "REFERRER_DEACTIVATED",
      );

      const underMinimum = await attributedDepositRpc({
        bundleOverrides: { referrerMinDepositAmount: 100n },
        referrerUserOverrides: { netDeposits: 99n },
      });
      await expectError(
        buildAttributedDepositTx(underMinimum.rpc, {
          user,
          referrer: referrer.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 1n,
        }),
        "REFERRER_DEPOSIT_TOO_LOW",
      );
    });

    it("allows attribution while the live referral rates are zero", async () => {
      const zeroRates = await attributedDepositRpc({
        bundleOverrides: {
          referralTiers: oneTierReferralSchedule(0, 0),
          tierCount: 1,
        },
      });
      const instructions = await buildAttributedDepositTx(zeroRates.rpc, {
        user,
        referrer: referrer.address,
        vault: TEST_BUNDLE_ADDRESS,
        amount: 1n,
      });
      expect(instructions).to.have.length(4);
    });

    it("rejects disabled referrals, self-referrals, manager referrals, and blank codes", async () => {
      const disabled = await attributedDepositRpc({
        bundleOverrides: { referrerEnabled: false },
      });
      await expectError(
        buildAttributedDepositTx(disabled.rpc, {
          user,
          referrer: referrer.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 1n,
        }),
        "REFERRALS_DISABLED",
      );

      const valid = await attributedDepositRpc();
      await expectError(
        buildAttributedDepositTx(valid.rpc, {
          user,
          referrer: user.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 1n,
        }),
        "INVALID_REFERRER",
      );

      const manager = await attributedDepositRpc({
        bundleOverrides: { manager: referrer.address },
      });
      await expectError(
        buildAttributedDepositTx(manager.rpc, {
          user,
          referrer: referrer.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 1n,
        }),
        "INVALID_REFERRER",
      );

      await expectError(
        buildAttributedDepositTx(valid.rpc, {
          user,
          code: "   ",
          resolveCode: () => referrer.address,
          vault: TEST_BUNDLE_ADDRESS,
          amount: 1n,
        }),
        "INVALID_REFERRER_CODE",
      );
    });
  });

  describe("fetchReferrerStatus", () => {
    it("represents an unregistered referrer with bundle tier rates", async () => {
      const { rpc } = await referralRpc({
        includeRegisteredReferrer: false,
        bundleOverrides: {
          referralTiers: oneTierReferralSchedule(125, 250),
          tierCount: 1,
          referrerMinDepositAmount: 10n,
        },
      });

      const status = await fetchReferrerStatus(rpc, {
        vault: TEST_BUNDLE_ADDRESS,
        referrer: referrer.address,
      });

      expect(status).to.deep.equal({
        registered: false,
        active: false,
        hasUserBundleAccount: false,
        netDeposits: 0n,
        pendingDeposit: 0n,
        referralsEnabled: true,
        referrerMinDepositAmount: 10n,
        effectiveReferralPfeeBps: 125,
        effectiveReferralMfeeBps: 250,
        effectiveReferralTierIndex: 0,
        accruedPfeeShares: 0n,
        accruedMfeeShares: 0n,
        referredNetDeposits: 0n,
        pendingWithdrawShares: 0n,
        estimatedPendingWithdrawalValue: 0n,
        withdrawalAvailableTimestamp: 0n,
        meetsMinDeposit: false,
        meetsMinDepositAfterNetting: false,
        canBindNewUsers: false,
        needsReactivation: false,
      });
    });

    it("reports active eligibility and manager-only reactivation needs", async () => {
      const activeFixture = await referralRpc({
        bundleOverrides: {
          referralTiers: oneTierReferralSchedule(0, 200),
          tierCount: 1,
          referrerMinDepositAmount: 100n,
        },
        referrerUserOverrides: { netDeposits: 100n },
      });
      const activeStatus = await fetchReferrerStatus(activeFixture.rpc, {
        vault: TEST_BUNDLE_ADDRESS,
        referrer: referrer.address,
      });
      expect(activeStatus.registered).to.equal(true);
      expect(activeStatus.active).to.equal(true);
      expect(activeStatus.meetsMinDeposit).to.equal(true);
      expect(activeStatus.canBindNewUsers).to.equal(true);
      expect(activeStatus.needsReactivation).to.equal(false);

      const inactiveFixture = await referralRpc({
        bundleOverrides: {
          referralTiers: oneTierReferralSchedule(0, 200),
          tierCount: 1,
          referrerMinDepositAmount: 100n,
        },
        referrerAccountOverrides: { active: false },
        referrerUserOverrides: { netDeposits: 100n },
      });
      const inactiveStatus = await fetchReferrerStatus(inactiveFixture.rpc, {
        vault: TEST_BUNDLE_ADDRESS,
        referrer: referrer.address,
      });
      expect(inactiveStatus.active).to.equal(false);
      expect(inactiveStatus.canBindNewUsers).to.equal(false);
      expect(inactiveStatus.needsReactivation).to.equal(true);
    });

    it("requires the referrer's depositor account even when the minimum is zero", async () => {
      const { rpc } = await referralRpc({ includeReferrerUserBundle: false });
      const status = await fetchReferrerStatus(rpc, {
        vault: TEST_BUNDLE_ADDRESS,
        referrer: referrer.address,
      });

      expect(status.registered).to.equal(true);
      expect(status.active).to.equal(true);
      expect(status.hasUserBundleAccount).to.equal(false);
      expect(status.meetsMinDeposit).to.equal(true);
      expect(status.canBindNewUsers).to.equal(false);
    });

    it("distinguishes current qualification from post-netting qualification", async () => {
      const { rpc } = await referralRpc({
        bundleOverrides: { referrerMinDepositAmount: 100n },
        referrerUserOverrides: {
          netDeposits: -50n,
          pendingDeposit: 150n,
        },
      });
      const status = await fetchReferrerStatus(rpc, {
        vault: TEST_BUNDLE_ADDRESS,
        referrer: referrer.address,
      });

      expect(status.netDeposits).to.equal(-50n);
      expect(status.pendingDeposit).to.equal(150n);
      expect(status.meetsMinDeposit).to.equal(false);
      expect(status.meetsMinDepositAfterNetting).to.equal(true);
      expect(status.canBindNewUsers).to.equal(false);
    });

    it("resolves every effective referral-rate mask", async () => {
      const cases = [
        { flags: 0, expectedPfee: 100, expectedMfee: 200 },
        {
          flags: REFERRAL_OVERRIDE_PFEE,
          expectedPfee: 300,
          expectedMfee: 200,
        },
        {
          flags: REFERRAL_OVERRIDE_MFEE,
          expectedPfee: 100,
          expectedMfee: 400,
        },
        {
          flags: REFERRAL_OVERRIDE_PFEE | REFERRAL_OVERRIDE_MFEE,
          expectedPfee: 300,
          expectedMfee: 400,
        },
      ];

      for (const testCase of cases) {
        const { rpc } = await referralRpc({
          bundleOverrides: {
            referralTiers: oneTierReferralSchedule(100, 200),
            tierCount: 1,
          },
          referrerAccountOverrides: {
            rateOverrideFlags: testCase.flags,
            customPfeeBps: 300,
            customMfeeBps: 400,
          },
        });
        const status = await fetchReferrerStatus(rpc, {
          vault: TEST_BUNDLE_ADDRESS,
          referrer: referrer.address,
        });

        expect(status.effectiveReferralPfeeBps).to.equal(testCase.expectedPfee);
        expect(status.effectiveReferralMfeeBps).to.equal(testCase.expectedMfee);
      }
    });

    it("throws only when the bundle is missing", async () => {
      await expectError(
        fetchReferrerStatus(fakeRpc(accountsRegistry([])), {
          vault: TEST_BUNDLE_ADDRESS,
          referrer: referrer.address,
        }),
        "BUNDLE_ACCOUNT_NOT_FOUND",
      );
    });
  });

  describe("buildReferrerWithdrawRequestTx", () => {
    it("builds an all-shares claim with deterministic value and time estimates", async () => {
      const programAddress = fakeAddress(52);
      const { rpc, referrerAccount, oracleDataAddress } = await referralRpc({
        programAddress,
        bundleOverrides: {
          bundleUnderlyingBalance: 1_000n,
          totalShares: 1_000n,
          withdrawalTMin: 10n,
          withdrawalTMax: 110n,
          withdrawalCurve: 1,
          withdrawalRedemptionRequestCutoffTs: 1_100n,
          withdrawalRedemptionUnlockCurrentCycleTs: 1_200n,
          withdrawalRedemptionUnlockNextCycleTs: 1_500n,
        },
        referrerAccountOverrides: {
          active: false,
          accruedPfeeShares: 100n,
          accruedMfeeShares: 50n,
        },
        oracleOverrides: { averageExternalEquity: 500n },
      });

      const plan = await buildReferrerWithdrawRequestTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
        programAddress,
        nowUnixSeconds: 1_000n,
      });

      expect(plan.sharesToWithdraw).to.equal(150n);
      expect(plan.estimatedWithdrawalValueRaw).to.equal(225n);
      expect(plan.estimatedAvailableTimestamp).to.equal(1_200n);
      expect(plan.instructions).to.have.length(1);
      assertParsableInstruction(plan.instructions[0]!);
      const parsed = parseReferrerRequestWithdrawInstruction(
        plan.instructions[0] as ParsableInstruction,
      );
      const [expectedBundleTempData] = await findBundleTempDataPda(
        { bundleAccount: TEST_BUNDLE_ADDRESS },
        { programAddress },
      );
      expect(parsed.programAddress).to.equal(programAddress);
      expect(parsed.accounts.bundleAccount.address).to.equal(
        TEST_BUNDLE_ADDRESS,
      );
      expect(parsed.accounts.oracleData.address).to.equal(oracleDataAddress);
      expect(parsed.accounts.bundleTempData.address).to.equal(
        expectedBundleTempData,
      );
      expect(parsed.accounts.referrerAccount.address).to.equal(referrerAccount);

      const planWithoutClock = await buildReferrerWithdrawRequestTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
        programAddress,
      });
      expect(planWithoutClock.estimatedAvailableTimestamp).to.equal(undefined);
    });

    it("preflights missing and mismatched durable accounts", async () => {
      await expectError(
        buildReferrerWithdrawRequestTx(fakeRpc(accountsRegistry([])), {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "BUNDLE_ACCOUNT_NOT_FOUND",
      );

      const missingReferrer = await referralRpc({
        includeRegisteredReferrer: false,
      });
      await expectError(
        buildReferrerWithdrawRequestTx(missingReferrer.rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "REFERRER_NOT_REGISTERED",
      );

      const mismatchedReferrer = await referralRpc({
        referrerAccountOverrides: {
          bundle: fakeAddress(71),
          accruedPfeeShares: 1n,
        },
      });
      await expectError(
        buildReferrerWithdrawRequestTx(mismatchedReferrer.rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "REFERRER_ACCOUNT_MISMATCH",
      );
    });

    it("rejects pending, empty, dust, and oracle-less claims", async () => {
      const pending = await referralRpc({
        referrerAccountOverrides: {
          accruedPfeeShares: 1n,
          estimatedPendingWithdrawalValue: 1n,
        },
      });
      await expectError(
        buildReferrerWithdrawRequestTx(pending.rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "WITHDRAWAL_ALREADY_PENDING",
      );

      const empty = await referralRpc();
      await expectError(
        buildReferrerWithdrawRequestTx(empty.rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "NO_ACCRUED_REFERRAL_SHARES",
      );

      const zeroShares = await referralRpc({
        bundleOverrides: { totalShares: 0n },
        referrerAccountOverrides: { accruedPfeeShares: 1n },
      });
      await expectError(
        buildReferrerWithdrawRequestTx(zeroShares.rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "WITHDRAWAL_VALUE_TOO_SMALL",
      );

      const dust = await referralRpc({
        bundleOverrides: {
          bundleUnderlyingBalance: 1n,
          totalShares: 100n,
        },
        referrerAccountOverrides: { accruedPfeeShares: 1n },
      });
      await expectError(
        buildReferrerWithdrawRequestTx(dust.rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "WITHDRAWAL_VALUE_TOO_SMALL",
      );

      const missingOracle = await referralRpc({
        includeOracleData: false,
        bundleOverrides: {
          bundleUnderlyingBalance: 100n,
          totalShares: 100n,
        },
        referrerAccountOverrides: { accruedPfeeShares: 1n },
      });
      await expectError(
        buildReferrerWithdrawRequestTx(missingOracle.rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "ORACLE_DATA_NOT_FOUND",
      );
    });
  });

  describe("buildBuilderRegistrationTx", () => {
    it("builds atomic initialization and registration when the minimum is zero", async () => {
      const { rpc, userBundleAccount } = await referralRpc({
        userAddress: referrer.address,
        includeRegisteredReferrer: false,
      });
      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      });

      expect(plan.kind).to.equal("single-transaction");
      if (plan.kind !== "single-transaction") {
        throw new Error("expected single transaction");
      }
      expect(plan.instructions).to.have.length(2);
      for (const instruction of plan.instructions) {
        assertParsableInstruction(instruction);
      }
      expect(
        parseInitializeBundleDepositorInstruction(
          plan.instructions[0] as ParsableInstruction,
        ).accounts.userBundleAccount.address,
      ).to.equal(userBundleAccount);
      expect(
        parseRegisterReferrerInstruction(
          plan.instructions[1] as ParsableInstruction,
        ).accounts.referrerUserBundleAccount.address,
      ).to.equal(userBundleAccount);
    });

    it("rejects registration plans for a deactivated referrer", async () => {
      const { rpc } = await referralRpc({
        userAddress: referrer.address,
        userOverrides: {},
        includeRegisteredReferrer: true,
        referrerAccountOverrides: { active: false },
      });

      await expectError(
        buildBuilderRegistrationTx(rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "REFERRER_DEACTIVATED",
      );
    });

    it("places an optional zero-minimum deposit before atomic registration", async () => {
      const { rpc } = await referralRpc({
        userAddress: referrer.address,
        includeRegisteredReferrer: false,
      });
      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
        depositAmount: 50n,
      });

      expect(plan.kind).to.equal("single-transaction");
      if (plan.kind !== "single-transaction") {
        throw new Error("expected single transaction");
      }
      expect(plan.instructions).to.have.length(3);
      for (const instruction of plan.instructions) {
        assertParsableInstruction(instruction);
      }
      expect(
        parseRequestDepositInstruction(
          plan.instructions[1] as ParsableInstruction,
        ).data.amount,
      ).to.equal(50n);
      expect(() =>
        parseRegisterReferrerInstruction(
          plan.instructions[2] as ParsableInstruction,
        ),
      ).not.to.throw();
    });

    it("rejects an optional atomic deposit below the vault minimum", async () => {
      const { rpc } = await referralRpc({
        userAddress: referrer.address,
        includeRegisteredReferrer: false,
        bundleOverrides: { minDepositAmount: 100n },
      });
      const thrownError = await expectError(
        buildBuilderRegistrationTx(rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
          depositAmount: 99n,
        }),
        "BUILDER_DEPOSIT_AMOUNT_TOO_LOW",
      );

      expect(thrownError).to.be.instanceOf(BuilderDepositAmountTooLowError);
      expect(
        (thrownError as BuilderDepositAmountTooLowError)
          .requiredGrossDepositAmount,
      ).to.equal(100n);
    });

    it("returns fee-grossed deposit and post-netting registration steps", async () => {
      const { rpc } = await referralRpc({
        userAddress: referrer.address,
        includeRegisteredReferrer: false,
        bundleOverrides: {
          depositFee: 100,
          referrerMinDepositAmount: 10_000n,
        },
      });
      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      });

      expect(plan.kind).to.equal("netting-required");
      if (plan.kind !== "netting-required") {
        throw new Error("expected netting plan");
      }
      expect(plan.grossDepositAmount).to.equal(10_102n);
      expect(plan.requiredGrossDepositAmount).to.equal(10_102n);
      expect(plan.referrerMinDepositAmount).to.equal(10_000n);
      expect(plan.depositInstructions).to.have.length(2);
      expect(plan.registrationInstructions).to.have.length(1);
      for (const instruction of [
        ...plan.depositInstructions,
        ...plan.registrationInstructions,
      ]) {
        assertParsableInstruction(instruction);
      }
      expect(
        parseRequestDepositInstruction(
          plan.depositInstructions[1] as ParsableInstruction,
        ).data.amount,
      ).to.equal(10_102n);
      expect(() =>
        parseRegisterReferrerInstruction(
          plan.registrationInstructions[0] as ParsableInstruction,
        ),
      ).not.to.throw();
    });

    it("honors the general deposit minimum and a custom deposit-fee override", async () => {
      const { rpc } = await referralRpc({
        userAddress: referrer.address,
        includeRegisteredReferrer: false,
        bundleOverrides: {
          depositFee: 100,
          minDepositAmount: 20_000n,
          referrerMinDepositAmount: 10_000n,
        },
        userOverrides: {
          feeOverrideFlags: 1,
          customDepositFeeBps: 500,
          netDeposits: 1_000n,
          pendingDeposit: 2_000n,
        },
      });
      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      });

      expect(plan.kind).to.equal("netting-required");
      if (plan.kind !== "netting-required") {
        throw new Error("expected netting plan");
      }
      expect(plan.requiredGrossDepositAmount).to.equal(20_000n);
      expect(plan.grossDepositAmount).to.equal(20_000n);
    });

    it("reports the required amount instead of silently increasing a short deposit", async () => {
      const { rpc } = await referralRpc({
        userAddress: referrer.address,
        includeRegisteredReferrer: false,
        bundleOverrides: {
          depositFee: 100,
          referrerMinDepositAmount: 10_000n,
        },
      });
      const thrownError = await expectError(
        buildBuilderRegistrationTx(rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
          depositAmount: 10_101n,
        }),
        "BUILDER_DEPOSIT_AMOUNT_TOO_LOW",
      );

      expect(thrownError).to.be.instanceOf(BuilderDepositAmountTooLowError);
      expect(
        (thrownError as BuilderDepositAmountTooLowError)
          .requiredGrossDepositAmount,
      ).to.equal(10_102n);
    });

    it("registers atomically once existing net deposits meet a nonzero minimum", async () => {
      const { rpc } = await referralRpc({
        userAddress: referrer.address,
        includeRegisteredReferrer: false,
        bundleOverrides: { referrerMinDepositAmount: 10_000n },
        userOverrides: { netDeposits: 10_000n },
      });
      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      });

      expect(plan.kind).to.equal("single-transaction");
      if (plan.kind !== "single-transaction") {
        throw new Error("expected single transaction");
      }
      expect(plan.instructions).to.have.length(1);
      assertParsableInstruction(plan.instructions[0]!);
      expect(() =>
        parseRegisterReferrerInstruction(
          plan.instructions[0] as ParsableInstruction,
        ),
      ).not.to.throw();
    });

    it("returns only the wait-and-register step when pending net covers the minimum", async () => {
      const { rpc } = await referralRpc({
        userAddress: referrer.address,
        includeRegisteredReferrer: false,
        bundleOverrides: { referrerMinDepositAmount: 10_000n },
        userOverrides: { pendingDeposit: 10_000n },
      });
      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      });

      expect(plan.kind).to.equal("netting-required");
      if (plan.kind !== "netting-required") {
        throw new Error("expected netting plan");
      }
      expect(plan.depositInstructions).to.deep.equal([]);
      expect(plan.grossDepositAmount).to.equal(0n);
      expect(plan.registrationInstructions).to.have.length(1);
    });

    it("enforces the vault minimum for an optional top-up while netting is pending", async () => {
      const { rpc } = await referralRpc({
        userAddress: referrer.address,
        includeRegisteredReferrer: false,
        bundleOverrides: {
          minDepositAmount: 100n,
          referrerMinDepositAmount: 10_000n,
        },
        userOverrides: { pendingDeposit: 10_000n },
      });
      const thrownError = await expectError(
        buildBuilderRegistrationTx(rpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
          depositAmount: 99n,
        }),
        "BUILDER_DEPOSIT_AMOUNT_TOO_LOW",
      );

      expect(thrownError).to.be.instanceOf(BuilderDepositAmountTooLowError);
      expect(
        (thrownError as BuilderDepositAmountTooLowError)
          .requiredGrossDepositAmount,
      ).to.equal(100n);
    });

    it("reports a missing bundle and rejects invalid optional amounts first", async () => {
      const emptyRpc = fakeRpc(accountsRegistry([]));
      await expectError(
        buildBuilderRegistrationTx(emptyRpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
        }),
        "BUNDLE_ACCOUNT_NOT_FOUND",
      );
      await expectError(
        buildBuilderRegistrationTx(emptyRpc, {
          referrer,
          vault: TEST_BUNDLE_ADDRESS,
          depositAmount: 0n,
        }),
        "INVALID_AMOUNT_RAW",
      );
    });
  });
});
