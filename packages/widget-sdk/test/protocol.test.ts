import type { AttributionUnavailableReason, WidgetToHostMessage } from '../src/protocol'
import assert from 'node:assert'
import { describe, test } from 'node:test'
import fc from 'fast-check'
import {
  isTrustedWidgetMessageEvent,
  NEUTRAL_TRADE_WIDGET_ORIGIN,
} from '../src/mount'
import {
  NEUTRAL_TRADE_WIDGET_PROTOCOL,
  NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
  parseWidgetToHostMessage,
  widgetDepositRequestMessageSchema,
  WidgetProtocolError,
} from '../src/protocol'
import { FIXTURE_ADDRESSES } from './fixtures/transactions'

const REQUEST_ID_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:-'.split('')
const requestIdArbitrary = fc
  .array(fc.constantFrom(...REQUEST_ID_CHARACTERS), { minLength: 1, maxLength: 64 })
  .map(characters => characters.join(''))
const amountArbitrary = fc
  .bigInt({ min: 0n, max: (1n << 128n) - 1n })
  .map(amount => amount.toString())
const attributionReasonArbitrary = fc.constantFrom<AttributionUnavailableReason>(
  'builder-code-unrecognized',
  'referrer-not-registered',
  'referrer-ineligible',
  'user-already-attributed',
)

const depositMessageArbitrary = fc.record({
  amount: amountArbitrary,
  reason: attributionReasonArbitrary,
  requestId: requestIdArbitrary,
}).map(({ amount, reason, requestId }): WidgetToHostMessage => ({
  protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
  version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
  type: 'widget:operation-request',
  operation: 'deposit',
  requestId,
  transaction: 'AA==',
  amount,
  attribution: { status: 'unavailable', reason },
  user: FIXTURE_ADDRESSES.user,
  vault: FIXTURE_ADDRESSES.vault,
}))

const withdrawalMessageArbitrary = fc.record({
  requestId: requestIdArbitrary,
  sharesAmount: amountArbitrary,
}).map(({ requestId, sharesAmount }): WidgetToHostMessage => ({
  protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
  version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
  type: 'widget:operation-request',
  operation: 'withdraw',
  requestId,
  transaction: 'AA==',
  sharesAmount,
  user: FIXTURE_ADDRESSES.user,
  vault: FIXTURE_ADDRESSES.vault,
}))

describe('widget protocol schemas', () => {
  test('preserve every generated valid operation message', () => {
    fc.assert(
      fc.property(
        fc.oneof(depositMessageArbitrary, withdrawalMessageArbitrary),
        (message) => {
          assert.deepEqual(parseWidgetToHostMessage(message), message)
        },
      ),
      { numRuns: 250 },
    )
  })

  test('accepts the maximum u128 decimal width for operation amounts', () => {
    const maximumU128 = ((1n << 128n) - 1n).toString()

    assert.doesNotThrow(() => parseWidgetToHostMessage({
      protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
      version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
      type: 'widget:operation-request',
      operation: 'deposit',
      requestId: 'maximum-deposit',
      transaction: 'AA==',
      amount: maximumU128,
      attribution: {
        status: 'unavailable',
        reason: 'builder-code-unrecognized',
      },
      user: FIXTURE_ADDRESSES.user,
      vault: FIXTURE_ADDRESSES.vault,
    }))
    assert.doesNotThrow(() => parseWidgetToHostMessage({
      protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
      version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
      type: 'widget:operation-request',
      operation: 'withdraw',
      requestId: 'maximum-withdrawal',
      transaction: 'AA==',
      sharesAmount: maximumU128,
      user: FIXTURE_ADDRESSES.user,
      vault: FIXTURE_ADDRESSES.vault,
    }))
  })

  test('rejects every operation amount wider than a u128 decimal string', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('deposit' as const, 'withdraw' as const),
        fc.integer({ min: 40, max: 4_096 }),
        (operation, digitCount) => {
          const commonMessage = {
            protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
            version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
            type: 'widget:operation-request' as const,
            requestId: 'overlong-amount',
            transaction: 'AA==',
            user: FIXTURE_ADDRESSES.user,
            vault: FIXTURE_ADDRESSES.vault,
          }
          const message = operation === 'deposit'
            ? {
                ...commonMessage,
                operation,
                amount: '9'.repeat(digitCount),
                attribution: {
                  status: 'unavailable' as const,
                  reason: 'builder-code-unrecognized' as const,
                },
              }
            : {
                ...commonMessage,
                operation,
                sharesAmount: '9'.repeat(digitCount),
              }

          assert.throws(
            () => parseWidgetToHostMessage(message),
            WidgetProtocolError,
          )
        },
      ),
      { numRuns: 200 },
    )
  })

  test('aborts decimal validation immediately after the amount length limit', () => {
    const result = widgetDepositRequestMessageSchema.safeParse({
      protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
      version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
      type: 'widget:operation-request',
      operation: 'deposit',
      requestId: 'overlong-invalid-amount',
      transaction: 'AA==',
      amount: `x${'9'.repeat(39)}`,
      attribution: {
        status: 'unavailable',
        reason: 'builder-code-unrecognized',
      },
      user: FIXTURE_ADDRESSES.user,
      vault: FIXTURE_ADDRESSES.vault,
    })

    assert.equal(result.success, false)
    if (!result.success)
      assert.deepEqual(result.error.issues.map(issue => issue.code), ['too_big'])
  })

  test('reject every generated unsupported protocol version loudly', () => {
    const unsupportedVersionArbitrary = fc.oneof(
      fc.constant(0),
      fc.integer({ min: 2, max: 65_535 }),
    )
    fc.assert(
      fc.property(unsupportedVersionArbitrary, (version) => {
        assert.throws(
          () => parseWidgetToHostMessage({
            protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
            version,
            type: 'widget:ready',
            supportedVersions: [version],
          }),
          (thrownObject: unknown) => {
            assert(thrownObject instanceof WidgetProtocolError)
            assert.equal(thrownObject.code, 'unsupported-version')
            assert.equal(thrownObject.receivedVersion, version)
            return true
          },
        )
      }),
      { numRuns: 200 },
    )
  })

  test('rejects unknown fields instead of silently stripping them', () => {
    fc.assert(
      fc.property(requestIdArbitrary, (suffix) => {
        assert.throws(
          () => parseWidgetToHostMessage({
            protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
            version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
            type: 'widget:close',
            [`extra_${suffix}`]: true,
          }),
          WidgetProtocolError,
        )
      }),
      { numRuns: 200 },
    )
  })

  test('has no generic transaction-signing request', () => {
    assert.throws(
      () => parseWidgetToHostMessage({
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
        type: 'widget:sign-transaction',
        transaction: 'AA==',
      }),
      WidgetProtocolError,
    )
  })
})

describe('message event trust boundary', () => {
  test('requires both the pinned origin and the exact iframe source', () => {
    const iframeWindow = {} as WindowProxy
    const otherWindow = {} as WindowProxy
    const iframe = { contentWindow: iframeWindow } as HTMLIFrameElement

    assert.equal(isTrustedWidgetMessageEvent({
      origin: NEUTRAL_TRADE_WIDGET_ORIGIN,
      source: iframeWindow,
    } as MessageEvent, iframe), true)
    assert.equal(isTrustedWidgetMessageEvent({
      origin: 'https://attacker.example',
      source: iframeWindow,
    } as MessageEvent, iframe), false)
    assert.equal(isTrustedWidgetMessageEvent({
      origin: NEUTRAL_TRADE_WIDGET_ORIGIN,
      source: otherWindow,
    } as MessageEvent, iframe), false)
  })
})
