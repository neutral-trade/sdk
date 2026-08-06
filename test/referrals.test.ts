import type { AccountMeta, Address, Instruction, InstructionWithAccounts, InstructionWithData, ReadonlyUint8Array } from '@solana/kit'
import type { ReferrerAccountArgs } from '../src/generated'
import {
  assertIsInstructionWithAccounts,
  assertIsInstructionWithData,
  createNoopSigner,
} from '@solana/kit'
import { describe, expect, it, vi } from 'vitest'

import {
  buildAttributedDepositTx,
  buildBuilderRegistrationTx,
  calculateMinimumGrossDepositAmount,
  deriveReferrerAccountForUser,
} from '../src/custom/referrals'
import { FEE_OVERRIDE_DEPOSIT } from '../src/extensions/fees'
import { BPS_DENOMINATOR, U64_MAX } from '../src/extensions/math'
import {
  findReferrerAccountPda,
  findReferrerUserBundleAccountPda,
  findUserBundleAccountPda,
  getReferrerAccountEncoder,
  NTBUNDLE_PROGRAM_ADDRESS,
  parseInitializeBundleDepositorInstruction,
  parseRegisterReferrerInstruction,
  parseRequestDepositInstruction,
  parseSetUserReferrerInstruction,
} from '../src/generated'
import {
  accountsRegistry,
  buildEncodedBundleBytes,
  buildEncodedUserBundleBytes,
  fakeAddress,
  fakeRpc,
  TEST_BUNDLE_ADDRESS,
  TEST_USER_ADDRESS,
  ZERO_ADDRESS,
} from './client/testHelpers'

type ParsableInstruction = Instruction
  & InstructionWithAccounts<ReadonlyArray<AccountMeta>>
  & InstructionWithData<ReadonlyUint8Array>

const REFERRER_ADDRESS = fakeAddress(20)
const referrer = createNoopSigner(REFERRER_ADDRESS)
const user = createNoopSigner(TEST_USER_ADDRESS)

function assertParsableInstruction(
  instruction: Instruction,
): asserts instruction is ParsableInstruction {
  assertIsInstructionWithAccounts(instruction)
  assertIsInstructionWithData(instruction)
}

function referralBundleBytes(
  overrides: Parameters<typeof buildEncodedBundleBytes>[0] = {},
): Uint8Array {
  return buildEncodedBundleBytes({
    referrerEnabled: true,
    referralPfeeBps: 1_000,
    ...overrides,
  })
}

function referrerAccountBytes(
  overrides: Partial<ReferrerAccountArgs> = {},
): Uint8Array {
  return getReferrerAccountEncoder().encode({
    bundle: TEST_BUNDLE_ADDRESS,
    referrer: REFERRER_ADDRESS,
    accruedPfeeShares: 0n,
    accruedMfeeShares: 0n,
    active: true,
    bump: 0,
    customPfeeBps: 0,
    customMfeeBps: 0,
    rateOverrideFlags: 0,
    pendingWithdrawShares: 0n,
    estimatedPendingWithdrawalValue: 0n,
    withdrawalAvailableTimestamp: 0n,
    lastWithdrawalProcessTimestamp: 0n,
    padding: new Uint8Array(64),
    ...overrides,
  }) as Uint8Array
}

async function registeredReferrerAccounts(
  referrerUserBundleOverrides:
  Parameters<typeof buildEncodedUserBundleBytes>[0] = {},
  referrerAccountOverrides: Partial<ReferrerAccountArgs> = {},
): Promise<Array<[Address, Uint8Array]>> {
  const [referrerAccount] = await deriveReferrerAccountForUser({
    vault: TEST_BUNDLE_ADDRESS,
    referrer: REFERRER_ADDRESS,
  })
  const [referrerUserBundleAccount] = await findReferrerUserBundleAccountPda({
    referrer: REFERRER_ADDRESS,
    bundleAccount: TEST_BUNDLE_ADDRESS,
  })

  return [
    [referrerAccount, referrerAccountBytes(referrerAccountOverrides)],
    [
      referrerUserBundleAccount,
      buildEncodedUserBundleBytes({
        owner: REFERRER_ADDRESS,
        ...referrerUserBundleOverrides,
      }),
    ],
  ]
}

async function findUserBundleAccount(owner: Address): Promise<Address> {
  return (
    await findUserBundleAccountPda({
      userBundleAccountOwner: owner,
      bundleAccount: TEST_BUNDLE_ADDRESS,
    })
  )[0]
}

describe('referral custom builders', () => {
  describe('deriveReferrerAccountForUser', () => {
    it('matches the generated canonical PDA derivation', async () => {
      const actual = await deriveReferrerAccountForUser({
        vault: TEST_BUNDLE_ADDRESS,
        referrer: REFERRER_ADDRESS,
      })
      const expected = await findReferrerAccountPda({
        bundleAccount: TEST_BUNDLE_ADDRESS,
        referrer: REFERRER_ADDRESS,
      })

      expect(actual).toEqual(expected)
    })

    it('honors a program address override', async () => {
      const programAddress = fakeAddress(40)
      const actual = await deriveReferrerAccountForUser({
        vault: TEST_BUNDLE_ADDRESS,
        referrer: REFERRER_ADDRESS,
        programAddress,
      })
      const expected = await findReferrerAccountPda(
        {
          bundleAccount: TEST_BUNDLE_ADDRESS,
          referrer: REFERRER_ADDRESS,
        },
        { programAddress },
      )

      expect(actual).toEqual(expected)
    })
  })

  describe('buildAttributedDepositTx', () => {
    it('builds initialize, attribution, and deposit in the required order', async () => {
      const amountRaw = 123_456n
      const referrerAccounts = await registeredReferrerAccounts()
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
          ...referrerAccounts,
        ]),
      )

      const instructions = await buildAttributedDepositTx(rpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw,
        referrer: REFERRER_ADDRESS,
      })

      expect(instructions).toHaveLength(3)
      for (const instruction of instructions) {
        assertParsableInstruction(instruction)
      }
      const initialize = parseInitializeBundleDepositorInstruction(
        instructions[0] as ParsableInstruction,
      )
      const attribution = parseSetUserReferrerInstruction(
        instructions[1] as ParsableInstruction,
      )
      const deposit = parseRequestDepositInstruction(
        instructions[2] as ParsableInstruction,
      )
      const expectedUserBundleAccount = await findUserBundleAccount(user.address)
      const expectedReferrerAccount = await deriveReferrerAccountForUser({
        vault: TEST_BUNDLE_ADDRESS,
        referrer: REFERRER_ADDRESS,
      })
      const expectedReferrerUserBundleAccount
        = await findReferrerUserBundleAccountPda({
          referrer: REFERRER_ADDRESS,
          bundleAccount: TEST_BUNDLE_ADDRESS,
        })

      expect(initialize.accounts.userBundleAccount.address).toBe(
        expectedUserBundleAccount,
      )
      expect(initialize.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
      expect(attribution.accounts.userBundleAccount.address).toBe(
        expectedUserBundleAccount,
      )
      expect(attribution.accounts.referrerAccount.address).toBe(
        expectedReferrerAccount[0],
      )
      expect(attribution.accounts.referrerUserBundleAccount.address).toBe(
        expectedReferrerUserBundleAccount[0],
      )
      expect(deposit.accounts.userBundleAccount.address).toBe(
        expectedUserBundleAccount,
      )
      expect(deposit.accounts.bundleAccount.address).toBe(TEST_BUNDLE_ADDRESS)
      expect(deposit.data.amount).toBe(amountRaw)
    })

    it('skips initialization for an existing virgin depositor', async () => {
      const userBundleAccount = await findUserBundleAccount(user.address)
      const referrerAccounts = await registeredReferrerAccounts()
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
          [
            userBundleAccount,
            buildEncodedUserBundleBytes({ owner: user.address }),
          ],
          ...referrerAccounts,
        ]),
      )

      const instructions = await buildAttributedDepositTx(rpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: REFERRER_ADDRESS,
      })

      expect(instructions).toHaveLength(2)
      assertParsableInstruction(instructions[0]!)
      assertParsableInstruction(instructions[1]!)
      const attribution = parseSetUserReferrerInstruction(
        instructions[0] as ParsableInstruction,
      )
      const deposit = parseRequestDepositInstruction(
        instructions[1] as ParsableInstruction,
      )
      const expectedReferrerAccount = await deriveReferrerAccountForUser({
        vault: TEST_BUNDLE_ADDRESS,
        referrer: REFERRER_ADDRESS,
      })

      expect(attribution.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
      expect(attribution.accounts.referrerAccount.address).toBe(
        expectedReferrerAccount[0],
      )
      expect(deposit.accounts.bundleAccount.address).toBe(TEST_BUNDLE_ADDRESS)
      expect(deposit.data.amount).toBe(1n)
    })

    it('resolves an offchain code before deriving referral accounts', async () => {
      const resolver = vi.fn(async (code: string) => {
        expect(code).toBe('partner-code')
        return REFERRER_ADDRESS
      })
      const referrerAccounts = await registeredReferrerAccounts()
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
          ...referrerAccounts,
        ]),
      )

      const instructions = await buildAttributedDepositTx(rpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 25n,
        code: 'partner-code',
        resolver,
      })
      assertParsableInstruction(instructions[1]!)
      const attribution = parseSetUserReferrerInstruction(
        instructions[1] as ParsableInstruction,
      )
      const expectedReferrerAccount = await deriveReferrerAccountForUser({
        vault: TEST_BUNDLE_ADDRESS,
        referrer: REFERRER_ADDRESS,
      })

      expect(resolver).toHaveBeenCalledOnce()
      expect(attribution.accounts.referrerAccount.address).toBe(
        expectedReferrerAccount[0],
      )
    })

    it('rejects existing activity before producing an unusable attribution flow', async () => {
      const userBundleAccount = await findUserBundleAccount(user.address)
      const referrerAccounts = await registeredReferrerAccounts()
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
          [
            userBundleAccount,
            buildEncodedUserBundleBytes({
              owner: user.address,
              pendingDeposit: 1n,
            }),
          ],
          ...referrerAccounts,
        ]),
      )

      await expect(buildAttributedDepositTx(rpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: REFERRER_ADDRESS,
      })).rejects.toThrowError('USER_BUNDLE_ACCOUNT_HAS_ACTIVITY')
    })

    it('rejects reassignment and self-referral', async () => {
      const userBundleAccount = await findUserBundleAccount(user.address)
      const referrerAccounts = await registeredReferrerAccounts()
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
          [
            userBundleAccount,
            buildEncodedUserBundleBytes({
              owner: user.address,
              referrer: REFERRER_ADDRESS,
            }),
          ],
          ...referrerAccounts,
        ]),
      )

      await expect(buildAttributedDepositTx(rpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: REFERRER_ADDRESS,
      })).rejects.toThrowError('REFERRAL_ALREADY_SET')
      await expect(buildAttributedDepositTx(rpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: user.address,
      })).rejects.toThrowError('SELF_REFERRAL_NOT_ALLOWED')
    })

    it('rejects an empty referral code', async () => {
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
        ]),
      )

      await expect(buildAttributedDepositTx(rpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        code: '  ',
        resolver: async () => REFERRER_ADDRESS,
      })).rejects.toThrowError('INVALID_REFERRER_CODE')
    })

    it('rejects disabled referrals and missing referrer registrations', async () => {
      const referrerAccounts = await registeredReferrerAccounts()
      const disabledRpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes({ referrerEnabled: false })],
          ...referrerAccounts,
        ]),
      )

      await expect(buildAttributedDepositTx(disabledRpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: REFERRER_ADDRESS,
      })).rejects.toThrowError('REFERRALS_DISABLED')

      const missingReferrerRpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
        ]),
      )
      await expect(buildAttributedDepositTx(missingReferrerRpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: REFERRER_ADDRESS,
      })).rejects.toThrowError('INVALID_REFERRER')

      await expect(buildAttributedDepositTx(missingReferrerRpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: ZERO_ADDRESS,
      })).rejects.toThrowError('INVALID_REFERRER')
    })

    it('rejects inactive and underfunded referrers during preflight', async () => {
      const inactiveReferrerAccounts = await registeredReferrerAccounts(
        {},
        { active: false },
      )
      const inactiveRpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
          ...inactiveReferrerAccounts,
        ]),
      )

      await expect(buildAttributedDepositTx(inactiveRpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: REFERRER_ADDRESS,
      })).rejects.toThrowError('INVALID_REFERRER')

      const underfundedReferrerAccounts = await registeredReferrerAccounts({
        netDeposits: 99n,
      })
      const underfundedRpc = fakeRpc(
        accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            referralBundleBytes({ referrerMinDepositAmount: 100n }),
          ],
          ...underfundedReferrerAccounts,
        ]),
      )
      await expect(buildAttributedDepositTx(underfundedRpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: REFERRER_ADDRESS,
      })).rejects.toThrowError('REFERRER_DEPOSIT_TOO_LOW')
    })

    it('rejects fresh depositors in permissioned vaults', async () => {
      const referrerAccounts = await registeredReferrerAccounts()
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes({ permissionned: true })],
          ...referrerAccounts,
        ]),
      )

      await expect(buildAttributedDepositTx(rpc, {
        user,
        vault: TEST_BUNDLE_ADDRESS,
        amountRaw: 1n,
        referrer: REFERRER_ADDRESS,
      })).rejects.toThrowError(
        'PERMISSIONED_BUNDLE_REQUIRES_EXISTING_DEPOSITOR',
      )
    })
  })

  describe('calculateMinimumGrossDepositAmount', () => {
    it('matches exact fee-rounding boundaries', () => {
      expect(calculateMinimumGrossDepositAmount(0n, 5_000)).toBe(0n)
      expect(calculateMinimumGrossDepositAmount(1n, 5_000)).toBe(1n)
      expect(calculateMinimumGrossDepositAmount(100n, 100)).toBe(101n)
      expect(calculateMinimumGrossDepositAmount(100n, 5_000)).toBe(199n)
    })

    it('returns the smallest qualifying gross amount across generated inputs', () => {
      const feeRates = [0, 1, 25, 99, 100, 333, 2_500, 5_000, 9_999]
      const minimumNetAmounts = [
        1n,
        2n,
        9n,
        10n,
        99n,
        100n,
        10_001n,
        1_000_000n,
        4_294_967_295n,
      ]

      for (const feeRate of feeRates) {
        for (const minimumNetAmount of minimumNetAmounts) {
          const grossAmount = calculateMinimumGrossDepositAmount(
            minimumNetAmount,
            feeRate,
          )
          const feeAmount
            = (grossAmount * BigInt(feeRate)) / BPS_DENOMINATOR
          const netAmount = grossAmount - feeAmount
          expect(netAmount).toBeGreaterThanOrEqual(minimumNetAmount)

          const previousGrossAmount = grossAmount - 1n
          const previousFeeAmount
            = (previousGrossAmount * BigInt(feeRate)) / BPS_DENOMINATOR
          const previousNetAmount = previousGrossAmount - previousFeeAmount
          expect(previousNetAmount).toBeLessThan(minimumNetAmount)
        }
      }
    })

    it('rejects invalid rates, net amounts, and u64 overflow', () => {
      expect(() => calculateMinimumGrossDepositAmount(-1n, 0))
        .toThrowError('INVALID_MINIMUM_NET_DEPOSIT_AMOUNT')
      expect(() => calculateMinimumGrossDepositAmount(U64_MAX + 1n, 0))
        .toThrowError('INVALID_MINIMUM_NET_DEPOSIT_AMOUNT')
      expect(() => calculateMinimumGrossDepositAmount(1n, -1))
        .toThrowError('INVALID_DEPOSIT_FEE_BPS')
      expect(() => calculateMinimumGrossDepositAmount(1n, 10_000))
        .toThrowError('INVALID_DEPOSIT_FEE_BPS')
      expect(() => calculateMinimumGrossDepositAmount(U64_MAX, 1))
        .toThrowError('GROSS_DEPOSIT_AMOUNT_EXCEEDS_U64')
    })
  })

  describe('buildBuilderRegistrationTx', () => {
    it('builds atomic initialization and registration when the minimum is zero', async () => {
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      })

      expect(plan.kind).toBe('atomic')
      if (plan.kind !== 'atomic') {
        throw new Error('expected atomic plan')
      }
      expect(plan.instructions).toHaveLength(2)
      assertParsableInstruction(plan.instructions[0]!)
      assertParsableInstruction(plan.instructions[1]!)
      const initialization = parseInitializeBundleDepositorInstruction(
        plan.instructions[0] as ParsableInstruction,
      )
      const registration = parseRegisterReferrerInstruction(
        plan.instructions[1] as ParsableInstruction,
      )
      const expectedReferrerAccount = await deriveReferrerAccountForUser({
        vault: TEST_BUNDLE_ADDRESS,
        referrer: REFERRER_ADDRESS,
      })

      expect(initialization.accounts.authority.address).toBe(REFERRER_ADDRESS)
      expect(initialization.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
      expect(registration.accounts.referrerAccount.address).toBe(
        expectedReferrerAccount[0],
      )
      expect(registration.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
    })

    it('keeps an optional zero-minimum deposit in the atomic transaction', async () => {
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
        depositAmountRaw: 250n,
      })

      expect(plan.kind).toBe('atomic')
      if (plan.kind !== 'atomic') {
        throw new Error('expected atomic plan')
      }
      expect(plan.instructions).toHaveLength(3)
      assertParsableInstruction(plan.instructions[1]!)
      assertParsableInstruction(plan.instructions[2]!)
      const deposit = parseRequestDepositInstruction(
        plan.instructions[1] as ParsableInstruction,
      )
      const registration = parseRegisterReferrerInstruction(
        plan.instructions[2] as ParsableInstruction,
      )

      expect(deposit.accounts.bundleAccount.address).toBe(TEST_BUNDLE_ADDRESS)
      expect(deposit.data.amount).toBe(250n)
      expect(registration.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
    })

    it('raises an atomic deposit to the vault minimum', async () => {
      const referrerUserBundleAccount = await findUserBundleAccount(
        referrer.address,
      )
      const rpc = fakeRpc(
        accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            referralBundleBytes({
              minDepositAmount: 150n,
              referrerMinDepositAmount: 100n,
            }),
          ],
          [
            referrerUserBundleAccount,
            buildEncodedUserBundleBytes({
              owner: referrer.address,
              netDeposits: 100n,
            }),
          ],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
        depositAmountRaw: 50n,
      })

      expect(plan.kind).toBe('atomic')
      if (plan.kind !== 'atomic') {
        throw new Error('expected atomic plan')
      }
      expect(plan.grossDepositAmountRaw).toBe(150n)
      expect(plan.instructions).toHaveLength(2)
      assertParsableInstruction(plan.instructions[0]!)
      assertParsableInstruction(plan.instructions[1]!)
      const deposit = parseRequestDepositInstruction(
        plan.instructions[0] as ParsableInstruction,
      )
      const registration = parseRegisterReferrerInstruction(
        plan.instructions[1] as ParsableInstruction,
      )

      expect(deposit.accounts.bundleAccount.address).toBe(TEST_BUNDLE_ADDRESS)
      expect(deposit.data.amount).toBe(150n)
      expect(registration.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
    })

    it('returns a fee-adjusted two-step plan for a positive minimum', async () => {
      const rpc = fakeRpc(
        accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            referralBundleBytes({
              depositFee: 100,
              referrerMinDepositAmount: 100n,
            }),
          ],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      })

      expect(plan.kind).toBe('two-step')
      if (plan.kind !== 'two-step') {
        throw new Error('expected two-step plan')
      }
      expect(plan.grossDepositAmountRaw).toBe(101n)
      expect(plan.minimumGrossDepositAmountRaw).toBe(101n)
      expect(plan.requiredNetDepositsRaw).toBe(100n)
      expect(plan.depositInstructions).toHaveLength(2)
      expect(plan.registrationInstructions).toHaveLength(1)
      assertParsableInstruction(plan.depositInstructions[1]!)
      assertParsableInstruction(plan.registrationInstructions[0]!)
      const deposit = parseRequestDepositInstruction(
        plan.depositInstructions[1] as ParsableInstruction,
      )
      const registration = parseRegisterReferrerInstruction(
        plan.registrationInstructions[0] as ParsableInstruction,
      )

      expect(deposit.accounts.bundleAccount.address).toBe(TEST_BUNDLE_ADDRESS)
      expect(deposit.data.amount).toBe(101n)
      expect(registration.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
    })

    it('subtracts an existing pending deposit from the two-step deficit', async () => {
      const referrerUserBundleAccount = await findUserBundleAccount(
        referrer.address,
      )
      const rpc = fakeRpc(
        accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            referralBundleBytes({
              depositFee: 1_000,
              referrerMinDepositAmount: 1_000n,
            }),
          ],
          [
            referrerUserBundleAccount,
            buildEncodedUserBundleBytes({
              owner: referrer.address,
              netDeposits: 200n,
              pendingDeposit: 300n,
            }),
          ],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      })

      expect(plan.kind).toBe('two-step')
      if (plan.kind !== 'two-step') {
        throw new Error('expected two-step plan')
      }
      expect(plan.minimumGrossDepositAmountRaw).toBe(555n)
      expect(plan.grossDepositAmountRaw).toBe(555n)
      expect(plan.depositInstructions).toHaveLength(1)
      assertParsableInstruction(plan.depositInstructions[0]!)
      const deposit = parseRequestDepositInstruction(
        plan.depositInstructions[0] as ParsableInstruction,
      )

      expect(deposit.accounts.bundleAccount.address).toBe(TEST_BUNDLE_ADDRESS)
      expect(deposit.data.amount).toBe(555n)
    })

    it('waits without another deposit when pending net deposits qualify', async () => {
      const referrerUserBundleAccount = await findUserBundleAccount(
        referrer.address,
      )
      const rpc = fakeRpc(
        accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            referralBundleBytes({ referrerMinDepositAmount: 100n }),
          ],
          [
            referrerUserBundleAccount,
            buildEncodedUserBundleBytes({
              owner: referrer.address,
              netDeposits: 25n,
              pendingDeposit: 75n,
            }),
          ],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      })

      expect(plan.kind).toBe('two-step')
      if (plan.kind !== 'two-step') {
        throw new Error('expected two-step plan')
      }
      expect(plan.minimumGrossDepositAmountRaw).toBe(0n)
      expect(plan.grossDepositAmountRaw).toBe(0n)
      expect(plan.depositInstructions).toEqual([])
      expect(plan.registrationInstructions).toHaveLength(1)
      assertParsableInstruction(plan.registrationInstructions[0]!)
      const registration = parseRegisterReferrerInstruction(
        plan.registrationInstructions[0] as ParsableInstruction,
      )

      expect(registration.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
    })

    it('raises a requested deposit to the vault and referral minimums', async () => {
      const rpc = fakeRpc(
        accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            referralBundleBytes({
              depositFee: 100,
              minDepositAmount: 150n,
              referrerMinDepositAmount: 100n,
            }),
          ],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
        depositAmountRaw: 50n,
      })

      expect(plan.kind).toBe('two-step')
      if (plan.kind !== 'two-step') {
        throw new Error('expected two-step plan')
      }
      expect(plan.minimumGrossDepositAmountRaw).toBe(150n)
      expect(plan.grossDepositAmountRaw).toBe(150n)
      expect(plan.depositInstructions).toHaveLength(2)
      assertParsableInstruction(plan.depositInstructions[1]!)
      const deposit = parseRequestDepositInstruction(
        plan.depositInstructions[1] as ParsableInstruction,
      )

      expect(deposit.accounts.bundleAccount.address).toBe(TEST_BUNDLE_ADDRESS)
      expect(deposit.data.amount).toBe(150n)
    })

    it('uses an existing depositor fee override for gross-up', async () => {
      const referrerUserBundleAccount = await findUserBundleAccount(
        referrer.address,
      )
      const rpc = fakeRpc(
        accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            referralBundleBytes({
              depositFee: 0,
              referrerMinDepositAmount: 100n,
            }),
          ],
          [
            referrerUserBundleAccount,
            buildEncodedUserBundleBytes({
              owner: referrer.address,
              customDepositFeeBps: 5_000,
              feeOverrideFlags: FEE_OVERRIDE_DEPOSIT,
            }),
          ],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      })

      expect(plan.kind).toBe('two-step')
      if (plan.kind !== 'two-step') {
        throw new Error('expected two-step plan')
      }
      expect(plan.grossDepositAmountRaw).toBe(199n)
      expect(plan.depositInstructions).toHaveLength(1)
      assertParsableInstruction(plan.depositInstructions[0]!)
      const deposit = parseRequestDepositInstruction(
        plan.depositInstructions[0] as ParsableInstruction,
      )

      expect(deposit.accounts.bundleAccount.address).toBe(TEST_BUNDLE_ADDRESS)
      expect(deposit.data.amount).toBe(199n)
    })

    it('registers atomically when confirmed net deposits already qualify', async () => {
      const referrerUserBundleAccount = await findUserBundleAccount(
        referrer.address,
      )
      const rpc = fakeRpc(
        accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            referralBundleBytes({ referrerMinDepositAmount: 100n }),
          ],
          [
            referrerUserBundleAccount,
            buildEncodedUserBundleBytes({
              owner: referrer.address,
              netDeposits: 100n,
            }),
          ],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      })

      expect(plan.kind).toBe('atomic')
      if (plan.kind !== 'atomic') {
        throw new Error('expected atomic plan')
      }
      expect(plan.instructions).toHaveLength(1)
      assertParsableInstruction(plan.instructions[0]!)
      const registration = parseRegisterReferrerInstruction(
        plan.instructions[0] as ParsableInstruction,
      )

      expect(registration.accounts.referrer.address).toBe(REFERRER_ADDRESS)
      expect(registration.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
    })

    it('rejects missing, disabled, and manager-owned vault registration', async () => {
      await expect(buildBuilderRegistrationTx(
        fakeRpc(accountsRegistry([])),
        { referrer, vault: TEST_BUNDLE_ADDRESS },
      )).rejects.toThrowError('BUNDLE_ACCOUNT_NOT_FOUND')

      await expect(buildBuilderRegistrationTx(
        fakeRpc(accountsRegistry([
          [TEST_BUNDLE_ADDRESS, buildEncodedBundleBytes()],
        ])),
        { referrer, vault: TEST_BUNDLE_ADDRESS },
      )).rejects.toThrowError('REFERRALS_DISABLED')

      await expect(buildBuilderRegistrationTx(
        fakeRpc(accountsRegistry([
          [
            TEST_BUNDLE_ADDRESS,
            referralBundleBytes({ manager: referrer.address }),
          ],
        ])),
        { referrer, vault: TEST_BUNDLE_ADDRESS },
      )).rejects.toThrowError('INVALID_REFERRER')
    })

    it('rejects fresh referrers in permissioned vaults', async () => {
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes({ permissionned: true })],
        ]),
      )

      await expect(buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      })).rejects.toThrowError(
        'PERMISSIONED_BUNDLE_REQUIRES_EXISTING_DEPOSITOR',
      )
    })

    it('registers an initialized depositor in a permissioned vault', async () => {
      const referrerUserBundleAccount = await findUserBundleAccount(
        referrer.address,
      )
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes({ permissionned: true })],
          [
            referrerUserBundleAccount,
            buildEncodedUserBundleBytes({ owner: referrer.address }),
          ],
        ]),
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
      })

      expect(plan.kind).toBe('atomic')
      if (plan.kind !== 'atomic') {
        throw new Error('expected atomic plan')
      }
      expect(plan.instructions).toHaveLength(1)
      assertParsableInstruction(plan.instructions[0]!)
      const registration = parseRegisterReferrerInstruction(
        plan.instructions[0] as ParsableInstruction,
      )

      expect(registration.accounts.bundleAccount.address).toBe(
        TEST_BUNDLE_ADDRESS,
      )
    })

    it('uses the selected program address for every custom instruction', async () => {
      const programAddress = fakeAddress(41)
      const rpc = fakeRpc(
        accountsRegistry([
          [TEST_BUNDLE_ADDRESS, referralBundleBytes()],
        ]),
        { owner: programAddress },
      )

      const plan = await buildBuilderRegistrationTx(rpc, {
        referrer,
        vault: TEST_BUNDLE_ADDRESS,
        programAddress,
      })

      expect(plan.kind).toBe('atomic')
      if (plan.kind !== 'atomic') {
        throw new Error('expected atomic plan')
      }
      expect(plan.instructions.every(
        instruction => instruction.programAddress === programAddress,
      )).toBe(true)
      expect(programAddress).not.toBe(NTBUNDLE_PROGRAM_ADDRESS)
      expect(referrer.address).not.toBe(ZERO_ADDRESS)
    })
  })
})
