import type { WidgetDepositRequestMessage, WidgetOperationRequestMessage, WidgetWithdrawRequestMessage } from '../src/protocol'
import type { WidgetTransactionVerificationErrorCode } from '../src/verifier'
import assert from 'node:assert'
import { describe, test } from 'node:test'
import { getBase64Decoder } from '@solana/kit'
import {
  NEUTRAL_TRADE_WIDGET_PROTOCOL,
  NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
} from '../src/protocol'
import {
  verifyWidgetTransaction,
  WidgetTransactionVerificationError,
} from '../src/verifier'
import {
  addAddressLookupTable,
  createDepositFixture,
  createExtraInstruction,
  createWithdrawalFixture,
  fillSignatureSlot,
  FIXTURE_ADDRESSES,
} from './fixtures/transactions'

const DEPOSIT_AMOUNT = 8_765_432n
const WITHDRAWAL_SHARES_AMOUNT = 987_654_321n

function encodeTransaction(wireTransaction: Uint8Array): string {
  return getBase64Decoder().decode(wireTransaction)
}

function createDepositRequest(
  wireTransaction: Uint8Array,
  overrides: Partial<Pick<
    WidgetDepositRequestMessage,
    'amount' | 'attribution' | 'user' | 'vault'
  >> = {},
): WidgetDepositRequestMessage {
  return {
    protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
    version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
    type: 'widget:operation-request',
    operation: 'deposit',
    requestId: 'deposit-fixture',
    transaction: encodeTransaction(wireTransaction),
    amount: overrides.amount ?? DEPOSIT_AMOUNT.toString(),
    attribution: overrides.attribution ?? {
      status: 'unavailable',
      reason: 'builder-code-unrecognized',
    },
    user: overrides.user ?? FIXTURE_ADDRESSES.user,
    vault: overrides.vault ?? FIXTURE_ADDRESSES.vault,
  }
}

function createWithdrawalRequest(
  wireTransaction: Uint8Array,
  overrides: Partial<Pick<
    WidgetWithdrawRequestMessage,
    'sharesAmount' | 'user' | 'vault'
  >> = {},
): WidgetWithdrawRequestMessage {
  return {
    protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
    version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
    type: 'widget:operation-request',
    operation: 'withdraw',
    requestId: 'withdraw-fixture',
    transaction: encodeTransaction(wireTransaction),
    sharesAmount: overrides.sharesAmount ?? WITHDRAWAL_SHARES_AMOUNT.toString(),
    user: overrides.user ?? FIXTURE_ADDRESSES.user,
    vault: overrides.vault ?? FIXTURE_ADDRESSES.vault,
  }
}

async function verify(
  wireTransaction: Uint8Array,
  request: WidgetOperationRequestMessage,
  isBlockhashValid = true,
  expectedReferrer?: string,
) {
  return await verifyWidgetTransaction({
    allowedVaults: [FIXTURE_ADDRESSES.vault, FIXTURE_ADDRESSES.alternateVault],
    cluster: 'devnet',
    expectedReferrer,
    isBlockhashValid: async () => isBlockhashValid,
    request,
    walletAddress: FIXTURE_ADDRESSES.user,
    wireTransaction,
  })
}

async function assertRejectedWithCode(
  promise: Promise<unknown>,
  code: WidgetTransactionVerificationErrorCode,
): Promise<void> {
  await assert.rejects(promise, (thrownObject: unknown) => {
    assert(thrownObject instanceof WidgetTransactionVerificationError)
    assert.equal(thrownObject.code, code)
    return true
  })
}

describe('verifyWidgetTransaction golden fixtures', () => {
  test('accepts an attributed deposit and re-derives the signed values', async () => {
    const wireTransaction = await createDepositFixture({
      amount: DEPOSIT_AMOUNT,
      includeAttribution: true,
      includeInitialize: true,
    })
    const request = createDepositRequest(wireTransaction, {
      attribution: {
        status: 'applied',
        referrer: FIXTURE_ADDRESSES.referrer,
      },
    })

    const verified = await verify(
      wireTransaction,
      request,
      true,
      FIXTURE_ADDRESSES.referrer,
    )

    if (verified.operation !== 'deposit')
      assert.fail('Expected a verified deposit')
    assert.equal(verified.amount, DEPOSIT_AMOUNT)
    assert.equal(verified.user, FIXTURE_ADDRESSES.user)
    assert.equal(verified.vault, FIXTURE_ADDRESSES.vault)
    assert.deepEqual(verified.attribution, {
      status: 'applied',
      referrer: FIXTURE_ADDRESSES.referrer,
    })
  })

  test('accepts an unattributed deposit', async () => {
    const wireTransaction = await createDepositFixture({ amount: DEPOSIT_AMOUNT })
    const verified = await verify(
      wireTransaction,
      createDepositRequest(wireTransaction),
    )

    if (verified.operation !== 'deposit')
      assert.fail('Expected a verified deposit')
    assert.deepEqual(verified.attribution, {
      status: 'unavailable',
      reason: 'builder-code-unrecognized',
    })
  })

  test('accepts an unavailable-attribution retry in builderAddress mode', async () => {
    const wireTransaction = await createDepositFixture({ amount: DEPOSIT_AMOUNT })
    const verified = await verify(
      wireTransaction,
      createDepositRequest(wireTransaction, {
        attribution: {
          status: 'unavailable',
          reason: 'user-already-attributed',
        },
      }),
      true,
      FIXTURE_ADDRESSES.referrer,
    )

    if (verified.operation !== 'deposit')
      assert.fail('Expected a verified deposit')
    assert.deepEqual(verified.attribution, {
      status: 'unavailable',
      reason: 'user-already-attributed',
    })
  })

  test('accepts a withdrawal with idempotent associated token creation', async () => {
    const wireTransaction = await createWithdrawalFixture({
      includeAssociatedTokenInstruction: true,
      sharesAmount: WITHDRAWAL_SHARES_AMOUNT,
    })
    const verified = await verify(
      wireTransaction,
      createWithdrawalRequest(wireTransaction),
    )

    if (verified.operation !== 'withdraw')
      assert.fail('Expected a verified withdrawal')
    assert.equal(verified.sharesAmount, WITHDRAWAL_SHARES_AMOUNT)
    assert.equal(verified.user, FIXTURE_ADDRESSES.user)
    assert.equal(verified.vault, FIXTURE_ADDRESSES.vault)
  })
})

describe('verifyWidgetTransaction adversarial mutants', () => {
  test('rejects an extra instruction', async () => {
    const wireTransaction = await createDepositFixture({
      extraInstructions: [createExtraInstruction()],
    })
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction)),
      'instruction-not-allowed',
    )
  })

  test('rejects a swapped vault', async () => {
    const wireTransaction = await createDepositFixture({
      vault: FIXTURE_ADDRESSES.alternateVault,
    })
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction)),
      'vault-mismatch',
    )
  })

  test('rejects an added signer', async () => {
    const wireTransaction = await createDepositFixture({
      transactionUser: FIXTURE_ADDRESSES.alternateUser,
    })
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction)),
      'invalid-signer',
    )
  })

  test('rejects an address lookup table', async () => {
    const goldenTransaction = await createDepositFixture()
    const wireTransaction = addAddressLookupTable(goldenTransaction)
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction)),
      'address-lookup-table',
    )
  })

  test('rejects the wrong bundle program id', async () => {
    const wireTransaction = await createDepositFixture({
      programAddress: FIXTURE_ADDRESSES.wrongProgram,
    })
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction)),
      'instruction-not-allowed',
    )
  })

  test('rejects a tampered deposit amount', async () => {
    const wireTransaction = await createDepositFixture({ amount: DEPOSIT_AMOUNT + 41n })
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction)),
      'amount-mismatch',
    )
  })

  test('rejects a non-user fee payer', async () => {
    const wireTransaction = await createDepositFixture({
      feePayer: FIXTURE_ADDRESSES.alternateFeePayer,
      stripUserSignerRole: true,
    })
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction)),
      'invalid-fee-payer',
    )
  })

  test('rejects a stale blockhash', async () => {
    const wireTransaction = await createDepositFixture()
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction), false),
      'stale-blockhash',
    )
  })

  test('rejects widened writable account privileges', async () => {
    const wireTransaction = await createDepositFixture({
      makeTokenProgramWritable: true,
    })
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction)),
      'invalid-instruction',
    )
  })

  test('rejects a nonzero signature slot', async () => {
    const goldenTransaction = await createDepositFixture()
    const wireTransaction = fillSignatureSlot(goldenTransaction)
    await assertRejectedWithCode(
      verify(wireTransaction, createDepositRequest(wireTransaction)),
      'invalid-signature-slot',
    )
  })

  test('rejects referrer accounts derived from a different referrer', async () => {
    const wireTransaction = await createDepositFixture({
      includeAttribution: true,
      referrer: FIXTURE_ADDRESSES.secondReferrer,
    })
    const request = createDepositRequest(wireTransaction, {
      attribution: {
        status: 'applied',
        referrer: FIXTURE_ADDRESSES.referrer,
      },
    })
    await assertRejectedWithCode(
      verify(wireTransaction, request),
      'invalid-referrer',
    )
  })

  test('rejects a request referrer that differs from the configured builderAddress', async () => {
    const wireTransaction = await createDepositFixture({
      includeAttribution: true,
      referrer: FIXTURE_ADDRESSES.secondReferrer,
    })
    const request = createDepositRequest(wireTransaction, {
      attribution: {
        status: 'applied',
        referrer: FIXTURE_ADDRESSES.secondReferrer,
      },
    })
    await assertRejectedWithCode(
      verify(
        wireTransaction,
        request,
        true,
        FIXTURE_ADDRESSES.referrer,
      ),
      'invalid-referrer',
    )
  })

  test('rejects a deposit transaction presented as a withdrawal', async () => {
    const wireTransaction = await createDepositFixture()
    await assertRejectedWithCode(
      verify(wireTransaction, createWithdrawalRequest(wireTransaction)),
      'operation-mismatch',
    )
  })

  test('rejects a transaction whose requested vault is outside host configuration', async () => {
    const wireTransaction = await createDepositFixture()
    const request = createDepositRequest(wireTransaction, {
      vault: FIXTURE_ADDRESSES.wrongProgram,
    })
    await assertRejectedWithCode(
      verify(wireTransaction, request),
      'vault-not-allowed',
    )
  })
})
