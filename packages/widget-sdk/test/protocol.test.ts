import type { WidgetTheme } from '../src/index'
import type { AttributionUnavailableReason, WidgetProtocolVersion, WidgetToHostMessage } from '../src/protocol'
import assert from 'node:assert'
import { describe, test } from 'node:test'
import fc from 'fast-check'
import {
  isTrustedWidgetMessageEvent,
  NEUTRAL_TRADE_WIDGET_ORIGIN,
} from '../src/mount'
import {
  hostHelloMessageSchema,
  hostToWidgetMessageSchema,
  NEUTRAL_TRADE_WIDGET_PROTOCOL,
  NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
  NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS,
  parseWidgetToHostMessage,
  widgetDepositRequestMessageSchema,
  WidgetProtocolError,
  widgetThemeSchema,
  widgetToHostMessageSchema,
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
const protocolVersionArbitrary = fc.constantFrom<WidgetProtocolVersion>(
  ...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS,
)
const protocolVersion1 = NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[0]
const protocolVersion2 = NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[1]

const colorArbitrary = fc.oneof(
  fc.integer({ min: 0, max: 0xFFF })
    .map(value => `#${value.toString(16).padStart(3, '0')}`),
  fc.integer({ min: 0, max: 0xFFFFFF })
    .map(value => `#${value.toString(16).padStart(6, '0')}`),
  fc.integer({ min: 0, max: 0xFFFFFFFF })
    .map(value => `#${value.toString(16).padStart(8, '0')}`),
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
  ).map(components => `rgb(${components.join(', ')})`),
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 100 }).map(value => value / 100),
  ).map(([red, green, blue, alpha]) => (
    `rgba(${red}, ${green}, ${blue}, ${alpha})`
  )),
)
const widgetThemeArbitrary = fc.record({
  colorScheme: fc.constantFrom('dark' as const, 'light' as const),
  accent: colorArbitrary,
  accentStrong: colorArbitrary,
  background: colorArbitrary,
  surface: colorArbitrary,
  surfaceRaised: colorArbitrary,
  surfaceSoft: colorArbitrary,
  border: colorArbitrary,
  borderStrong: colorArbitrary,
  text: colorArbitrary,
  muted: colorArbitrary,
  danger: colorArbitrary,
  warning: colorArbitrary,
  success: colorArbitrary,
  radius: fc.integer({ min: 0, max: 32 }),
  fontFamily: fc.constantFrom('brand' as const, 'system' as const),
}, { requiredKeys: [] })
const themeColorFields = [
  'accent',
  'accentStrong',
  'background',
  'surface',
  'surfaceRaised',
  'surfaceSoft',
  'border',
  'borderStrong',
  'text',
  'muted',
  'danger',
  'warning',
  'success',
] as const

const depositMessageArbitrary = fc.record({
  amount: amountArbitrary,
  reason: attributionReasonArbitrary,
  requestId: requestIdArbitrary,
  version: protocolVersionArbitrary,
}).map(({ amount, reason, requestId, version }): WidgetToHostMessage => ({
  protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
  version,
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
  version: protocolVersionArbitrary,
}).map(({ requestId, sharesAmount, version }): WidgetToHostMessage => ({
  protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
  version,
  type: 'widget:operation-request',
  operation: 'withdraw',
  requestId,
  transaction: 'AA==',
  sharesAmount,
  user: FIXTURE_ADDRESSES.user,
  vault: FIXTURE_ADDRESSES.vault,
}))

describe('widget protocol schemas', () => {
  test('round-trips host hello messages on every protocol version', () => {
    const commonHello = {
      protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
      type: 'host:hello' as const,
      wallet: {
        address: FIXTURE_ADDRESSES.user,
        name: 'Fixture Wallet',
      },
    }
    const commonConfig = {
      cluster: 'devnet' as const,
      mode: 'inline' as const,
      vaults: [FIXTURE_ADDRESSES.vault],
    }
    const messages = [
      {
        ...commonHello,
        version: protocolVersion1,
        supportedVersions: [protocolVersion1],
        config: { ...commonConfig, builderCode: 'ACME' },
      },
      {
        ...commonHello,
        version: protocolVersion2,
        supportedVersions: [protocolVersion1, protocolVersion2],
        config: { ...commonConfig, builderCode: 'ACME' },
      },
      {
        ...commonHello,
        version: protocolVersion2,
        supportedVersions: [protocolVersion1, protocolVersion2],
        config: {
          ...commonConfig,
          builderAddress: FIXTURE_ADDRESSES.referrer,
        },
      },
      {
        ...commonHello,
        version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
        supportedVersions: [...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS],
        config: {
          ...commonConfig,
          builderCode: 'ACME',
          theme: { accent: '#f5a' },
        },
      },
      {
        ...commonHello,
        version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
        supportedVersions: [...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS],
        config: {
          ...commonConfig,
          builderAddress: FIXTURE_ADDRESSES.referrer,
          theme: { fontFamily: 'system', radius: 12 },
        },
      },
    ]

    for (const message of messages) {
      assert.deepEqual(hostHelloMessageSchema.parse(message), message)
      assert.deepEqual(hostToWidgetMessageSchema.parse(message), message)
    }
  })

  test('keeps the v1 and v2 hello configuration strict and unchanged', () => {
    const commonMessage = {
      protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
      type: 'host:hello' as const,
      wallet: {
        address: FIXTURE_ADDRESSES.user,
        name: 'Fixture Wallet',
      },
    }
    const commonConfig = {
      cluster: 'devnet' as const,
      mode: 'inline' as const,
      vaults: [FIXTURE_ADDRESSES.vault],
    }

    assert.throws(() => hostHelloMessageSchema.parse({
      ...commonMessage,
      version: protocolVersion1,
      supportedVersions: [protocolVersion1],
      config: {
        ...commonConfig,
        builderAddress: FIXTURE_ADDRESSES.referrer,
      },
    }))
    for (const config of [
      commonConfig,
      {
        ...commonConfig,
        builderAddress: FIXTURE_ADDRESSES.referrer,
        builderCode: 'ACME',
      },
    ]) {
      assert.throws(() => hostHelloMessageSchema.parse({
        ...commonMessage,
        version: protocolVersion2,
        supportedVersions: [protocolVersion1, protocolVersion2],
        config,
      }))
    }

    for (const versionConfig of [
      {
        version: protocolVersion1,
        supportedVersions: [protocolVersion1],
      },
      {
        version: protocolVersion2,
        supportedVersions: [protocolVersion1, protocolVersion2],
      },
    ]) {
      assert.throws(() => hostHelloMessageSchema.parse({
        ...commonMessage,
        ...versionConfig,
        config: {
          ...commonConfig,
          builderCode: 'ACME',
          theme: { accent: '#ff0000' },
        },
      }))
    }
  })

  test('round-trips every generated valid theme through a v3 hello', () => {
    fc.assert(
      fc.property(widgetThemeArbitrary, (theme: WidgetTheme) => {
        const message = {
          protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
          version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
          type: 'host:hello' as const,
          supportedVersions: [...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS],
          config: {
            builderCode: 'ACME',
            cluster: 'devnet' as const,
            mode: 'inline' as const,
            vaults: [FIXTURE_ADDRESSES.vault],
            theme,
          },
          wallet: {
            address: FIXTURE_ADDRESSES.user,
            name: 'Fixture Wallet',
          },
        }

        assert.deepEqual(widgetThemeSchema.parse(theme), theme)
        assert.deepEqual(hostHelloMessageSchema.parse(message), message)
      }),
      { numRuns: 250 },
    )
  })

  test('rejects unsafe, overlong, and out-of-range theme values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...themeColorFields),
        fc.constantFrom('url(', 'var(', ';', '}', 'expression('),
        (field, forbiddenValue) => {
          assert.throws(() => widgetThemeSchema.parse({
            [field]: `#fff${forbiddenValue}`,
          }))
        },
      ),
      { numRuns: 100 },
    )
    fc.assert(
      fc.property(
        fc.constantFrom(...themeColorFields),
        fc.integer({ min: 41, max: 256 }),
        (field, length) => {
          assert.throws(() => widgetThemeSchema.parse({
            [field]: '#'.padEnd(length, '0'),
          }))
        },
      ),
      { numRuns: 100 },
    )
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1_000, max: -1 }),
          fc.integer({ min: 33, max: 1_000 }),
        ),
        (radius) => {
          assert.throws(() => widgetThemeSchema.parse({ radius }))
        },
      ),
      { numRuns: 100 },
    )
  })

  test('round-trips widget ready messages on every protocol version', () => {
    for (const version of NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS) {
      const message = {
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version,
        type: 'widget:ready' as const,
        supportedVersions: [...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS],
      }
      assert.deepEqual(widgetToHostMessageSchema.parse(message), message)
      assert.deepEqual(parseWidgetToHostMessage(message), message)
    }
  })

  test('preserves every generated valid operation message', () => {
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

  test('rejects every generated unsupported protocol version loudly', () => {
    const unsupportedVersionArbitrary = fc.oneof(
      fc.constant(0),
      fc.integer({
        min: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION + 1,
        max: 65_535,
      }),
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
