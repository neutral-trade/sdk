import type { ReadonlyUint8Array } from '@solana/kit'
import type { AttributionUnavailableReason, HostOperationResultMessage, HostProtocolErrorMessage, WidgetCluster, WidgetMode, WidgetOperationRequestMessage } from './protocol'
import type { WidgetTransactionTransport } from './transport'
import type { VerifiedWidgetTransaction, WidgetVerifierLimits } from './verifier'
import type { WalletStandardSigner } from './wallet'
import {
  getBase64Encoder,
  getSignatureFromTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
} from '@solana/kit'
import {
  hostHelloMessageSchema,
  NEUTRAL_TRADE_WIDGET_PROTOCOL,
  NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
  NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS,
  parseWidgetToHostMessage,
  WidgetProtocolError,
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

export type NeutralTradeWidgetEvent
  = | {
    type: 'ready'
    protocolVersion: typeof NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION
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
  builderCode: string
  cluster?: WidgetCluster
  element: HTMLElement | string
  height?: number | string
  launcherLabel?: string
  mode?: WidgetMode
  onEvent?: (event: NeutralTradeWidgetEvent) => void
  rpcUrl?: string
  signer: WalletStandardSigner
  transport?: WidgetTransactionTransport
  vaults: ReadonlyArray<string>
  verifierLimits?: WidgetVerifierLimits
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
  if (typeof window === 'undefined' || typeof document === 'undefined')
    throw new Error('Neutral Trade widget mounting requires a browser environment')
  if (options.rpcUrl && options.transport)
    throw new Error('Provide either rpcUrl or transport, not both')

  const cluster = options.cluster ?? 'mainnet'
  const mode = options.mode ?? 'inline'
  const mountElement = resolveMountElement(options.element)
  const vaults = [...new Set(options.vaults)]
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
  frameContainer.style.background = '#fff'
  frameContainer.style.border = mode === 'floating' ? '1px solid rgba(0, 0, 0, 0.12)' : '0'
  frameContainer.style.borderRadius = mode === 'floating' ? '16px' : '0'
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
    launcher.style.background = '#111827'
    launcher.style.border = '0'
    launcher.style.borderRadius = '999px'
    launcher.style.color = '#fff'
    launcher.style.cursor = 'pointer'
    launcher.style.font = '600 14px/1 system-ui, sans-serif'
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

  const helloMessage = hostHelloMessageSchema.parse({
    protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
    version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
    type: 'host:hello',
    supportedVersions: [...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS],
    config: {
      builderCode: options.builderCode,
      cluster,
      mode,
      vaults,
    },
    wallet: {
      address: options.signer.account.address,
      name: options.signer.wallet.name,
    },
  })

  const sendProtocolError = (
    code: HostProtocolErrorMessage['code'],
    message: string,
    receivedVersion?: number,
  ): void => {
    const protocolMessage = truncateProtocolMessage(message)
    postMessage({
      protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
      version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
      type: 'host:protocol-error',
      code,
      message: protocolMessage,
      ...(receivedVersion === undefined ? {} : { receivedVersion }),
    } satisfies HostProtocolErrorMessage)
  }

  const sendRejectedOperation = (
    request: WidgetOperationRequestMessage,
    error: WidgetBridgeError,
  ): void => {
    const protocolMessage = truncateProtocolMessage(error.message)
    postMessage({
      protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
      version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
      type: 'host:operation-result',
      operation: request.operation,
      requestId: request.requestId,
      result: {
        status: 'rejected',
        code: error.code,
        message: protocolMessage,
        rebuildRequired: error.rebuildRequired,
      },
    } satisfies HostOperationResultMessage)
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

      postMessage({
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
        type: 'host:operation-result',
        operation: request.operation,
        requestId: request.requestId,
        result: {
          status: 'submitted',
          signature: submittedSignature,
        },
      } satisfies HostOperationResultMessage)

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

  const handleMessage = (event: MessageEvent): void => {
    if (!isTrustedWidgetMessageEvent(event, iframe))
      return
    try {
      const message = parseWidgetToHostMessage(event.data)
      if (message.type === 'widget:ready') {
        if (!message.supportedVersions.includes(NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION)) {
          sendProtocolError(
            'unsupported-version',
            `Widget does not support protocol version ${NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION}`,
          )
          emit({
            type: 'error',
            code: 'unsupported-version',
            message: `Widget does not support protocol version ${NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION}`,
          })
          return
        }
        handshakeComplete = true
        emit({
          type: 'ready',
          protocolVersion: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
        })
        return
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
    postMessage(helloMessage)
  }

  const controller: NeutralTradeWidgetController = Object.freeze({
    element: root,
    iframe,
    close,
    destroy(): void {
      if (destroyed)
        return
      destroyed = true
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
