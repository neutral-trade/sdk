import {
  address,
  type Address,
  type Instruction,
  type ProgramDerivedAddress,
  type TransactionSigner,
} from "@solana/kit";

import {
  fetchMaybeBundle,
  fetchMaybeOracleData,
  fetchMaybeReferrerAccount,
  fetchMaybeUserBundleAccount,
  findBundleTempDataPda,
  findOracleDataPda,
  findReferrerAccountPda,
  findUserBundleAccountPda,
  getInitializeBundleDepositorInstructionAsync,
  getRegisterReferrerInstructionAsync,
  getReferrerRequestWithdrawInstructionAsync,
  getSetUserReferrerInstructionAsync,
  NTBUNDLE_PROGRAM_ADDRESS,
  type Bundle,
  type ReferrerAccount,
  type ReferralTier,
  type UserBundleAccount,
} from "../generated";
import { buildDepositInstructionContext } from "./deposit";
import {
  FEE_OVERRIDE_DEPOSIT,
  MAX_REFERRAL_TIERS,
  resolveEffectiveReferralRates,
} from "./fees";
import {
  BPS_DENOMINATOR,
  assertValidAmountRaw,
  calculateAssetsFromShares,
  calculateGrossDepositAmount,
  estimateWithdrawalAvailableTimestamp,
  estimateWithdrawalCooldownSeconds,
  totalEquityRaw,
} from "./math";
import type { ExtensionsRpc } from "./rpc";

/**
 * Builders preflight durable account state that would deterministically fail
 * or silently no-op. Transient keeper-cycle state, including pause windows and
 * oracle freshness, remains authoritative onchain because it can race a build.
 */
const DEFAULT_PUBLIC_KEY =
  "11111111111111111111111111111111" as Address<"11111111111111111111111111111111">;

const MEMO_PROGRAM_ADDRESS =
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" as Address<"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr">;

/**
 * Points attribution rides the same transaction as the on-chain referral
 * binding, so a builder wires one call and gets both. The memo carries the
 * referrer address because an instruction builder has no code to carry and no
 * business making an HTTP call to look one up.
 */
function buildPointsAttributionMemoInstruction(referrer: Address): Instruction {
  return {
    programAddress: MEMO_PROGRAM_ADDRESS,
    data: new TextEncoder().encode(`NT_REF=v1|op=register|ref=${referrer}`),
  };
}

export type BundleVaultInput =
  | Address
  | {
      vaultAddress: string;
      bundleProgramId?: string;
      type?: string;
    };

export type ReferrerCodeResolver = (code: string) => Address | Promise<Address>;

type ReferrerInput =
  | {
      referrer: Address;
      code?: never;
      resolveCode?: never;
    }
  | {
      referrer?: never;
      code: string;
      resolveCode: ReferrerCodeResolver;
    };

export type BuildAttributedDepositTxParams = ReferrerInput & {
  user: TransactionSigner;
  vault: BundleVaultInput;
  amount: bigint;
  userTokenAccount?: Address;
  programAddress?: Address;
};

export type BuildBuilderRegistrationTxParams = {
  referrer: TransactionSigner;
  vault: BundleVaultInput;
  depositAmount?: bigint;
  userTokenAccount?: Address;
  programAddress?: Address;
};

export type SingleTransactionBuilderRegistration = {
  kind: "single-transaction";
  instructions: Array<Instruction>;
};

export type NettingRequiredBuilderRegistration = {
  kind: "netting-required";
  depositInstructions: Array<Instruction>;
  registrationInstructions: [Instruction];
  grossDepositAmount: bigint;
  requiredGrossDepositAmount: bigint;
  referrerMinDepositAmount: bigint;
};

export type BuilderRegistrationPlan =
  | SingleTransactionBuilderRegistration
  | NettingRequiredBuilderRegistration;

export type BuildReferrerWithdrawRequestTxParams = {
  referrer: TransactionSigner;
  vault: BundleVaultInput;
  programAddress?: Address;
  /** Unix seconds; when present, the plan estimates the availability timestamp. */
  nowUnixSeconds?: number | bigint;
};

export type ReferrerWithdrawRequestPlan = {
  instructions: Array<Instruction>;
  sharesToWithdraw: bigint;
  estimatedWithdrawalValueRaw: bigint;
  estimatedAvailableTimestamp: bigint | undefined;
};

export type ReferrerStatus = {
  registered: boolean;
  active: boolean;
  hasUserBundleAccount: boolean;
  netDeposits: bigint;
  pendingDeposit: bigint;
  referralsEnabled: boolean;
  referrerMinDepositAmount: bigint;
  effectiveReferralPfeeBps: number;
  effectiveReferralMfeeBps: number;
  effectiveReferralTierIndex: number | undefined;
  accruedPfeeShares: bigint;
  accruedMfeeShares: bigint;
  referredNetDeposits: bigint;
  pendingWithdrawShares: bigint;
  estimatedPendingWithdrawalValue: bigint;
  withdrawalAvailableTimestamp: bigint;
  meetsMinDeposit: boolean;
  meetsMinDepositAfterNetting: boolean;
  canBindNewUsers: boolean;
  needsReactivation: boolean;
};

export type ReferrerTierProgress = {
  referredNetDeposits: bigint;
  currentTierMinimum: bigint;
  nextTierMinimum: bigint;
  remainingNetDeposits: bigint;
  progressBps: number;
  isComplete: boolean;
};

export type ReferrerTierScheduleProgress = {
  referredNetDeposits: bigint;
  currentTierIndex: number | undefined;
  currentTier: ReferralTier | undefined;
  nextTierIndex: number | undefined;
  nextTier: ReferralTier | undefined;
  remainingNetDeposits: bigint;
  progressBps: number;
  isHighestTier: boolean;
};

/**
 * Converts the signed aggregate from one `ReferrerAccount` read into exact
 * basis-point progress between two product-supplied tier thresholds.
 */
export function calculateReferrerTierProgress(args: {
  referredNetDeposits: bigint;
  currentTierMinimum: bigint;
  nextTierMinimum: bigint;
}): ReferrerTierProgress {
  if (
    args.currentTierMinimum < 0n ||
    args.nextTierMinimum <= args.currentTierMinimum
  ) {
    throw new Error("INVALID_REFERRER_TIER_THRESHOLDS");
  }

  const progressFloor =
    args.referredNetDeposits > args.currentTierMinimum
      ? args.referredNetDeposits
      : args.currentTierMinimum;
  const progressCeiling =
    progressFloor < args.nextTierMinimum ? progressFloor : args.nextTierMinimum;
  const tierSpan = args.nextTierMinimum - args.currentTierMinimum;
  const progressBps = Number(
    ((progressCeiling - args.currentTierMinimum) * BPS_DENOMINATOR) / tierSpan,
  );
  const remainingNetDeposits =
    args.referredNetDeposits >= args.nextTierMinimum
      ? 0n
      : args.nextTierMinimum - args.referredNetDeposits;

  return {
    ...args,
    remainingNetDeposits,
    progressBps,
    isComplete: remainingNetDeposits === 0n,
  };
}

/** Resolves current/next tier display state directly from one bundle read. */
export function calculateReferrerTierScheduleProgress(args: {
  referredNetDeposits: bigint;
  referralTiers: Array<ReferralTier>;
  tierCount: number;
}): ReferrerTierScheduleProgress {
  if (
    !Number.isInteger(args.tierCount) ||
    args.tierCount < 0 ||
    args.tierCount > MAX_REFERRAL_TIERS ||
    args.tierCount > args.referralTiers.length
  ) {
    throw new Error("INVALID_REFERRAL_TIER_SCHEDULE");
  }

  const referralTiers = args.referralTiers.slice(0, args.tierCount);
  for (let tierIndex = 0; tierIndex < referralTiers.length; tierIndex += 1) {
    const referralTier = referralTiers[tierIndex];
    const previousTier = referralTiers[tierIndex - 1];
    if (
      referralTier === undefined ||
      referralTier.threshold < 0n ||
      (previousTier !== undefined &&
        referralTier.threshold <= previousTier.threshold)
    ) {
      throw new Error("INVALID_REFERRAL_TIER_SCHEDULE");
    }
  }

  let currentTierIndex: number | undefined;
  for (let tierIndex = 0; tierIndex < referralTiers.length; tierIndex += 1) {
    const referralTier = referralTiers[tierIndex];
    if (
      referralTier === undefined ||
      args.referredNetDeposits < referralTier.threshold
    ) {
      break;
    }
    currentTierIndex = tierIndex;
  }

  const nextTierIndex =
    currentTierIndex === undefined
      ? referralTiers.length > 0
        ? 0
        : undefined
      : currentTierIndex + 1 < referralTiers.length
        ? currentTierIndex + 1
        : undefined;
  const currentTier =
    currentTierIndex === undefined
      ? undefined
      : referralTiers[currentTierIndex];
  const nextTier =
    nextTierIndex === undefined ? undefined : referralTiers[nextTierIndex];

  if (nextTier === undefined) {
    return {
      referredNetDeposits: args.referredNetDeposits,
      currentTierIndex,
      currentTier,
      nextTierIndex,
      nextTier,
      remainingNetDeposits: 0n,
      progressBps: currentTier === undefined ? 0 : Number(BPS_DENOMINATOR),
      isHighestTier: currentTier !== undefined,
    };
  }

  const remainingNetDeposits =
    args.referredNetDeposits >= nextTier.threshold
      ? 0n
      : nextTier.threshold - args.referredNetDeposits;
  let progressBps = 0;
  const currentThreshold = currentTier?.threshold ?? 0n;
  const tierSpan = nextTier.threshold - currentThreshold;
  if (tierSpan > 0n && args.referredNetDeposits > currentThreshold) {
    const progress = args.referredNetDeposits - currentThreshold;
    progressBps = Number(
      ((progress < tierSpan ? progress : tierSpan) * BPS_DENOMINATOR) /
        tierSpan,
    );
  }

  return {
    referredNetDeposits: args.referredNetDeposits,
    currentTierIndex,
    currentTier,
    nextTierIndex,
    nextTier,
    remainingNetDeposits,
    progressBps,
    isHighestTier: false,
  };
}

export class BuilderDepositAmountTooLowError extends Error {
  readonly requiredGrossDepositAmount: bigint;

  constructor(requiredGrossDepositAmount: bigint) {
    super("BUILDER_DEPOSIT_AMOUNT_TOO_LOW");
    this.name = "BuilderDepositAmountTooLowError";
    this.requiredGrossDepositAmount = requiredGrossDepositAmount;
  }
}

type ResolvedBundleVault = {
  bundleAccount: Address;
  programAddress: Address;
};

function resolveBundleVault(
  vault: BundleVaultInput,
  programAddressOverride?: Address,
): ResolvedBundleVault {
  if (typeof vault === "string") {
    return {
      bundleAccount: address(vault),
      programAddress: programAddressOverride ?? NTBUNDLE_PROGRAM_ADDRESS,
    };
  }
  if (vault.type !== undefined && vault.type !== "Bundle") {
    throw new Error("UNSUPPORTED_VAULT_TYPE");
  }
  return {
    bundleAccount: address(vault.vaultAddress),
    programAddress:
      programAddressOverride ??
      (vault.bundleProgramId
        ? address(vault.bundleProgramId)
        : NTBUNDLE_PROGRAM_ADDRESS),
  };
}

async function resolveReferrer(params: ReferrerInput): Promise<Address> {
  if (params.referrer !== undefined) {
    return params.referrer;
  }
  const code = params.code.trim();
  if (code.length === 0) {
    throw new Error("INVALID_REFERRER_CODE");
  }
  return await params.resolveCode(code);
}

async function resolveReferrerState(
  rpc: ExtensionsRpc,
  params: {
    bundleAccount: Address;
    referrer: Address;
    programAddress: Address;
  },
) {
  const [[referrerAccountAddress], [referrerUserBundleAccountAddress]] =
    await Promise.all([
      findReferrerAccountPda(
        {
          bundleAccount: params.bundleAccount,
          referrer: params.referrer,
        },
        { programAddress: params.programAddress },
      ),
      findUserBundleAccountPda(
        {
          userBundleAccountOwner: params.referrer,
          bundleAccount: params.bundleAccount,
        },
        { programAddress: params.programAddress },
      ),
    ]);
  const [referrerAccount, referrerUserBundleAccount] = await Promise.all([
    fetchMaybeReferrerAccount(rpc, referrerAccountAddress),
    fetchMaybeUserBundleAccount(rpc, referrerUserBundleAccountAddress),
  ]);

  return {
    referrerAccountAddress,
    referrerUserBundleAccountAddress,
    referrerAccount,
    referrerUserBundleAccount,
  };
}

function assertValidReferrer(
  bundle: Pick<Bundle, "manager" | "referrerEnabled">,
  referrer: Address,
): void {
  if (!bundle.referrerEnabled) {
    throw new Error("REFERRALS_DISABLED");
  }
  if (referrer === DEFAULT_PUBLIC_KEY || referrer === bundle.manager) {
    throw new Error("INVALID_REFERRER");
  }
}

function assertVirginUserBundleAccount(userBundle: UserBundleAccount): void {
  if (userBundle.referrer !== DEFAULT_PUBLIC_KEY) {
    throw new Error("REFERRAL_ALREADY_SET");
  }
  if (
    userBundle.shares !== 0n ||
    userBundle.pendingDeposit !== 0n ||
    userBundle.pendingShares !== 0n ||
    userBundle.estimatedPendingWithdrawalValue !== 0n ||
    userBundle.netDeposits !== 0n ||
    userBundle.totalFeeCharged !== 0n ||
    userBundle.lastDepositTimestamp !== 0n
  ) {
    throw new Error("USER_BUNDLE_ACCOUNT_HAS_ACTIVITY");
  }
}

function assertEligibleReferrerForAttribution(args: {
  bundle: Pick<Bundle, "referrerMinDepositAmount">;
  referrerAccount: ReferrerAccount | undefined;
  referrerUserBundle: UserBundleAccount | undefined;
}): void {
  if (!args.referrerAccount) {
    throw new Error("REFERRER_NOT_REGISTERED");
  }
  if (!args.referrerAccount.active) {
    throw new Error("REFERRER_DEACTIVATED");
  }
  if (
    !args.referrerUserBundle ||
    args.referrerUserBundle.netDeposits < args.bundle.referrerMinDepositAmount
  ) {
    throw new Error("REFERRER_DEPOSIT_TOO_LOW");
  }
}

function calculateNetDepositAmount(
  grossDepositAmount: bigint,
  depositFeeBps: number,
): bigint {
  const feeNumerator = grossDepositAmount * BigInt(depositFeeBps);
  const feeAmount = (feeNumerator + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;
  return grossDepositAmount - feeAmount;
}

function getEffectiveDepositFeeBps(
  bundle: Pick<Bundle, "depositFee">,
  userBundle: UserBundleAccount | undefined,
): number {
  if (
    userBundle &&
    (userBundle.feeOverrideFlags & FEE_OVERRIDE_DEPOSIT) !== 0
  ) {
    return userBundle.customDepositFeeBps;
  }
  return bundle.depositFee;
}

/**
 * Derives `ReferrerAccount` from the referrer stored for a user. Builders,
 * keepers, and apps can use this path instead of reproducing PDA seeds.
 */
export async function deriveReferrerAccountForUser(params: {
  vault: BundleVaultInput;
  referrer: Address;
  programAddress?: Address;
}): Promise<ProgramDerivedAddress> {
  const resolvedVault = resolveBundleVault(params.vault, params.programAddress);
  return await findReferrerAccountPda(
    {
      bundleAccount: resolvedVault.bundleAccount,
      referrer: params.referrer,
    },
    { programAddress: resolvedVault.programAddress },
  );
}

/**
 * Reads raw referrer state and the two eligibility verdicts used by partner
 * onboarding surfaces. Missing referrer accounts are represented in the
 * result; only a missing bundle is an error.
 */
export async function fetchReferrerStatus(
  rpc: ExtensionsRpc,
  params: {
    vault: BundleVaultInput;
    referrer: Address;
    programAddress?: Address;
  },
): Promise<ReferrerStatus> {
  const resolvedVault = resolveBundleVault(params.vault, params.programAddress);
  const [bundle, referrerState] = await Promise.all([
    fetchMaybeBundle(rpc, resolvedVault.bundleAccount),
    resolveReferrerState(rpc, {
      bundleAccount: resolvedVault.bundleAccount,
      referrer: params.referrer,
      programAddress: resolvedVault.programAddress,
    }),
  ]);
  if (!bundle.exists) {
    throw new Error("BUNDLE_ACCOUNT_NOT_FOUND");
  }

  const referrerAccount = referrerState.referrerAccount.exists
    ? referrerState.referrerAccount.data
    : undefined;
  const referrerUserBundleAccount = referrerState.referrerUserBundleAccount
    .exists
    ? referrerState.referrerUserBundleAccount.data
    : undefined;
  const rates = resolveEffectiveReferralRates(bundle.data, referrerAccount);
  const registered = referrerAccount !== undefined;
  const active = referrerAccount?.active ?? false;
  const netDeposits = referrerUserBundleAccount?.netDeposits ?? 0n;
  const pendingDeposit = referrerUserBundleAccount?.pendingDeposit ?? 0n;
  const hasUserBundleAccount = referrerUserBundleAccount !== undefined;
  const meetsMinDeposit = netDeposits >= bundle.data.referrerMinDepositAmount;
  const meetsMinDepositAfterNetting =
    netDeposits + pendingDeposit >= bundle.data.referrerMinDepositAmount;
  return {
    registered,
    active,
    hasUserBundleAccount,
    netDeposits,
    pendingDeposit,
    referralsEnabled: bundle.data.referrerEnabled,
    referrerMinDepositAmount: bundle.data.referrerMinDepositAmount,
    effectiveReferralPfeeBps: rates.referralPfeeBps,
    effectiveReferralMfeeBps: rates.referralMfeeBps,
    effectiveReferralTierIndex: rates.referralTierIndex,
    accruedPfeeShares: referrerAccount?.accruedPfeeShares ?? 0n,
    accruedMfeeShares: referrerAccount?.accruedMfeeShares ?? 0n,
    referredNetDeposits: referrerAccount?.referredNetDeposits ?? 0n,
    pendingWithdrawShares: referrerAccount?.pendingWithdrawShares ?? 0n,
    estimatedPendingWithdrawalValue:
      referrerAccount?.estimatedPendingWithdrawalValue ?? 0n,
    withdrawalAvailableTimestamp:
      referrerAccount?.withdrawalAvailableTimestamp ?? 0n,
    meetsMinDeposit,
    meetsMinDepositAfterNetting,
    canBindNewUsers:
      registered &&
      active &&
      bundle.data.referrerEnabled &&
      hasUserBundleAccount &&
      meetsMinDeposit,
    needsReactivation: registered && !active,
  };
}

/**
 * Builds the only valid first-deposit ordering: initialize (when needed),
 * bind the referrer, then request the deposit. Fee settlement uses the
 * referrer's live effective rates, including later tier-schedule and override
 * changes that raise, lower, or zero either component.
 *
 * The returned instructions belong in one transaction. A user account with
 * any prior activity cannot be attributed under the current program rules.
 * The builder also fetches the referrer's registration and depositor accounts
 * to verify active status and the net-deposit threshold.
 * Deterministic eligibility failures use stable error messages; deposits below
 * the vault minimum throw `BuilderDepositAmountTooLowError`.
 *
 * One transaction: bind the on-chain referrer for fee split, request the
 * deposit, and emit the points attribution memo. Atomic — a partial link is
 * not possible.
 */
export async function buildAttributedDepositTx(
  rpc: ExtensionsRpc,
  params: BuildAttributedDepositTxParams,
): Promise<Array<Instruction>> {
  assertValidAmountRaw(params.amount);
  const resolvedVault = resolveBundleVault(params.vault, params.programAddress);
  const [referrer, depositContext] = await Promise.all([
    resolveReferrer(params),
    buildDepositInstructionContext(rpc, {
      user: params.user,
      bundleAccount: resolvedVault.bundleAccount,
      amountRaw: params.amount,
      userTokenAccount: params.userTokenAccount,
      programAddress: resolvedVault.programAddress,
    }),
  ]);

  if (params.amount < depositContext.bundle.minDepositAmount) {
    throw new BuilderDepositAmountTooLowError(
      depositContext.bundle.minDepositAmount,
    );
  }
  assertValidReferrer(depositContext.bundle, referrer);
  if (referrer === params.user.address) {
    throw new Error("INVALID_REFERRER");
  }
  if (depositContext.userBundle) {
    assertVirginUserBundleAccount(depositContext.userBundle);
  }

  const referrerState = await resolveReferrerState(rpc, {
    bundleAccount: resolvedVault.bundleAccount,
    referrer,
    programAddress: resolvedVault.programAddress,
  });
  assertEligibleReferrerForAttribution({
    bundle: depositContext.bundle,
    referrerAccount: referrerState.referrerAccount.exists
      ? referrerState.referrerAccount.data
      : undefined,
    referrerUserBundle: referrerState.referrerUserBundleAccount.exists
      ? referrerState.referrerUserBundleAccount.data
      : undefined,
  });
  const setUserReferrerInstruction = await getSetUserReferrerInstructionAsync(
    {
      user: params.user,
      bundleAccount: resolvedVault.bundleAccount,
      userBundleAccount: depositContext.userBundleAccount,
      referrerAccount: referrerState.referrerAccountAddress,
      referrerUserBundleAccount: referrerState.referrerUserBundleAccountAddress,
    },
    { programAddress: resolvedVault.programAddress },
  );

  const instructions: Array<Instruction> = [];
  if (depositContext.initializeInstruction) {
    instructions.push(depositContext.initializeInstruction);
  }
  instructions.push(
    setUserReferrerInstruction,
    depositContext.requestInstruction,
    buildPointsAttributionMemoInstruction(referrer),
  );
  return instructions;
}

/**
 * Builds referrer registration as one transaction when current net deposits
 * already meet the vault requirement. Otherwise it returns a deposit step and
 * a registration step that must be submitted after keeper netting processes
 * the deposit. A caller-specified `depositAmount` is never increased silently.
 *
 * A zero `referrerMinDepositAmount` is the capital-light configuration: a new
 * partner can initialize and register atomically without depositing. With a
 * nonzero minimum, `netDeposits` changes only during keeper processing, so an
 * unqualified partner cannot deposit and register in the same transaction.
 * The generated gross amount covers both the effective deposit fee and the
 * vault's ordinary minimum deposit amount. `depositInstructions` is empty when
 * an existing pending net deposit already covers the referral minimum. An
 * existing inactive registration throws `REFERRER_DEACTIVATED` because the
 * registration instruction handler does not reactivate it.
 */
export async function buildBuilderRegistrationTx(
  rpc: ExtensionsRpc,
  params: BuildBuilderRegistrationTxParams,
): Promise<BuilderRegistrationPlan> {
  if (params.depositAmount !== undefined) {
    assertValidAmountRaw(params.depositAmount);
  }
  const resolvedVault = resolveBundleVault(params.vault, params.programAddress);
  const [bundle, referrerState] = await Promise.all([
    fetchMaybeBundle(rpc, resolvedVault.bundleAccount),
    resolveReferrerState(rpc, {
      bundleAccount: resolvedVault.bundleAccount,
      referrer: params.referrer.address,
      programAddress: resolvedVault.programAddress,
    }),
  ]);
  if (!bundle.exists) {
    throw new Error("BUNDLE_ACCOUNT_NOT_FOUND");
  }
  assertValidReferrer(bundle.data, params.referrer.address);

  if (
    referrerState.referrerAccount.exists &&
    !referrerState.referrerAccount.data.active
  ) {
    throw new Error("REFERRER_DEACTIVATED");
  }
  const userBundle = referrerState.referrerUserBundleAccount.exists
    ? referrerState.referrerUserBundleAccount.data
    : undefined;
  const currentNetDeposits = userBundle?.netDeposits ?? 0n;
  const referrerMinDepositAmount = bundle.data.referrerMinDepositAmount;
  const registrationInstruction = await getRegisterReferrerInstructionAsync(
    {
      referrer: params.referrer,
      referrerAccount: referrerState.referrerAccountAddress,
      bundleAccount: resolvedVault.bundleAccount,
      referrerUserBundleAccount: referrerState.referrerUserBundleAccountAddress,
    },
    { programAddress: resolvedVault.programAddress },
  );

  if (currentNetDeposits >= referrerMinDepositAmount) {
    if (
      params.depositAmount !== undefined &&
      params.depositAmount < bundle.data.minDepositAmount
    ) {
      throw new BuilderDepositAmountTooLowError(bundle.data.minDepositAmount);
    }
    const instructions: Array<Instruction> = [];
    if (params.depositAmount !== undefined) {
      const depositContext = await buildDepositInstructionContext(rpc, {
        user: params.referrer,
        bundleAccount: resolvedVault.bundleAccount,
        amountRaw: params.depositAmount,
        userTokenAccount: params.userTokenAccount,
        programAddress: resolvedVault.programAddress,
      });
      if (depositContext.initializeInstruction) {
        instructions.push(depositContext.initializeInstruction);
      }
      instructions.push(depositContext.requestInstruction);
    } else if (!userBundle) {
      instructions.push(
        await getInitializeBundleDepositorInstructionAsync(
          {
            payer: params.referrer,
            authority: params.referrer,
            bundleAccount: resolvedVault.bundleAccount,
            userBundleAccount: referrerState.referrerUserBundleAccountAddress,
          },
          { programAddress: resolvedVault.programAddress },
        ),
      );
    }
    instructions.push(registrationInstruction);
    return { kind: "single-transaction", instructions };
  }

  const pendingNetDeposit = userBundle?.pendingDeposit ?? 0n;
  const remainingNetDeposit =
    currentNetDeposits + pendingNetDeposit >= referrerMinDepositAmount
      ? 0n
      : referrerMinDepositAmount - currentNetDeposits - pendingNetDeposit;
  const effectiveDepositFeeBps = getEffectiveDepositFeeBps(
    bundle.data,
    userBundle,
  );
  const grossAmountForReferralMinimum = calculateGrossDepositAmount({
    minimumNetAmount: remainingNetDeposit,
    depositFeeBps: effectiveDepositFeeBps,
  });
  const requiredGrossDepositAmount =
    grossAmountForReferralMinimum === 0n && params.depositAmount === undefined
      ? 0n
      : grossAmountForReferralMinimum > bundle.data.minDepositAmount
        ? grossAmountForReferralMinimum
        : bundle.data.minDepositAmount;
  if (
    params.depositAmount !== undefined &&
    params.depositAmount < requiredGrossDepositAmount
  ) {
    throw new BuilderDepositAmountTooLowError(requiredGrossDepositAmount);
  }
  const grossDepositAmount = params.depositAmount ?? requiredGrossDepositAmount;
  const depositInstructions: Array<Instruction> = [];
  if (grossDepositAmount > 0n) {
    const depositContext = await buildDepositInstructionContext(rpc, {
      user: params.referrer,
      bundleAccount: resolvedVault.bundleAccount,
      amountRaw: grossDepositAmount,
      userTokenAccount: params.userTokenAccount,
      programAddress: resolvedVault.programAddress,
    });
    if (depositContext.initializeInstruction) {
      depositInstructions.push(depositContext.initializeInstruction);
    }
    depositInstructions.push(depositContext.requestInstruction);

    const expectedNetDeposits =
      currentNetDeposits +
      pendingNetDeposit +
      calculateNetDepositAmount(grossDepositAmount, effectiveDepositFeeBps);
    if (expectedNetDeposits < referrerMinDepositAmount) {
      throw new BuilderDepositAmountTooLowError(requiredGrossDepositAmount);
    }
  }

  return {
    kind: "netting-required",
    depositInstructions,
    registrationInstructions: [registrationInstruction],
    grossDepositAmount,
    requiredGrossDepositAmount,
    referrerMinDepositAmount,
  };
}

/**
 * Builds the partner-signed request that moves all accrued referral shares
 * into the keeper settlement queue. Deactivation does not remove claim rights.
 * Pause windows and oracle freshness remain transaction-time checks.
 */
export async function buildReferrerWithdrawRequestTx(
  rpc: ExtensionsRpc,
  params: BuildReferrerWithdrawRequestTxParams,
): Promise<ReferrerWithdrawRequestPlan> {
  const resolvedVault = resolveBundleVault(params.vault, params.programAddress);
  const [
    [referrerAccountAddress],
    [oracleDataAddress],
    [bundleTempDataAddress],
  ] = await Promise.all([
    findReferrerAccountPda(
      {
        bundleAccount: resolvedVault.bundleAccount,
        referrer: params.referrer.address,
      },
      { programAddress: resolvedVault.programAddress },
    ),
    findOracleDataPda(
      { bundleAccount: resolvedVault.bundleAccount },
      { programAddress: resolvedVault.programAddress },
    ),
    findBundleTempDataPda(
      { bundleAccount: resolvedVault.bundleAccount },
      { programAddress: resolvedVault.programAddress },
    ),
  ]);
  const [bundle, referrerAccount, oracleData] = await Promise.all([
    fetchMaybeBundle(rpc, resolvedVault.bundleAccount),
    fetchMaybeReferrerAccount(rpc, referrerAccountAddress),
    fetchMaybeOracleData(rpc, oracleDataAddress),
  ]);

  if (!bundle.exists) {
    throw new Error("BUNDLE_ACCOUNT_NOT_FOUND");
  }
  if (!referrerAccount.exists) {
    throw new Error("REFERRER_NOT_REGISTERED");
  }
  if (referrerAccount.data.bundle !== resolvedVault.bundleAccount) {
    throw new Error("REFERRER_ACCOUNT_MISMATCH");
  }
  if (referrerAccount.data.estimatedPendingWithdrawalValue !== 0n) {
    throw new Error("WITHDRAWAL_ALREADY_PENDING");
  }

  const sharesToWithdraw =
    referrerAccount.data.accruedPfeeShares +
    referrerAccount.data.accruedMfeeShares;
  if (sharesToWithdraw === 0n) {
    throw new Error("NO_ACCRUED_REFERRAL_SHARES");
  }
  if (bundle.data.totalShares === 0n) {
    throw new Error("WITHDRAWAL_VALUE_TOO_SMALL");
  }
  if (!oracleData.exists) {
    throw new Error("ORACLE_DATA_NOT_FOUND");
  }

  const totalEquity = totalEquityRaw({
    bundleUnderlyingBalance: bundle.data.bundleUnderlyingBalance,
    averageExternalEquity: oracleData.data.averageExternalEquity,
  });
  const estimatedWithdrawalValueRaw = calculateAssetsFromShares({
    shares: sharesToWithdraw,
    totalAssets: totalEquity,
    totalShares: bundle.data.totalShares,
  });
  if (estimatedWithdrawalValueRaw === 0n) {
    throw new Error("WITHDRAWAL_VALUE_TOO_SMALL");
  }

  let estimatedAvailableTimestamp: bigint | undefined;
  if (params.nowUnixSeconds !== undefined) {
    const cooldownSeconds = estimateWithdrawalCooldownSeconds({
      sharesAmount: sharesToWithdraw,
      totalShares: bundle.data.totalShares,
      withdrawalTMin: bundle.data.withdrawalTMin,
      withdrawalTMax: bundle.data.withdrawalTMax,
      withdrawalCurve: bundle.data.withdrawalCurve,
    });
    estimatedAvailableTimestamp = estimateWithdrawalAvailableTimestamp({
      nowUnixSeconds: BigInt(params.nowUnixSeconds),
      cooldownSeconds,
      withdrawalRedemptionRequestCutoffTs:
        bundle.data.withdrawalRedemptionRequestCutoffTs,
      withdrawalRedemptionUnlockCurrentCycleTs:
        bundle.data.withdrawalRedemptionUnlockCurrentCycleTs,
      withdrawalRedemptionUnlockNextCycleTs:
        bundle.data.withdrawalRedemptionUnlockNextCycleTs,
    });
  }

  const instruction = await getReferrerRequestWithdrawInstructionAsync(
    {
      referrer: params.referrer,
      bundleAccount: resolvedVault.bundleAccount,
      oracleData: oracleDataAddress,
      bundleTempData: bundleTempDataAddress,
      referrerAccount: referrerAccountAddress,
    },
    { programAddress: resolvedVault.programAddress },
  );

  return {
    instructions: [instruction],
    sharesToWithdraw,
    estimatedWithdrawalValueRaw,
    estimatedAvailableTimestamp,
  };
}
