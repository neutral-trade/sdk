import { address } from '@solana/kit'
import { z } from 'zod'

export const NEUTRAL_TRADE_WIDGET_PROTOCOL = 'neutral-trade-widget' as const
export const NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION = 2 as const
export const NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS = [
  1,
  NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
] as const

export type WidgetProtocolVersion
  = (typeof NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS)[number]

const requestIdSchema = z.string().min(1).max(128).regex(/^[\w.:-]+$/)
const MAX_U128_DECIMAL_DIGITS = 39
const unsignedIntegerSchema = z
  .string()
  .max(MAX_U128_DECIMAL_DIGITS, { abort: true })
  .regex(/^(?:0|[1-9]\d*)$/)
const transactionBase64Schema = z.string().min(1).max(1_644).regex(
  /^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i,
)

export const widgetAddressSchema = z.string().refine((value) => {
  try {
    address(value)
    return true
  }
  catch {
    return false
  }
}, 'Expected a Solana address')

export const widgetClusterSchema = z.enum(['mainnet', 'devnet'])
export const widgetModeSchema = z.enum(['inline', 'floating'])
export const attributionUnavailableReasonSchema = z.enum([
  'builder-code-unrecognized',
  'referrer-not-registered',
  'referrer-ineligible',
  'user-already-attributed',
])

export const widgetAttributionSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('applied'),
    referrer: widgetAddressSchema,
  }),
  z.strictObject({
    status: z.literal('unavailable'),
    reason: attributionUnavailableReasonSchema,
  }),
])

const protocolVersion1 = NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[0]
const messageEnvelopeV1Schema = z.strictObject({
  protocol: z.literal(NEUTRAL_TRADE_WIDGET_PROTOCOL),
  version: z.literal(protocolVersion1),
})
const messageEnvelopeV2Schema = z.strictObject({
  protocol: z.literal(NEUTRAL_TRADE_WIDGET_PROTOCOL),
  version: z.literal(NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION),
})
const builderCodeSchema = z.string().min(1).max(64).regex(/^[\w-]+$/)
const hostHelloConfigFields = {
  cluster: widgetClusterSchema,
  vaults: z.array(widgetAddressSchema).min(1).max(64),
  mode: widgetModeSchema,
}
const hostHelloWalletSchema = z.strictObject({
  address: widgetAddressSchema,
  name: z.string().min(1).max(128),
})

const hostHelloV1MessageSchema = messageEnvelopeV1Schema.extend({
  type: z.literal('host:hello'),
  supportedVersions: z.tuple([z.literal(protocolVersion1)]),
  config: z.strictObject({
    builderCode: builderCodeSchema,
    ...hostHelloConfigFields,
  }),
  wallet: hostHelloWalletSchema,
})
const hostHelloV2MessageSchema = messageEnvelopeV2Schema.extend({
  type: z.literal('host:hello'),
  supportedVersions: z.tuple([
    z.literal(protocolVersion1),
    z.literal(NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION),
  ]),
  config: z.union([
    z.strictObject({
      builderCode: builderCodeSchema,
      ...hostHelloConfigFields,
    }),
    z.strictObject({
      builderAddress: widgetAddressSchema,
      ...hostHelloConfigFields,
    }),
  ]),
  wallet: hostHelloWalletSchema,
})

export const hostHelloMessageSchema = z.discriminatedUnion('version', [
  hostHelloV1MessageSchema,
  hostHelloV2MessageSchema,
])

const hostOperationResultFields = {
  type: z.literal('host:operation-result'),
  requestId: requestIdSchema,
  operation: z.enum(['deposit', 'withdraw']),
  result: z.discriminatedUnion('status', [
    z.strictObject({
      status: z.literal('submitted'),
      signature: z.string().min(1).max(128),
    }),
    z.strictObject({
      status: z.literal('rejected'),
      code: z.string().min(1).max(64),
      message: z.string().min(1).max(512),
      rebuildRequired: z.boolean(),
    }),
  ]),
}

export const hostOperationResultMessageSchema = z.discriminatedUnion('version', [
  messageEnvelopeV1Schema.extend(hostOperationResultFields),
  messageEnvelopeV2Schema.extend(hostOperationResultFields),
])

const hostProtocolErrorFields = {
  type: z.literal('host:protocol-error'),
  code: z.enum(['handshake-required', 'invalid-message', 'unsupported-version']),
  message: z.string().min(1).max(512),
  receivedVersion: z.number().int().nonnegative().optional(),
}

export const hostProtocolErrorMessageSchema = z.discriminatedUnion('version', [
  messageEnvelopeV1Schema.extend(hostProtocolErrorFields),
  messageEnvelopeV2Schema.extend(hostProtocolErrorFields),
])

const widgetReadyFields = {
  type: z.literal('widget:ready'),
  supportedVersions: z.array(z.number().int().nonnegative()).min(1).max(16),
}

export const widgetReadyMessageSchema = z.discriminatedUnion('version', [
  messageEnvelopeV1Schema.extend(widgetReadyFields),
  messageEnvelopeV2Schema.extend(widgetReadyFields),
])

const widgetOperationRequestBaseFields = {
  type: z.literal('widget:operation-request'),
  requestId: requestIdSchema,
  transaction: transactionBase64Schema,
  user: widgetAddressSchema,
  vault: widgetAddressSchema,
}
const widgetOperationRequestV1Schema = messageEnvelopeV1Schema.extend(
  widgetOperationRequestBaseFields,
)
const widgetOperationRequestV2Schema = messageEnvelopeV2Schema.extend(
  widgetOperationRequestBaseFields,
)
const widgetDepositRequestFields = {
  operation: z.literal('deposit'),
  amount: unsignedIntegerSchema,
  attribution: widgetAttributionSchema,
}

export const widgetDepositRequestMessageSchema = z.discriminatedUnion('version', [
  widgetOperationRequestV1Schema.extend(widgetDepositRequestFields),
  widgetOperationRequestV2Schema.extend(widgetDepositRequestFields),
])

const widgetWithdrawRequestFields = {
  operation: z.literal('withdraw'),
  sharesAmount: unsignedIntegerSchema,
}

export const widgetWithdrawRequestMessageSchema = z.discriminatedUnion('version', [
  widgetOperationRequestV1Schema.extend(widgetWithdrawRequestFields),
  widgetOperationRequestV2Schema.extend(widgetWithdrawRequestFields),
])

const widgetCloseFields = { type: z.literal('widget:close') }

export const widgetCloseMessageSchema = z.discriminatedUnion('version', [
  messageEnvelopeV1Schema.extend(widgetCloseFields),
  messageEnvelopeV2Schema.extend(widgetCloseFields),
])

export const hostToWidgetMessageSchema = z.union([
  hostHelloMessageSchema,
  hostOperationResultMessageSchema,
  hostProtocolErrorMessageSchema,
])

export const widgetToHostMessageSchema = z.union([
  widgetReadyMessageSchema,
  widgetDepositRequestMessageSchema,
  widgetWithdrawRequestMessageSchema,
  widgetCloseMessageSchema,
])

export type AttributionUnavailableReason = z.infer<typeof attributionUnavailableReasonSchema>
export type HostHelloMessage = z.infer<typeof hostHelloMessageSchema>
export type HostOperationResultMessage = z.infer<typeof hostOperationResultMessageSchema>
export type HostProtocolErrorMessage = z.infer<typeof hostProtocolErrorMessageSchema>
export type HostToWidgetMessage = z.infer<typeof hostToWidgetMessageSchema>
export type WidgetAttribution = z.infer<typeof widgetAttributionSchema>
export type WidgetCluster = z.infer<typeof widgetClusterSchema>
export type WidgetDepositRequestMessage = z.infer<typeof widgetDepositRequestMessageSchema>
export type WidgetMode = z.infer<typeof widgetModeSchema>
export type WidgetOperationRequestMessage
  = | WidgetDepositRequestMessage
    | WidgetWithdrawRequestMessage
export type WidgetReadyMessage = z.infer<typeof widgetReadyMessageSchema>
export type WidgetToHostMessage = z.infer<typeof widgetToHostMessageSchema>
export type WidgetWithdrawRequestMessage = z.infer<typeof widgetWithdrawRequestMessageSchema>

export class WidgetProtocolError extends Error {
  readonly code: 'invalid-message' | 'unsupported-version'
  readonly receivedVersion?: number

  constructor(
    code: 'invalid-message' | 'unsupported-version',
    message: string,
    receivedVersion?: number,
  ) {
    super(message)
    this.name = 'WidgetProtocolError'
    this.code = code
    this.receivedVersion = receivedVersion
  }
}

function getReceivedVersion(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null || !('version' in value))
    return undefined
  return typeof value.version === 'number'
    && Number.isInteger(value.version)
    && value.version >= 0
    ? value.version
    : undefined
}

export function parseWidgetToHostMessage(value: unknown): WidgetToHostMessage {
  const receivedVersion = getReceivedVersion(value)
  if (
    receivedVersion !== undefined
    && !NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS.includes(
      receivedVersion as WidgetProtocolVersion,
    )
  ) {
    throw new WidgetProtocolError(
      'unsupported-version',
      `Unsupported Neutral Trade widget protocol version: ${receivedVersion}`,
      receivedVersion,
    )
  }

  const parsed = widgetToHostMessageSchema.safeParse(value)
  if (!parsed.success) {
    throw new WidgetProtocolError(
      'invalid-message',
      `Invalid Neutral Trade widget message: ${z.prettifyError(parsed.error)}`,
    )
  }
  return parsed.data
}
