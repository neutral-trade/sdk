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

import { findAssociatedTokenPda } from "../../src/extensions/ata";
import {
  buildDepositInstructions,
  buildRequestSwitchInstructions,
  buildRequestWithdrawInstruction,
} from "../../src/extensions/flows";
import { computeWithdrawalShares } from "../../src/extensions/math";
import {
  findBundleTempDataPda,
  findOracleDataPda,
  findPendingBundleAssetAuthorityPda,
  findUserBundleAccountPda,
  getRequestDepositInstructionAsync,
  NTBUNDLE_PROGRAM_ADDRESS,
  parseInitializeBundleDepositorInstruction,
  parseRequestBundleSwitchInstruction,
  parseRequestDepositInstruction,
  parseRequestWithdrawalInstruction,
} from "../../src/generated";
import {
  accountsRegistry,
  buildEncodedBundleBytes,
  buildEncodedOracleDataBytes,
  buildEncodedUserBundleBytes,
  fakeAddress,
  fakeRpc,
  TEST_ASSET_MINT_ADDRESS,
  TEST_BUNDLE_ADDRESS,
  TEST_TARGET_BUNDLE_ADDRESS,
  TEST_TREASURY_ADDRESS,
  TEST_USER_ADDRESS,
} from "./testHelpers";

type ParsableInstruction = Instruction &
  InstructionWithAccounts<ReadonlyArray<AccountMeta>> &
  InstructionWithData<ReadonlyUint8Array>;

const user = createNoopSigner(TEST_USER_ADDRESS);

function assertParsableInstruction(
  instruction: Instruction,
): asserts instruction is ParsableInstruction {
  assertIsInstructionWithAccounts(instruction);
  assertIsInstructionWithData(instruction);
}

async function expectError(
  promise: Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
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
}

async function deriveBundlePdas(
  bundleAccount: Address,
  programAddress: Address = NTBUNDLE_PROGRAM_ADDRESS,
) {
  const [
    userBundleAccountPda,
    oracleDataPda,
    bundleTempDataPda,
    pendingAuthorityPda,
  ] = await Promise.all([
    findUserBundleAccountPda(
      {
        userBundleAccountOwner: user.address,
        bundleAccount,
      },
      { programAddress },
    ),
    findOracleDataPda({ bundleAccount }, { programAddress }),
    findBundleTempDataPda({ bundleAccount }, { programAddress }),
    findPendingBundleAssetAuthorityPda({ bundleAccount }, { programAddress }),
  ]);
  return {
    userBundleAccount: userBundleAccountPda[0],
    oracleData: oracleDataPda[0],
    bundleTempData: bundleTempDataPda[0],
    pendingAuthority: pendingAuthorityPda[0],
  };
}

describe("instruction flow extensions", () => {
  describe("buildDepositInstructions", () => {
    it("builds initialization and deposit instructions for a fresh user", async () => {
      const amountRaw = 123_456n;
      const assetAddress = fakeAddress(31);
      const treasuryAccount = fakeAddress(32);
      const pdas = await deriveBundlePdas(TEST_BUNDLE_ADDRESS);
      const [expectedUserTokenAccount] = await findAssociatedTokenPda({
        owner: user.address,
        mint: assetAddress,
      });
      const [expectedPendingDepositTokenAccount] = await findAssociatedTokenPda(
        {
          owner: pdas.pendingAuthority,
          mint: assetAddress,
        },
      );
      const rpc = fakeRpc(
        accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            buildEncodedBundleBytes({ assetAddress, treasuryAccount }),
          ],
        ]),
      );

      const instructions = await buildDepositInstructions(rpc, {
        user,
        bundleAccount: TEST_BUNDLE_ADDRESS,
        amountRaw,
      });

      expect(instructions).to.have.length(2);
      const initializeInstruction = instructions[0]!;
      const depositInstruction = instructions[1]!;
      assertParsableInstruction(initializeInstruction);
      assertParsableInstruction(depositInstruction);
      const parsedInitialize = parseInitializeBundleDepositorInstruction(
        initializeInstruction,
      );
      const parsedDeposit = parseRequestDepositInstruction(depositInstruction);

      expect(parsedInitialize.accounts.bundleAccount.address).to.equal(
        TEST_BUNDLE_ADDRESS,
      );
      expect(parsedInitialize.accounts.userBundleAccount.address).to.equal(
        pdas.userBundleAccount,
      );
      expect(parsedDeposit.accounts.userTokenAccount.address).to.equal(
        expectedUserTokenAccount,
      );
      expect(
        parsedDeposit.accounts.pendingDepositTokenAccount.address,
      ).to.equal(expectedPendingDepositTokenAccount);
      expect(parsedDeposit.accounts.userBundleAccount.address).to.equal(
        pdas.userBundleAccount,
      );
      expect(parsedDeposit.accounts.oracleData.address).to.equal(
        pdas.oracleData,
      );
      expect(parsedDeposit.accounts.bundleTempData.address).to.equal(
        pdas.bundleTempData,
      );
      expect(
        parsedDeposit.accounts.pendingBundleAssetAuthority.address,
      ).to.equal(pdas.pendingAuthority);
      expect(parsedDeposit.accounts.treasuryAccount.address).to.equal(
        treasuryAccount,
      );
      expect(parsedDeposit.accounts.assetAddress.address).to.equal(
        assetAddress,
      );
      expect(parsedDeposit.data.amount).to.equal(amountRaw);
    });

    it("skips initialization for an existing user", async () => {
      const pdas = await deriveBundlePdas(TEST_BUNDLE_ADDRESS);
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, buildEncodedBundleBytes()],
          [
            pdas.userBundleAccount,
            buildEncodedUserBundleBytes({ owner: user.address }),
          ],
        ]),
      );

      const instructions = await buildDepositInstructions(rpc, {
        user,
        bundleAccount: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
      });

      expect(instructions).to.have.length(1);
      assertParsableInstruction(instructions[0]!);
      expect(
        parseRequestDepositInstruction(instructions[0]!).data.amount,
      ).to.equal(1n);
    });

    it("matches generated default account resolution on the default program", async () => {
      const userTokenAccount = fakeAddress(33);
      const rpc = fakeRpc(
        accountsRegistry([[TEST_BUNDLE_ADDRESS, buildEncodedBundleBytes()]]),
      );
      const explicitInstructions = await buildDepositInstructions(rpc, {
        user,
        bundleAccount: TEST_BUNDLE_ADDRESS,
        amountRaw: 25n,
        userTokenAccount,
      });
      const rawInstruction = await getRequestDepositInstructionAsync({
        user,
        userTokenAccount,
        treasuryAccount: TEST_TREASURY_ADDRESS,
        assetAddress: TEST_ASSET_MINT_ADDRESS,
        bundleAccount: TEST_BUNDLE_ADDRESS,
        amount: 25n,
      });
      const explicitInstruction = explicitInstructions[1]!;
      assertParsableInstruction(explicitInstruction);

      expect(
        explicitInstruction.accounts.map((account) => account.address),
      ).to.deep.equal(
        rawInstruction.accounts.map((account) => account.address),
      );
    });

    it("derives every program PDA from a program address override", async () => {
      const programAddress = fakeAddress(40);
      const overridePdas = await deriveBundlePdas(
        TEST_BUNDLE_ADDRESS,
        programAddress,
      );
      const defaultPdas = await deriveBundlePdas(TEST_BUNDLE_ADDRESS);
      const rpc = fakeRpc(
        accountsRegistry([[TEST_BUNDLE_ADDRESS, buildEncodedBundleBytes()]]),
        { owner: programAddress },
      );

      const instructions = await buildDepositInstructions(rpc, {
        user,
        bundleAccount: TEST_BUNDLE_ADDRESS,
        amountRaw: 99n,
        programAddress,
      });
      const depositInstruction = instructions[1]!;
      assertParsableInstruction(depositInstruction);
      const parsedDeposit = parseRequestDepositInstruction(depositInstruction);

      expect(depositInstruction.programAddress).to.equal(programAddress);
      expect(parsedDeposit.accounts.userBundleAccount.address).to.equal(
        overridePdas.userBundleAccount,
      );
      expect(parsedDeposit.accounts.oracleData.address).to.equal(
        overridePdas.oracleData,
      );
      expect(parsedDeposit.accounts.bundleTempData.address).to.equal(
        overridePdas.bundleTempData,
      );
      expect(
        parsedDeposit.accounts.pendingBundleAssetAuthority.address,
      ).to.equal(overridePdas.pendingAuthority);
      expect(overridePdas.userBundleAccount).not.to.equal(
        defaultPdas.userBundleAccount,
      );
      expect(overridePdas.oracleData).not.to.equal(defaultPdas.oracleData);
      expect(overridePdas.bundleTempData).not.to.equal(
        defaultPdas.bundleTempData,
      );
      expect(overridePdas.pendingAuthority).not.to.equal(
        defaultPdas.pendingAuthority,
      );
    });

    it("reports a missing bundle account", async () => {
      await expectError(
        buildDepositInstructions(fakeRpc(accountsRegistry([])), {
          user,
          bundleAccount: TEST_BUNDLE_ADDRESS,
          amountRaw: 1n,
        }),
        "BUNDLE_ACCOUNT_NOT_FOUND",
      );
    });
  });

  describe("buildRequestWithdrawInstruction", () => {
    async function withdrawalRpc(options: {
      userShares: bigint;
      totalShares?: bigint;
      bundleUnderlyingBalance?: bigint;
      averageExternalEquity?: bigint;
      includeUser?: boolean;
    }) {
      const pdas = await deriveBundlePdas(TEST_BUNDLE_ADDRESS);
      const entries: Array<[Address, Uint8Array]> = [
        [
          TEST_BUNDLE_ADDRESS,
          buildEncodedBundleBytes({
            totalShares: options.totalShares ?? 2_000n,
            bundleUnderlyingBalance: options.bundleUnderlyingBalance ?? 800n,
          }),
        ],
        [
          pdas.oracleData,
          buildEncodedOracleDataBytes({
            averageExternalEquity: options.averageExternalEquity ?? 200n,
          }),
        ],
      ];
      if (options.includeUser !== false) {
        entries.push([
          pdas.userBundleAccount,
          buildEncodedUserBundleBytes({
            owner: user.address,
            shares: options.userShares,
          }),
        ]);
      }
      return { rpc: fakeRpc(accountsRegistry(entries)) };
    }

    it("encodes the computed shares for a partial withdrawal", async () => {
      const amountRaw = 75n;
      const expectedShares = computeWithdrawalShares({
        amountRaw,
        userShares: 400n,
        totalEquity: 1_000n,
        totalShares: 2_000n,
      });
      const instruction = await buildRequestWithdrawInstruction(
        (await withdrawalRpc({ userShares: 400n })).rpc,
        { user, bundleAccount: TEST_BUNDLE_ADDRESS, amountRaw },
      );
      assertParsableInstruction(instruction);

      expect(
        parseRequestWithdrawalInstruction(instruction).data.sharesAmount,
      ).to.equal(expectedShares);
    });

    it("encodes the full position at and above its token value", async () => {
      for (const amountRaw of [200n, 250n]) {
        const instruction = await buildRequestWithdrawInstruction(
          (await withdrawalRpc({ userShares: 400n })).rpc,
          { user, bundleAccount: TEST_BUNDLE_ADDRESS, amountRaw },
        );
        assertParsableInstruction(instruction);
        expect(
          parseRequestWithdrawalInstruction(instruction).data.sharesAmount,
        ).to.equal(400n);
      }
    });

    it("reports a missing user bundle account", async () => {
      await expectError(
        buildRequestWithdrawInstruction(
          (
            await withdrawalRpc({
              userShares: 400n,
              includeUser: false,
            })
          ).rpc,
          { user, bundleAccount: TEST_BUNDLE_ADDRESS, amountRaw: 75n },
        ),
        "USER_BUNDLE_ACCOUNT_NOT_FOUND",
      );
    });

    it("rejects a withdrawal that rounds down to zero shares", async () => {
      await expectError(
        buildRequestWithdrawInstruction(
          (
            await withdrawalRpc({
              userShares: 1n,
              totalShares: 1n,
              bundleUnderlyingBalance: 1_000n,
              averageExternalEquity: 0n,
            })
          ).rpc,
          { user, bundleAccount: TEST_BUNDLE_ADDRESS, amountRaw: 1n },
        ),
        "ZERO_WITHDRAWAL_SHARES",
      );
    });

    it("reports missing bundle and oracle accounts", async () => {
      const pdas = await deriveBundlePdas(TEST_BUNDLE_ADDRESS);
      const userBytes = buildEncodedUserBundleBytes({
        owner: user.address,
        shares: 400n,
      });
      await expectError(
        buildRequestWithdrawInstruction(
          fakeRpc(
            accountsRegistry([
              [pdas.oracleData, buildEncodedOracleDataBytes()],
              [pdas.userBundleAccount, userBytes],
            ]),
          ),
          { user, bundleAccount: TEST_BUNDLE_ADDRESS, amountRaw: 1n },
        ),
        "BUNDLE_ACCOUNT_NOT_FOUND",
      );
      await expectError(
        buildRequestWithdrawInstruction(
          fakeRpc(
            accountsRegistry([
              [TEST_BUNDLE_ADDRESS, buildEncodedBundleBytes()],
              [pdas.userBundleAccount, userBytes],
            ]),
          ),
          { user, bundleAccount: TEST_BUNDLE_ADDRESS, amountRaw: 1n },
        ),
        "ORACLE_DATA_NOT_FOUND",
      );
    });
  });

  describe("buildRequestSwitchInstructions", () => {
    async function switchRpc(options: {
      includeTargetUser?: boolean;
      targetAssetAddress?: Address;
      sourceUserShares?: bigint;
      sourceTotalShares?: bigint;
    }) {
      const sourcePdas = await deriveBundlePdas(TEST_BUNDLE_ADDRESS);
      const targetPdas = await deriveBundlePdas(TEST_TARGET_BUNDLE_ADDRESS);
      const entries: Array<[Address, Uint8Array]> = [
        [
          TEST_BUNDLE_ADDRESS,
          buildEncodedBundleBytes({
            assetAddress: TEST_ASSET_MINT_ADDRESS,
            bundleUnderlyingBalance: 800n,
            totalShares: options.sourceTotalShares ?? 2_000n,
          }),
        ],
        [
          TEST_TARGET_BUNDLE_ADDRESS,
          buildEncodedBundleBytes({
            assetAddress: options.targetAssetAddress ?? TEST_ASSET_MINT_ADDRESS,
          }),
        ],
        [
          sourcePdas.oracleData,
          buildEncodedOracleDataBytes({ averageExternalEquity: 200n }),
        ],
        [
          sourcePdas.userBundleAccount,
          buildEncodedUserBundleBytes({
            owner: user.address,
            shares: options.sourceUserShares ?? 400n,
          }),
        ],
      ];
      if (options.includeTargetUser) {
        entries.push([
          targetPdas.userBundleAccount,
          buildEncodedUserBundleBytes({ owner: user.address }),
        ]);
      }
      return {
        rpc: fakeRpc(accountsRegistry(entries)),
        sourcePdas,
        targetPdas,
      };
    }

    it("initializes the target user before requesting a switch", async () => {
      const { rpc, sourcePdas, targetPdas } = await switchRpc({});
      const instructions = await buildRequestSwitchInstructions(rpc, {
        user,
        sourceBundleAccount: TEST_BUNDLE_ADDRESS,
        targetBundleAccount: TEST_TARGET_BUNDLE_ADDRESS,
        amountRaw: 75n,
      });

      expect(instructions).to.have.length(2);
      const initializeInstruction = instructions[0]!;
      const switchInstruction = instructions[1]!;
      assertParsableInstruction(initializeInstruction);
      assertParsableInstruction(switchInstruction);
      const parsedInitialize = parseInitializeBundleDepositorInstruction(
        initializeInstruction,
      );
      const parsedSwitch =
        parseRequestBundleSwitchInstruction(switchInstruction);

      expect(parsedInitialize.accounts.bundleAccount.address).to.equal(
        TEST_TARGET_BUNDLE_ADDRESS,
      );
      expect(parsedInitialize.accounts.userBundleAccount.address).to.equal(
        targetPdas.userBundleAccount,
      );
      expect(parsedSwitch.accounts.bundleAccount.address).to.equal(
        TEST_BUNDLE_ADDRESS,
      );
      expect(parsedSwitch.accounts.userBundleAccount.address).to.equal(
        sourcePdas.userBundleAccount,
      );
      expect(parsedSwitch.accounts.oracleData.address).to.equal(
        sourcePdas.oracleData,
      );
      expect(parsedSwitch.accounts.bundleTempData.address).to.equal(
        sourcePdas.bundleTempData,
      );
      expect(parsedSwitch.accounts.targetBundleAccount.address).to.equal(
        TEST_TARGET_BUNDLE_ADDRESS,
      );
      expect(parsedSwitch.accounts.targetUserBundleAccount.address).to.equal(
        targetPdas.userBundleAccount,
      );
      expect(parsedSwitch.data.sharesAmount).to.equal(150n);
    });

    it("skips target initialization when the target user exists", async () => {
      const { rpc } = await switchRpc({ includeTargetUser: true });
      const instructions = await buildRequestSwitchInstructions(rpc, {
        user,
        sourceBundleAccount: TEST_BUNDLE_ADDRESS,
        targetBundleAccount: TEST_TARGET_BUNDLE_ADDRESS,
        amountRaw: 75n,
      });

      expect(instructions).to.have.length(1);
      assertParsableInstruction(instructions[0]!);
      expect(
        parseRequestBundleSwitchInstruction(instructions[0]!).data.sharesAmount,
      ).to.equal(150n);
    });

    it("rejects identical source and target bundle accounts", async () => {
      await expectError(
        buildRequestSwitchInstructions(fakeRpc(accountsRegistry([])), {
          user,
          sourceBundleAccount: TEST_BUNDLE_ADDRESS,
          targetBundleAccount: TEST_BUNDLE_ADDRESS,
          amountRaw: 1n,
        }),
        "SOURCE_TARGET_IDENTICAL",
      );
    });

    it("rejects bundles with different asset addresses", async () => {
      const { rpc } = await switchRpc({ targetAssetAddress: fakeAddress(41) });
      await expectError(
        buildRequestSwitchInstructions(rpc, {
          user,
          sourceBundleAccount: TEST_BUNDLE_ADDRESS,
          targetBundleAccount: TEST_TARGET_BUNDLE_ADDRESS,
          amountRaw: 75n,
        }),
        "ASSET_MINT_MISMATCH",
      );
    });

    it("rejects a switch that rounds down to zero shares", async () => {
      const { rpc } = await switchRpc({
        sourceUserShares: 1n,
        sourceTotalShares: 1n,
      });
      await expectError(
        buildRequestSwitchInstructions(rpc, {
          user,
          sourceBundleAccount: TEST_BUNDLE_ADDRESS,
          targetBundleAccount: TEST_TARGET_BUNDLE_ADDRESS,
          amountRaw: 1n,
        }),
        "ZERO_WITHDRAWAL_SHARES",
      );
    });
  });

  it("rejects invalid raw amounts before all other flow work", async () => {
    const rpc = fakeRpc(accountsRegistry([]));
    await expectError(
      buildDepositInstructions(rpc, {
        user,
        bundleAccount: TEST_BUNDLE_ADDRESS,
        amountRaw: 0n,
      }),
      "INVALID_AMOUNT_RAW",
    );
    await expectError(
      buildRequestWithdrawInstruction(rpc, {
        user,
        bundleAccount: TEST_BUNDLE_ADDRESS,
        amountRaw: 0n,
      }),
      "INVALID_AMOUNT_RAW",
    );
    await expectError(
      buildRequestSwitchInstructions(rpc, {
        user,
        sourceBundleAccount: TEST_BUNDLE_ADDRESS,
        targetBundleAccount: TEST_BUNDLE_ADDRESS,
        amountRaw: 0n,
      }),
      "INVALID_AMOUNT_RAW",
    );
  });
});
