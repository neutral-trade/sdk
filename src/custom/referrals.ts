import type {
  Address,
  Instruction,
  ProgramDerivedAddress,
  TransactionSigner,
} from '@solana/kit'

import type { ExtensionsRpc } from '../extensions/rpc'
import type { Bundle, ReferrerAccount, UserBundleAccount } from '../generated'
import { resolveEffectiveFees } from '../extensions/fees'
import { buildDepositInstructions } from '../extensions/flows'
import {
  assertValidAmountRaw,
  BPS_DENOMINATOR,
  U64_MAX,
} from '../extensions/math'
import {
  fetchMaybeBundle,
  fetchMaybeReferrerAccount,
  fetchMaybeUserBundleAccount,
  findReferrerAccountPda,
  findReferrerUserBundleAccountPda,
  findUserBundleAccountPda,
  getInitializeBundleDepositorInstructionAsync,
  getRegisterReferrerInstructionAsync,
  getSetUserReferrerInstructionAsync,
  NTBUNDLE_PROGRAM_ADDRESS,
} from '../generated'

const DEFAULT_ADDRESS
  = '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>
const REFERRAL_OVERRIDE_PERFORMANCE_FEE = 1 << 0
const REFERRAL_OVERRIDE_MANAGEMENT_FEE = 1 << 1

export interface DeriveReferrerAccountForUserParams {
  /** Bundle account containing the user's position. */
  vault: Address
  /** Referrer stored on, or about to be stored on, the user's bundle account. */
  referrer: Address
  /** Defaults to NTBUNDLE_PROGRAM_ADDRESS. */
  programAddress?: Address
}

/**
 * Derives the `ReferrerAccount` PDA used when processing a referred user's
 * fees. Keepers and clients should use this helper instead of rebuilding the
 * `REFERRER`, bundle, and referrer seed path.
 */
export async function deriveReferrerAccountForUser(
  params: DeriveReferrerAccountForUserParams,
): Promise<ProgramDerivedAddress> {
  return await findReferrerAccountPda(
    {
      bundleAccount: params.vault,
      referrer: params.referrer,
    },
    { programAddress: params.programAddress ?? NTBUNDLE_PROGRAM_ADDRESS },
  )
}

export type ReferrerCodeResolver = (
  code: string,
) => Address | Promise<Address>

export interface AttributedDepositReferrerInput {
  referrer: Address
  code?: never
  resolver?: never
}

export interface AttributedDepositCodeInput {
  referrer?: never
  code: string
  resolver: ReferrerCodeResolver
}

export type BuildAttributedDepositTxParams = {
  user: TransactionSigner
  vault: Address
  /** Gross deposit amount in the asset's minor unit. */
  amountRaw: bigint
  /** Defaults to the user's associated token account for the bundle asset. */
  userTokenAccount?: Address
  /** Defaults to NTBUNDLE_PROGRAM_ADDRESS. */
  programAddress?: Address
} & (AttributedDepositReferrerInput | AttributedDepositCodeInput)

function assertVirginForAttribution(
  userBundleAccount: UserBundleAccount | null,
): void {
  if (userBundleAccount === null) {
    return
  }
  if (userBundleAccount.referrer !== DEFAULT_ADDRESS) {
    throw new Error('REFERRAL_ALREADY_SET')
  }
  if (
    userBundleAccount.shares !== 0n
    || userBundleAccount.pendingDeposit !== 0n
    || userBundleAccount.pendingShares !== 0n
    || userBundleAccount.estimatedPendingWithdrawalValue !== 0n
    || userBundleAccount.netDeposits !== 0n
    || userBundleAccount.totalFeeCharged !== 0n
    || userBundleAccount.lastDepositTimestamp !== 0n
  ) {
    throw new Error('USER_BUNDLE_ACCOUNT_HAS_ACTIVITY')
  }
}

function assertDepositorInitializationSupportedByBuilder(
  bundle: Pick<Bundle, 'permissionned'>,
  depositorExists: boolean,
): void {
  if (bundle.permissionned && !depositorExists) {
    throw new Error('PERMISSIONED_BUNDLE_REQUIRES_EXISTING_DEPOSITOR')
  }
}

function assertValidReferrerForAttribution(params: {
  bundle: Bundle
  referrerAccount: ReferrerAccount | null
  referrerUserBundleAccount: UserBundleAccount | null
  referrer: Address
  user: Address
  vault: Address
}): void {
  const { bundle, referrerAccount, referrerUserBundleAccount } = params
  if (
    params.referrer === DEFAULT_ADDRESS
    || params.referrer === params.user
    || params.referrer === bundle.manager
    || referrerAccount === null
    || !referrerAccount.active
    || referrerAccount.bundle !== params.vault
    || referrerAccount.referrer !== params.referrer
    || referrerUserBundleAccount === null
    || referrerUserBundleAccount.owner !== params.referrer
  ) {
    throw new Error('INVALID_REFERRER')
  }

  if (
    referrerUserBundleAccount.netDeposits
    < bundle.referrerMinDepositAmount
  ) {
    throw new Error('REFERRER_DEPOSIT_TOO_LOW')
  }

  const performanceFeeBps
    = referrerAccount.rateOverrideFlags & REFERRAL_OVERRIDE_PERFORMANCE_FEE
      ? referrerAccount.customPfeeBps
      : bundle.referralPfeeBps
  const managementFeeBps
    = referrerAccount.rateOverrideFlags & REFERRAL_OVERRIDE_MANAGEMENT_FEE
      ? referrerAccount.customMfeeBps
      : bundle.referralMfeeBps
  if (performanceFeeBps === 0 && managementFeeBps === 0) {
    throw new Error('INVALID_REFERRER')
  }
}

async function resolveReferrer(
  params: BuildAttributedDepositTxParams,
): Promise<Address> {
  const hasReferrer = params.referrer !== undefined
  const hasCode = params.code !== undefined
  if (hasReferrer === hasCode) {
    throw new Error('EXPECTED_EXACTLY_ONE_REFERRER_INPUT')
  }
  if (params.referrer !== undefined) {
    return params.referrer
  }
  if (params.code.trim().length === 0) {
    throw new Error('INVALID_REFERRER_CODE')
  }
  if (typeof params.resolver !== 'function') {
    throw new TypeError('REFERRER_CODE_RESOLVER_REQUIRED')
  }
  return await params.resolver(params.code)
}

/**
 * Builds the only valid first-deposit ordering for attribution:
 * `initializeBundleDepositor` when needed, `setUserReferrer`, then
 * `requestDeposit`.
 *
 * `setUserReferrer` snapshots the referrer's effective performance and
 * management fee rates into the user's bundle account. A later
 * `setReferrerRateOverride` applies only to users attributed after that change.
 * Existing accounts with any deposit or withdrawal activity cannot be
 * attributed under the current program rules.
 */
export async function buildAttributedDepositTx(
  rpc: ExtensionsRpc,
  params: BuildAttributedDepositTxParams,
): Promise<Array<Instruction>> {
  assertValidAmountRaw(params.amountRaw)
  const programAddress = params.programAddress ?? NTBUNDLE_PROGRAM_ADDRESS
  const referrer = await resolveReferrer(params)
  if (referrer === params.user.address) {
    throw new Error('SELF_REFERRAL_NOT_ALLOWED')
  }
  if (referrer === DEFAULT_ADDRESS) {
    throw new Error('INVALID_REFERRER')
  }

  const [userBundleAccount] = await findUserBundleAccountPda(
    {
      userBundleAccountOwner: params.user.address,
      bundleAccount: params.vault,
    },
    { programAddress },
  )
  const [referrerAccountPda, referrerUserBundleAccountPda] = await Promise.all([
    deriveReferrerAccountForUser({
      vault: params.vault,
      referrer,
      programAddress,
    }),
    findReferrerUserBundleAccountPda(
      {
        referrer,
        bundleAccount: params.vault,
      },
      { programAddress },
    ),
  ])
  const [
    depositInstructions,
    bundle,
    existingUserBundle,
    existingReferrerAccount,
    existingReferrerUserBundleAccount,
  ] = await Promise.all([
    buildDepositInstructions(rpc, {
      user: params.user,
      bundleAccount: params.vault,
      amountRaw: params.amountRaw,
      userTokenAccount: params.userTokenAccount,
      programAddress,
    }),
    fetchMaybeBundle(rpc, params.vault),
    fetchMaybeUserBundleAccount(rpc, userBundleAccount),
    fetchMaybeReferrerAccount(rpc, referrerAccountPda[0]),
    fetchMaybeUserBundleAccount(rpc, referrerUserBundleAccountPda[0]),
  ])

  if (!bundle.exists) {
    throw new Error('BUNDLE_ACCOUNT_NOT_FOUND')
  }
  if (!bundle.data.referrerEnabled) {
    throw new Error('REFERRALS_DISABLED')
  }
  assertValidReferrerForAttribution({
    bundle: bundle.data,
    referrerAccount: existingReferrerAccount.exists
      ? existingReferrerAccount.data
      : null,
    referrerUserBundleAccount: existingReferrerUserBundleAccount.exists
      ? existingReferrerUserBundleAccount.data
      : null,
    referrer,
    user: params.user.address,
    vault: params.vault,
  })

  assertVirginForAttribution(
    existingUserBundle.exists ? existingUserBundle.data : null,
  )
  assertDepositorInitializationSupportedByBuilder(
    bundle.data,
    existingUserBundle.exists,
  )

  const requestDepositInstruction = depositInstructions.at(-1)
  if (requestDepositInstruction === undefined) {
    throw new Error('REQUEST_DEPOSIT_INSTRUCTION_NOT_BUILT')
  }
  const initializeInstructions = depositInstructions.slice(0, -1)
  const setUserReferrerInstruction = await getSetUserReferrerInstructionAsync(
    {
      user: params.user,
      bundleAccount: params.vault,
      userBundleAccount,
      referrerAccount: referrerAccountPda[0],
      referrerUserBundleAccount: referrerUserBundleAccountPda[0],
    },
    { programAddress },
  )

  return [
    ...initializeInstructions,
    setUserReferrerInstruction,
    requestDepositInstruction,
  ]
}

/**
 * Returns the smallest gross amount whose post-fee amount reaches
 * `minimumNetAmountRaw`. This exactly mirrors the program's floor division for
 * deposit fees.
 */
export function calculateMinimumGrossDepositAmount(
  minimumNetAmountRaw: bigint,
  depositFeeBps: number,
): bigint {
  if (minimumNetAmountRaw < 0n || minimumNetAmountRaw > U64_MAX) {
    throw new Error('INVALID_MINIMUM_NET_DEPOSIT_AMOUNT')
  }
  if (
    !Number.isSafeInteger(depositFeeBps)
    || depositFeeBps < 0
    || BigInt(depositFeeBps) >= BPS_DENOMINATOR
  ) {
    throw new Error('INVALID_DEPOSIT_FEE_BPS')
  }
  if (minimumNetAmountRaw === 0n) {
    return 0n
  }

  const feeBps = BigInt(depositFeeBps)
  const grossAmountRaw
    = ((minimumNetAmountRaw - 1n) * BPS_DENOMINATOR)
      / (BPS_DENOMINATOR - feeBps)
      + 1n
  if (grossAmountRaw > U64_MAX) {
    throw new Error('GROSS_DEPOSIT_AMOUNT_EXCEEDS_U64')
  }
  return grossAmountRaw
}

export interface BuildBuilderRegistrationTxParams {
  referrer: TransactionSigner
  vault: Address
  /**
   * Optional gross amount in the asset's minor unit. The builder raises it to
   * the vault and referral minimums when necessary.
   */
  depositAmountRaw?: bigint
  /** Defaults to the referrer's associated token account for the bundle asset. */
  referrerTokenAccount?: Address
  /** Defaults to NTBUNDLE_PROGRAM_ADDRESS. */
  programAddress?: Address
}

export interface AtomicBuilderRegistrationPlan {
  kind: 'atomic'
  instructions: Array<Instruction>
  /** Gross deposit included after applying the vault minimum, when requested. */
  grossDepositAmountRaw?: bigint
}

export interface TwoStepBuilderRegistrationPlan {
  kind: 'two-step'
  /** Send these instructions first when nonempty. */
  depositInstructions: Array<Instruction>
  /** Send these instructions only after keeper processing updates net deposits. */
  registrationInstructions: Array<Instruction>
  /** New gross deposit, or zero when an existing pending deposit is sufficient. */
  grossDepositAmountRaw: bigint
  /** Smallest new gross deposit required for registration. */
  minimumGrossDepositAmountRaw: bigint
  requiredNetDepositsRaw: bigint
}

export type BuilderRegistrationPlan
  = | AtomicBuilderRegistrationPlan
    | TwoStepBuilderRegistrationPlan

function maxBigInt(...values: Array<bigint>): bigint {
  return values.reduce((maximum, value) => value > maximum ? value : maximum)
}

/**
 * Builds partner registration instructions based on the vault's confirmed
 * minimum net deposit requirement.
 *
 * A new referrer in a zero-minimum vault gets one atomic instruction set. Any
 * referrer whose confirmed net deposits are below the configured minimum gets
 * a two-step plan because `requestDeposit` does not update `netDeposits`.
 * Existing pending deposits reduce or eliminate the first step's new deposit,
 * but keeper processing must still land before registration. An
 * already-qualified referrer can register atomically.
 */
export async function buildBuilderRegistrationTx(
  rpc: ExtensionsRpc,
  params: BuildBuilderRegistrationTxParams,
): Promise<BuilderRegistrationPlan> {
  if (params.depositAmountRaw !== undefined) {
    assertValidAmountRaw(params.depositAmountRaw)
  }
  const programAddress = params.programAddress ?? NTBUNDLE_PROGRAM_ADDRESS
  const [referrerUserBundleAccount] = await findUserBundleAccountPda(
    {
      userBundleAccountOwner: params.referrer.address,
      bundleAccount: params.vault,
    },
    { programAddress },
  )
  const [bundle, existingReferrerUserBundle] = await Promise.all([
    fetchMaybeBundle(rpc, params.vault),
    fetchMaybeUserBundleAccount(rpc, referrerUserBundleAccount),
  ])
  if (!bundle.exists) {
    throw new Error('BUNDLE_ACCOUNT_NOT_FOUND')
  }
  if (!bundle.data.referrerEnabled) {
    throw new Error('REFERRALS_DISABLED')
  }
  if (
    params.referrer.address === DEFAULT_ADDRESS
    || params.referrer.address === bundle.data.manager
  ) {
    throw new Error('INVALID_REFERRER')
  }
  assertDepositorInitializationSupportedByBuilder(
    bundle.data,
    existingReferrerUserBundle.exists,
  )

  const [referrerAccountPda] = await deriveReferrerAccountForUser({
    vault: params.vault,
    referrer: params.referrer.address,
    programAddress,
  })
  const registerReferrerInstruction = await getRegisterReferrerInstructionAsync(
    {
      referrer: params.referrer,
      referrerAccount: referrerAccountPda,
      bundleAccount: params.vault,
      referrerUserBundleAccount,
    },
    { programAddress },
  )

  const confirmedNetDepositsRaw = existingReferrerUserBundle.exists
    ? existingReferrerUserBundle.data.netDeposits
    : 0n
  const referrerMinimumRaw = bundle.data.referrerMinDepositAmount
  const canRegisterNow = confirmedNetDepositsRaw >= referrerMinimumRaw

  if (canRegisterNow) {
    if (params.depositAmountRaw !== undefined) {
      const grossDepositAmountRaw = maxBigInt(
        params.depositAmountRaw,
        bundle.data.minDepositAmount,
      )
      const depositInstructions = await buildDepositInstructions(rpc, {
        user: params.referrer,
        bundleAccount: params.vault,
        amountRaw: grossDepositAmountRaw,
        userTokenAccount: params.referrerTokenAccount,
        programAddress,
      })
      return {
        kind: 'atomic',
        instructions: [...depositInstructions, registerReferrerInstruction],
        grossDepositAmountRaw,
      }
    }

    const initializeInstructions: Array<Instruction>
      = existingReferrerUserBundle.exists
        ? []
        : [
            await getInitializeBundleDepositorInstructionAsync(
              {
                payer: params.referrer,
                authority: params.referrer,
                bundleAccount: params.vault,
                userBundleAccount: referrerUserBundleAccount,
              },
              { programAddress },
            ),
          ]
    return {
      kind: 'atomic',
      instructions: [...initializeInstructions, registerReferrerInstruction],
    }
  }

  const depositFeeBps = existingReferrerUserBundle.exists
    ? resolveEffectiveFees(
      bundle.data,
      existingReferrerUserBundle.data,
    ).depositFeeBps
    : bundle.data.depositFee
  const pendingDepositRaw = existingReferrerUserBundle.exists
    ? existingReferrerUserBundle.data.pendingDeposit
    : 0n
  const projectedNetDepositsRaw = confirmedNetDepositsRaw + pendingDepositRaw
  const additionalNetDepositRequiredRaw = projectedNetDepositsRaw
    >= referrerMinimumRaw
    ? 0n
    : referrerMinimumRaw - projectedNetDepositsRaw
  const feeAdjustedMinimumRaw = calculateMinimumGrossDepositAmount(
    additionalNetDepositRequiredRaw,
    depositFeeBps,
  )
  const minimumGrossDepositAmountRaw = feeAdjustedMinimumRaw === 0n
    ? 0n
    : maxBigInt(feeAdjustedMinimumRaw, bundle.data.minDepositAmount)
  const requestedGrossDepositAmountRaw = params.depositAmountRaw === undefined
    ? 0n
    : maxBigInt(params.depositAmountRaw, bundle.data.minDepositAmount)
  const grossDepositAmountRaw = maxBigInt(
    minimumGrossDepositAmountRaw,
    requestedGrossDepositAmountRaw,
  )
  const depositInstructions = grossDepositAmountRaw === 0n
    ? []
    : await buildDepositInstructions(rpc, {
        user: params.referrer,
        bundleAccount: params.vault,
        amountRaw: grossDepositAmountRaw,
        userTokenAccount: params.referrerTokenAccount,
        programAddress,
      })

  return {
    kind: 'two-step',
    depositInstructions,
    registrationInstructions: [registerReferrerInstruction],
    grossDepositAmountRaw,
    minimumGrossDepositAmountRaw,
    requiredNetDepositsRaw: referrerMinimumRaw,
  }
}
