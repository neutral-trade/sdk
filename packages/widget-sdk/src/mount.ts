import type { Address, ReadonlyUint8Array } from '@solana/kit'
import type { AttributionUnavailableReason, HostHelloMessage, HostProtocolErrorMessage, WidgetCluster, WidgetMode, WidgetOperationRequestMessage, WidgetProtocolVersion, WidgetTheme } from './protocol'
import type { WidgetTransactionTransport } from './transport'
import type { VerifiedWidgetTransaction, WidgetVerifierLimits } from './verifier'
import type { WalletStandardSigner } from './wallet'
import {
  address,
  getBase64Encoder,
  getSignatureFromTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
} from '@solana/kit'
import {
  hostHelloMessageSchema,
  hostOperationResultMessageSchema,
  hostProtocolErrorMessageSchema,
  NEUTRAL_TRADE_WIDGET_PROTOCOL,
  NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
  NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS,
  parseWidgetToHostMessage,
  WidgetProtocolError,
  widgetThemeSchema,
} from './protocol'
import { createRpcTransactionTransport } from './transport'
import {
  verifyWidgetTransaction,
  WidgetTransactionVerificationError,
} from './verifier'
import {
  signVerifiedTransaction,
  WalletStandardSignerError,
} from './wallet'

export const NEUTRAL_TRADE_WIDGET_ORIGIN = 'https://widget.neutral.trade' as const
const MAX_PROTOCOL_MESSAGE_LENGTH = 512
const HANDSHAKE_TIMEOUT_MS = 10_000
const BUILDER_ADDRESS_UNSUPPORTED_MESSAGE
  = 'hosted widget does not support builderAddress yet'
const HANDSHAKE_TIMEOUT_MESSAGE
  = 'hosted widget did not complete the version handshake'
const THEME_UNSUPPORTED_MESSAGE
  = 'hosted widget does not support theme customization yet'

export type NeutralTradeWidgetEvent
  = | {
    type: 'ready'
    protocolVersion: WidgetProtocolVersion
  }
  | {
    type: 'attribution-applied'
    referrer: string
    requestId: string
    vault: string
  }
  | {
    type: 'attribution-unavailable'
    reason: AttributionUnavailableReason
    requestId: string
    vault: string
  }
  | {
    type: 'deposit-submitted'
    amount: bigint
    requestId: string
    signature: string
    vault: string
  }
  | {
    type: 'deposit-confirmed'
    amount: bigint
    requestId: string
    signature: string
    vault: string
  }
  | {
    type: 'withdraw-submitted'
    requestId: string
    sharesAmount: bigint
    signature: string
    vault: string
  }
  | {
    type: 'withdraw-confirmed'
    requestId: string
    sharesAmount: bigint
    signature: string
    vault: string
  }
  | {
    type: 'error'
    code: string
    message: string
    operation?: 'deposit' | 'withdraw'
    requestId?: string
  }

export interface MountNeutralTradeWidgetOptions {
  builderAddress?: string
  builderCode?: string
  cluster?: WidgetCluster
  element: HTMLElement | string
  height?: number | string
  launcherLabel?: string
  mode?: WidgetMode
  onEvent?: (event: NeutralTradeWidgetEvent) => void
  rpcUrl?: string
  signer: WalletStandardSigner
  theme?: WidgetTheme
  transport?: WidgetTransactionTransport
  vaults: ReadonlyArray<string>
  verifierLimits?: WidgetVerifierLimits
}

export type WidgetConfigurationErrorCode
  = | 'invalid-attribution-config'
    | 'invalid-builder-address'
    | 'invalid-theme'

export class WidgetConfigurationError extends Error {
  readonly code: WidgetConfigurationErrorCode

  constructor(code: WidgetConfigurationErrorCode, message: string) {
    super(message)
    this.name = 'WidgetConfigurationError'
    this.code = code
  }
}

export interface NeutralTradeWidgetController {
  readonly element: HTMLElement
  readonly iframe: HTMLIFrameElement
  close: () => void
  destroy: () => void
  open: () => void
}

class WidgetBridgeError extends Error {
  readonly code: string
  readonly rebuildRequired: boolean

  constructor(code: string, message: string, rebuildRequired = false) {
    super(message)
    this.name = 'WidgetBridgeError'
    this.code = code
    this.rebuildRequired = rebuildRequired
  }
}

type ResolvedAttributionConfig
  = | { builderAddress: Address }
    | { builderCode: string }

function resolveAttributionConfig(
  options: { builderAddress?: string, builderCode?: string },
): ResolvedAttributionConfig {
  const hasBuilderAddress = options.builderAddress !== undefined
  const hasBuilderCode = options.builderCode !== undefined
  if (hasBuilderAddress === hasBuilderCode) {
    throw new WidgetConfigurationError(
      'invalid-attribution-config',
      'Provide exactly one of builderCode or builderAddress',
    )
  }
  if (options.builderCode !== undefined)
    return { builderCode: options.builderCode }

  const builderAddress = options.builderAddress
  if (builderAddress === undefined) {
    throw new WidgetConfigurationError(
      'invalid-attribution-config',
      'Provide exactly one of builderCode or builderAddress',
    )
  }
  try {
    return { builderAddress: address(builderAddress) }
  }
  catch {
    throw new WidgetConfigurationError(
      'invalid-builder-address',
      'builderAddress must be a valid Solana address',
    )
  }
}

function resolveTheme(theme: WidgetTheme | undefined): WidgetTheme | undefined {
  if (theme === undefined)
    return undefined
  const parsedTheme = widgetThemeSchema.safeParse(theme)
  if (!parsedTheme.success) {
    throw new WidgetConfigurationError(
      'invalid-theme',
      'theme must contain only supported, valid Neutral Trade widget tokens',
    )
  }
  return parsedTheme.data
}

function ensureError(thrownObject: unknown): Error {
  if (thrownObject instanceof Error)
    return thrownObject
  return new Error(`Non-Error thrown: ${String(thrownObject)}`)
}

function bytesEqual(
  first: ReadonlyUint8Array,
  second: ReadonlyUint8Array,
): boolean {
  return first.length === second.length
    && first.every((value, index) => value === second[index])
}

function getBridgeError(thrownObject: unknown): WidgetBridgeError {
  const error = ensureError(thrownObject)
  if (error instanceof WidgetBridgeError)
    return error
  if (error instanceof WidgetTransactionVerificationError) {
    return new WidgetBridgeError(
      error.code,
      error.message,
      error.code === 'stale-blockhash',
    )
  }
  if (error instanceof WalletStandardSignerError)
    return new WidgetBridgeError(error.code, error.message)
  return new WidgetBridgeError('operation-failed', error.message)
}

function resolveMountElement(element: HTMLElement | string): HTMLElement {
  if (typeof element !== 'string')
    return element
  const resolvedElement = document.querySelector<HTMLElement>(element)
  if (!resolvedElement)
    throw new Error(`Neutral Trade widget mount element not found: ${element}`)
  return resolvedElement
}

function formatHeight(height: number | string | undefined): string {
  if (height === undefined)
    return '720px'
  if (typeof height === 'string')
    return height
  if (!Number.isFinite(height) || height <= 0)
    throw new Error('Widget height must be a positive number or CSS length')
  return `${height}px`
}

function truncateProtocolMessage(message: string): string {
  return message.slice(0, MAX_PROTOCOL_MESSAGE_LENGTH) || 'Unknown widget error'
}

function assertSignedTransactionUnchanged(
  verifiedTransaction: VerifiedWidgetTransaction,
  signedWireTransaction: Uint8Array,
): void {
  let signedTransaction
  try {
    signedTransaction = getTransactionDecoder().decode(signedWireTransaction)
  }
  catch {
    throw new WidgetBridgeError(
      'wallet-signature-invalid',
      'Wallet returned undecodable transaction bytes',
    )
  }
  if (!bytesEqual(signedTransaction.messageBytes, verifiedTransaction.messageBytes)) {
    throw new WidgetBridgeError(
      'wallet-signature-invalid',
      'Wallet changed the verified transaction message',
    )
  }
  const canonicalBytes = getTransactionEncoder().encode(signedTransaction)
  if (!bytesEqual(canonicalBytes, signedWireTransaction)) {
    throw new WidgetBridgeError(
      'wallet-signature-invalid',
      'Wallet returned a noncanonical transaction',
    )
  }
  const signatureEntries = Object.entries(signedTransaction.signatures)
  if (
    signatureEntries.length !== 1
    || signatureEntries[0]?.[0] !== verifiedTransaction.user
    || signatureEntries[0]?.[1] === null
  ) {
    throw new WidgetBridgeError(
      'wallet-signature-invalid',
      'Wallet did not fill the connected account signature slot',
    )
  }
}

export function isTrustedWidgetMessageEvent(
  event: MessageEvent,
  iframe: HTMLIFrameElement,
): boolean {
  return event.origin === NEUTRAL_TRADE_WIDGET_ORIGIN
    && event.source === iframe.contentWindow
}

export function mountNeutralTradeWidget(
  options: MountNeutralTradeWidgetOptions,
): NeutralTradeWidgetController {
  const attributionConfig = resolveAttributionConfig(options)
  const theme = resolveTheme(options.theme)
  if (typeof window === 'undefined' || typeof document === 'undefined')
    throw new Error('Neutral Trade widget mounting requires a browser environment')
  if (options.rpcUrl && options.transport)
    throw new Error('Provide either rpcUrl or transport, not both')

  const cluster = options.cluster ?? 'mainnet'
  const mode = options.mode ?? 'inline'
  const vaults = [...new Set(options.vaults)]
  const isBuilderAddressMode = 'builderAddress' in attributionConfig
  const builderCodeProtocolVersion
    = NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[0]
  const builderAddressProtocolVersion
    = NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[1]
  const helloProtocolVersion: WidgetProtocolVersion = theme !== undefined
    ? NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION
    : isBuilderAddressMode
      ? builderAddressProtocolVersion
      : builderCodeProtocolVersion
  const createHelloMessage = (
    version: WidgetProtocolVersion,
  ): HostHelloMessage => hostHelloMessageSchema.parse({
    protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
    version,
    type: 'host:hello',
    supportedVersions: version === NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION
      ? [...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS]
      : version === builderAddressProtocolVersion
        ? [builderCodeProtocolVersion, builderAddressProtocolVersion]
        : [builderCodeProtocolVersion],
    config: {
      ...attributionConfig,
      cluster,
      mode,
      vaults,
      ...(version === NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION
        && theme !== undefined
        ? { theme }
        : {}),
    },
    wallet: {
      address: options.signer.account.address,
      name: options.signer.wallet.name,
    },
  })
  const initialHelloMessage = createHelloMessage(helloProtocolVersion)
  const mountElement = resolveMountElement(options.element)
  const transport = options.transport ?? createRpcTransactionTransport(cluster, {
    rpcUrl: options.rpcUrl,
  })

  const root = document.createElement('div')
  root.dataset.neutralTradeWidget = mode
  root.style.boxSizing = 'border-box'
  root.style.zIndex = mode === 'floating' ? '2147483000' : 'auto'
  if (mode === 'floating') {
    root.style.bottom = '24px'
    root.style.position = 'fixed'
    root.style.right = '24px'
  }
  else {
    root.style.height = formatHeight(options.height)
    root.style.width = '100%'
  }

  const frameContainer = document.createElement('div')
  frameContainer.style.background = theme?.background ?? '#0c0c0c'
  frameContainer.style.border = mode === 'floating' ? '1px solid rgba(0, 0, 0, 0.12)' : '0'
  frameContainer.style.borderRadius = mode === 'floating'
    ? `${theme?.radius ?? 16}px`
    : '0'
  frameContainer.style.boxShadow = mode === 'floating' ? '0 20px 60px rgba(0, 0, 0, 0.24)' : 'none'
  frameContainer.style.height = mode === 'floating'
    ? 'min(720px, calc(100vh - 112px))'
    : '100%'
  frameContainer.style.overflow = 'hidden'
  frameContainer.style.width = mode === 'floating'
    ? 'min(420px, calc(100vw - 32px))'
    : '100%'

  const iframe = document.createElement('iframe')
  iframe.allow = 'clipboard-write'
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  iframe.setAttribute(
    'sandbox',
    'allow-forms allow-popups allow-same-origin allow-scripts',
  )
  iframe.src = NEUTRAL_TRADE_WIDGET_ORIGIN
  iframe.style.border = '0'
  iframe.style.display = 'block'
  iframe.style.height = '100%'
  iframe.style.width = '100%'
  iframe.title = 'Neutral Trade'
  frameContainer.append(iframe)

  let launcher: HTMLButtonElement | undefined
  let isOpen = mode === 'inline'
  if (mode === 'floating') {
    launcher = document.createElement('button')
    launcher.type = 'button'
    launcher.textContent = options.launcherLabel ?? 'Trade with Neutral'
    launcher.setAttribute('aria-expanded', 'false')
    launcher.style.background = theme?.accent ?? '#111827'
    launcher.style.border = '0'
    launcher.style.borderRadius = '999px'
    launcher.style.color = theme?.text ?? '#fff'
    launcher.style.cursor = 'pointer'
    launcher.style.font = '600 14px/1 system-ui, sans-serif'
    if (theme?.fontFamily === 'system')
      launcher.style.fontFamily = 'system-ui'
    launcher.style.padding = '14px 18px'
    launcher.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)'
    frameContainer.hidden = true
    root.append(frameContainer, launcher)
  }
  else {
    root.append(frameContainer)
  }

  let destroyed = false
  let handshakeComplete = false
  let activeHelloMessage = initialHelloMessage
  let protocolVersion = helloProtocolVersion
  let themeUnsupportedEmitted = false
  let handshakeTimeout: number | undefined
  let activeRequestId: string | undefined
  const confirmationControllers = new Set<AbortController>()

  const emit = (event: NeutralTradeWidgetEvent): void => {
    if (destroyed)
      return
    try {
      options.onEvent?.(event)
    }
    catch {
      // Consumer callbacks cannot change transaction bridge control flow.
    }
  }

  const postMessage = (message: object): void => {
    if (!destroyed)
      iframe.contentWindow?.postMessage(message, NEUTRAL_TRADE_WIDGET_ORIGIN)
  }

  const sendProtocolError = (
    code: HostProtocolErrorMessage['code'],
    message: string,
    receivedVersion?: number,
  ): void => {
    const protocolMessage = truncateProtocolMessage(message)
    postMessage(hostProtocolErrorMessageSchema.parse({
      protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
      version: protocolVersion,
      type: 'host:protocol-error',
      code,
      message: protocolMessage,
      ...(receivedVersion === undefined ? {} : { receivedVersion }),
    }))
  }

  const sendRejectedOperation = (
    request: WidgetOperationRequestMessage,
    error: WidgetBridgeError,
  ): void => {
    const protocolMessage = truncateProtocolMessage(error.message)
    postMessage(hostOperationResultMessageSchema.parse({
      protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
      version: protocolVersion,
      type: 'host:operation-result',
      operation: request.operation,
      requestId: request.requestId,
      result: {
        status: 'rejected',
        code: error.code,
        message: protocolMessage,
        rebuildRequired: error.rebuildRequired,
      },
    }))
    emit({
      type: 'error',
      code: error.code,
      message: protocolMessage,
      operation: request.operation,
      requestId: request.requestId,
    })
  }

  const trackConfirmation = (
    request: WidgetOperationRequestMessage,
    verifiedTransaction: VerifiedWidgetTransaction,
    signature: string,
  ): void => {
    const confirmationController = new AbortController()
    confirmationControllers.add(confirmationController)
    void transport.confirmTransaction({
      blockhash: verifiedTransaction.blockhash,
      signal: confirmationController.signal,
      signature,
    }).then(() => {
      if (destroyed)
        return
      if (verifiedTransaction.operation === 'deposit') {
        emit({
          type: 'deposit-confirmed',
          amount: verifiedTransaction.amount,
          requestId: request.requestId,
          signature,
          vault: verifiedTransaction.vault,
        })
        if (verifiedTransaction.attribution.status === 'applied') {
          emit({
            type: 'attribution-applied',
            referrer: verifiedTransaction.attribution.referrer,
            requestId: request.requestId,
            vault: verifiedTransaction.vault,
          })
        }
      }
      else {
        emit({
          type: 'withdraw-confirmed',
          requestId: request.requestId,
          sharesAmount: verifiedTransaction.sharesAmount,
          signature,
          vault: verifiedTransaction.vault,
        })
      }
    }).catch((thrownObject: unknown) => {
      if (destroyed || confirmationController.signal.aborted)
        return
      const error = ensureError(thrownObject)
      emit({
        type: 'error',
        code: 'confirmation-failed',
        message: error.message,
        operation: request.operation,
        requestId: request.requestId,
      })
    }).finally(() => {
      confirmationControllers.delete(confirmationController)
    })
  }

  const handleOperation = async (request: WidgetOperationRequestMessage): Promise<void> => {
    if (activeRequestId) {
      sendRejectedOperation(
        request,
        new WidgetBridgeError(
          'operation-in-progress',
          `Operation ${activeRequestId} is already awaiting wallet approval`,
        ),
      )
      return
    }
    activeRequestId = request.requestId
    try {
      const wireTransaction = Uint8Array.from(
        getBase64Encoder().encode(request.transaction),
      )
      const verifiedTransaction = await verifyWidgetTransaction({
        allowedVaults: vaults,
        cluster,
        isBlockhashValid: blockhash => transport.isBlockhashValid(blockhash),
        expectedReferrer: isBuilderAddressMode
          ? attributionConfig.builderAddress
          : undefined,
        request,
        verifierLimits: options.verifierLimits,
        walletAddress: options.signer.account.address,
        wireTransaction,
      })
      if (destroyed)
        return
      const signedWireTransaction = await signVerifiedTransaction(options.signer, {
        cluster,
        transaction: verifiedTransaction.wireTransaction,
        transactionVersion: verifiedTransaction.transactionVersion,
      })
      if (destroyed)
        return
      assertSignedTransactionUnchanged(verifiedTransaction, signedWireTransaction)
      const signedTransaction = getTransactionDecoder().decode(signedWireTransaction)
      const expectedSignature = getSignatureFromTransaction(signedTransaction)
      const submittedSignature = await transport.sendTransaction(signedWireTransaction)
      if (submittedSignature !== expectedSignature) {
        throw new WidgetBridgeError(
          'submission-failed',
          'RPC returned a signature that does not match the signed transaction',
        )
      }

      postMessage(hostOperationResultMessageSchema.parse({
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: protocolVersion,
        type: 'host:operation-result',
        operation: request.operation,
        requestId: request.requestId,
        result: {
          status: 'submitted',
          signature: submittedSignature,
        },
      }))

      if (verifiedTransaction.operation === 'deposit') {
        if (verifiedTransaction.attribution.status === 'unavailable') {
          emit({
            type: 'attribution-unavailable',
            reason: verifiedTransaction.attribution.reason,
            requestId: request.requestId,
            vault: verifiedTransaction.vault,
          })
        }
        emit({
          type: 'deposit-submitted',
          amount: verifiedTransaction.amount,
          requestId: request.requestId,
          signature: submittedSignature,
          vault: verifiedTransaction.vault,
        })
      }
      else {
        emit({
          type: 'withdraw-submitted',
          requestId: request.requestId,
          sharesAmount: verifiedTransaction.sharesAmount,
          signature: submittedSignature,
          vault: verifiedTransaction.vault,
        })
      }
      trackConfirmation(request, verifiedTransaction, submittedSignature)
    }
    catch (thrownObject) {
      sendRejectedOperation(request, getBridgeError(thrownObject))
    }
    finally {
      activeRequestId = undefined
    }
  }

  const open = (): void => {
    if (destroyed)
      return
    isOpen = true
    frameContainer.hidden = false
    launcher?.setAttribute('aria-expanded', 'true')
    if (mode === 'inline')
      root.hidden = false
  }
  const close = (): void => {
    if (destroyed)
      return
    isOpen = false
    launcher?.setAttribute('aria-expanded', 'false')
    if (mode === 'floating')
      frameContainer.hidden = true
    else
      root.hidden = true
  }

  const clearHandshakeTimeout = (): void => {
    if (handshakeTimeout === undefined)
      return
    window.clearTimeout(handshakeTimeout)
    handshakeTimeout = undefined
  }
  const reportHandshakeFailure = (message: string): void => {
    sendProtocolError('unsupported-version', message)
    emit({
      type: 'error',
      code: 'unsupported-version',
      message,
    })
  }
  const scheduleHandshakeTimeout = (onTimeout: () => void): void => {
    clearHandshakeTimeout()
    handshakeTimeout = window.setTimeout(() => {
      handshakeTimeout = undefined
      if (destroyed || handshakeComplete)
        return
      onTimeout()
    }, HANDSHAKE_TIMEOUT_MS)
  }
  const sendFallbackHello = (
    version: WidgetProtocolVersion,
    timeoutMessage = HANDSHAKE_TIMEOUT_MESSAGE,
  ): void => {
    handshakeComplete = false
    activeHelloMessage = createHelloMessage(version)
    protocolVersion = version
    postMessage(activeHelloMessage)
    scheduleHandshakeTimeout(() => reportHandshakeFailure(timeoutMessage))
  }

  const handleMessage = (event: MessageEvent): void => {
    if (!isTrustedWidgetMessageEvent(event, iframe))
      return
    try {
      const message = parseWidgetToHostMessage(event.data)
      if (message.type === 'widget:ready') {
        if (handshakeComplete) {
          if (message.version === protocolVersion)
            return
          throw new WidgetProtocolError(
            'unsupported-version',
            `Widget changed protocol version from ${protocolVersion} to ${message.version}`,
            message.version,
          )
        }
        clearHandshakeTimeout()
        const advertisedVersions: ReadonlyArray<number>
          = initialHelloMessage.supportedVersions
        const canUseSelectedVersion
          = advertisedVersions.includes(message.version)
            && message.supportedVersions.includes(message.version)
            && (!isBuilderAddressMode
              || message.version >= builderAddressProtocolVersion)
        if (!canUseSelectedVersion) {
          const unsupportedMessage = isBuilderAddressMode
            && !message.supportedVersions.includes(builderAddressProtocolVersion)
            ? BUILDER_ADDRESS_UNSUPPORTED_MESSAGE
            : `Widget does not support protocol version ${helloProtocolVersion}`
          sendProtocolError(
            'unsupported-version',
            unsupportedMessage,
          )
          emit({
            type: 'error',
            code: 'unsupported-version',
            message: unsupportedMessage,
          })
          return
        }
        protocolVersion = message.version
        if (activeHelloMessage.version !== message.version) {
          sendFallbackHello(message.version)
          return
        }
        handshakeComplete = true
        emit({
          type: 'ready',
          protocolVersion,
        })
        if (
          theme !== undefined
          && protocolVersion < NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION
          && !themeUnsupportedEmitted
        ) {
          themeUnsupportedEmitted = true
          emit({
            type: 'error',
            code: 'theme-unsupported',
            message: THEME_UNSUPPORTED_MESSAGE,
          })
        }
        return
      }
      if (message.version !== protocolVersion) {
        throw new WidgetProtocolError(
          'unsupported-version',
          `Widget message uses protocol version ${message.version}; expected ${protocolVersion}`,
          message.version,
        )
      }
      if (!handshakeComplete) {
        sendProtocolError(
          'handshake-required',
          'Widget must complete the version handshake before sending messages',
        )
        return
      }
      if (message.type === 'widget:close') {
        close()
        return
      }
      void handleOperation(message)
    }
    catch (thrownObject) {
      const error = ensureError(thrownObject)
      if (error instanceof WidgetProtocolError) {
        sendProtocolError(error.code, error.message, error.receivedVersion)
        emit({ type: 'error', code: error.code, message: error.message })
        return
      }
      sendProtocolError('invalid-message', error.message)
      emit({ type: 'error', code: 'invalid-message', message: error.message })
    }
  }

  const toggle = (): void => {
    if (isOpen)
      close()
    else
      open()
  }
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && isOpen && mode === 'floating')
      close()
  }
  const sendHello = (): void => {
    handshakeComplete = false
    activeHelloMessage = initialHelloMessage
    protocolVersion = helloProtocolVersion
    clearHandshakeTimeout()
    postMessage(initialHelloMessage)
    if (helloProtocolVersion === builderCodeProtocolVersion)
      return
    scheduleHandshakeTimeout(() => {
      if (theme === undefined) {
        reportHandshakeFailure(BUILDER_ADDRESS_UNSUPPORTED_MESSAGE)
        return
      }
      const fallbackProtocolVersion = isBuilderAddressMode
        ? builderAddressProtocolVersion
        : builderCodeProtocolVersion
      sendFallbackHello(
        fallbackProtocolVersion,
        isBuilderAddressMode
          ? BUILDER_ADDRESS_UNSUPPORTED_MESSAGE
          : HANDSHAKE_TIMEOUT_MESSAGE,
      )
    })
  }

  const controller: NeutralTradeWidgetController = Object.freeze({
    element: root,
    iframe,
    close,
    destroy(): void {
      if (destroyed)
        return
      destroyed = true
      if (handshakeTimeout !== undefined)
        window.clearTimeout(handshakeTimeout)
      for (const confirmationController of confirmationControllers)
        confirmationController.abort()
      confirmationControllers.clear()
      iframe.removeEventListener('load', sendHello)
      launcher?.removeEventListener('click', toggle)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('message', handleMessage)
      root.remove()
    },
    open,
  })

  iframe.addEventListener('load', sendHello)
  launcher?.addEventListener('click', toggle)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('message', handleMessage)
  mountElement.append(root)

  return controller
}

export const mount = mountNeutralTradeWidget
