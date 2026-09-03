import type { SolanaSignTransactionFeature } from '@solana/wallet-standard-features'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import type { MountNeutralTradeWidgetOptions, NeutralTradeWidgetEvent } from '../src/mount'
import type { WidgetTransactionTransport } from '../src/transport'
import type { WalletStandardSigner } from '../src/wallet'
import assert from 'node:assert'
import { describe, test } from 'node:test'
import {
  getBase64Decoder,
  getSignatureFromTransaction,
  getTransactionDecoder,
} from '@solana/kit'
import { SolanaSignTransaction } from '@solana/wallet-standard-features'
import { JSDOM } from 'jsdom'
import {
  mountNeutralTradeWidget,
  NEUTRAL_TRADE_WIDGET_ORIGIN,
  WidgetConfigurationError,
} from '../src/mount'
import {
  NEUTRAL_TRADE_WIDGET_PROTOCOL,
  NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
  NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS,
} from '../src/protocol'
import {
  createDepositFixture,
  fillSignatureSlot,
  FIXTURE_ADDRESSES,
} from './fixtures/transactions'

const account = {
  address: FIXTURE_ADDRESSES.user,
  chains: ['solana:devnet'],
  features: ['solana:signTransaction'],
  publicKey: new Uint8Array(32).fill(15),
} as WalletAccount
const wallet = {
  accounts: [account],
  chains: ['solana:devnet'],
  features: {},
  icon: 'data:image/svg+xml;base64,AA==',
  name: 'Fixture Wallet',
  version: '1.0.0',
} as Wallet
const signer: WalletStandardSigner = { account, wallet }
const transport: WidgetTransactionTransport = Object.freeze({
  confirmTransaction: async () => {},
  isBlockhashValid: async () => true,
  sendTransaction: async () => 'fixture-signature',
})
const protocolVersion1 = NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[0]
const protocolVersion2 = NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[1]

const BROWSER_GLOBAL_NAMES = [
  'window',
  'document',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLIFrameElement',
  'Event',
  'MessageEvent',
  'KeyboardEvent',
] as const

function installBrowserGlobals(dom: JSDOM): () => void {
  const globalRecord = globalThis as unknown as Record<string, unknown>
  const windowRecord = dom.window as unknown as Record<string, unknown>
  const previousDescriptors = new Map<string, PropertyDescriptor | undefined>()
  for (const propertyName of BROWSER_GLOBAL_NAMES) {
    previousDescriptors.set(
      propertyName,
      Object.getOwnPropertyDescriptor(globalThis, propertyName),
    )
    Object.defineProperty(globalThis, propertyName, {
      configurable: true,
      value: windowRecord[propertyName],
      writable: true,
    })
  }

  return () => {
    for (const [propertyName, descriptor] of previousDescriptors) {
      if (descriptor)
        Object.defineProperty(globalThis, propertyName, descriptor)
      else
        delete globalRecord[propertyName]
    }
  }
}

function getCommonOptions(): Omit<
  MountNeutralTradeWidgetOptions,
  'builderAddress' | 'builderCode'
> {
  return {
    cluster: 'devnet',
    element: '#widget',
    mode: 'inline',
    signer,
    transport,
    vaults: [FIXTURE_ADDRESSES.vault],
  }
}

function captureBridgeMessages(
  iframe: HTMLIFrameElement,
): Array<unknown> {
  const iframeWindow = iframe.contentWindow
  assert(iframeWindow)
  const messages: Array<unknown> = []
  iframeWindow.postMessage = ((message: unknown) => {
    messages.push(message)
  }) as typeof iframeWindow.postMessage
  iframe.dispatchEvent(new Event('load'))
  return messages
}

function createSigningSigner(): WalletStandardSigner {
  const signTransaction: SolanaSignTransactionFeature[
    typeof SolanaSignTransaction
  ]['signTransaction'] = async (...inputs) => inputs.map(input => ({
    signedTransaction: fillSignatureSlot(input.transaction),
  }))
  const signingAccount: WalletAccount = {
    ...account,
    features: [SolanaSignTransaction],
  }
  const signingWallet: Wallet = {
    accounts: [signingAccount],
    chains: ['solana:devnet'],
    features: {
      [SolanaSignTransaction]: {
        version: '1.0.0',
        supportedTransactionVersions: [0],
        signTransaction,
      },
    },
    icon: 'data:image/svg+xml;base64,AA==',
    name: 'Signing Fixture Wallet',
    version: '1.0.0',
  }
  return { account: signingAccount, wallet: signingWallet }
}

describe('mount attribution configuration', () => {
  test('throws a typed error when both or neither builder option is provided', () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    try {
      for (const attributionOptions of [
        {},
        {
          builderAddress: FIXTURE_ADDRESSES.referrer,
          builderCode: 'ACME',
        },
      ]) {
        assert.throws(
          () => mountNeutralTradeWidget({
            ...getCommonOptions(),
            ...attributionOptions,
          }),
          (thrownObject: unknown) => {
            assert(thrownObject instanceof WidgetConfigurationError)
            assert.equal(thrownObject.code, 'invalid-attribution-config')
            return true
          },
        )
      }
      assert.equal(dom.window.document.querySelector('#widget')?.childElementCount, 0)
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })

  test('rejects a malformed builderAddress before creating bridge elements', () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    try {
      assert.throws(
        () => mountNeutralTradeWidget({
          ...getCommonOptions(),
          builderAddress: 'not-base58',
        }),
        (thrownObject: unknown) => {
          assert(thrownObject instanceof WidgetConfigurationError)
          assert.equal(thrownObject.code, 'invalid-builder-address')
          return true
        },
      )
      assert.equal(dom.window.document.querySelector('#widget')?.childElementCount, 0)
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })

  test('sends an unchanged v1 hello for builderCode mode', () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    const events: Array<NeutralTradeWidgetEvent> = []
    try {
      const controller = mountNeutralTradeWidget({
        ...getCommonOptions(),
        builderCode: 'ACME',
        onEvent: event => events.push(event),
      })
      const messages = captureBridgeMessages(controller.iframe)
      const expectedBackground = dom.window.document.createElement('div')
      expectedBackground.style.background = '#0c0c0c'

      assert.deepEqual(messages, [{
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: protocolVersion1,
        type: 'host:hello',
        supportedVersions: [protocolVersion1],
        config: {
          builderCode: 'ACME',
          cluster: 'devnet',
          mode: 'inline',
          vaults: [FIXTURE_ADDRESSES.vault],
        },
        wallet: {
          address: FIXTURE_ADDRESSES.user,
          name: 'Fixture Wallet',
        },
      }])
      assert.equal(
        controller.iframe.parentElement?.style.background,
        expectedBackground.style.background,
      )
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        data: {
          protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
          version: protocolVersion1,
          type: 'widget:ready',
          supportedVersions: [protocolVersion1],
        },
        origin: NEUTRAL_TRADE_WIDGET_ORIGIN,
        source: controller.iframe.contentWindow,
      }))
      assert.deepEqual(events, [{
        type: 'ready',
        protocolVersion: protocolVersion1,
      }])
      controller.destroy()
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })

  test('sends a v2 hello for builderAddress mode', () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    try {
      const controller = mountNeutralTradeWidget({
        ...getCommonOptions(),
        builderAddress: FIXTURE_ADDRESSES.referrer,
      })
      const messages = captureBridgeMessages(controller.iframe)

      assert.deepEqual(messages, [{
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: protocolVersion2,
        type: 'host:hello',
        supportedVersions: [protocolVersion1, protocolVersion2],
        config: {
          builderAddress: FIXTURE_ADDRESSES.referrer,
          cluster: 'devnet',
          mode: 'inline',
          vaults: [FIXTURE_ADDRESSES.vault],
        },
        wallet: {
          address: FIXTURE_ADDRESSES.user,
          name: 'Fixture Wallet',
        },
      }])
      controller.destroy()
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })

  test('reports a v1-only hosted widget that silently ignores address mode', () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    const events: Array<NeutralTradeWidgetEvent> = []
    let timeoutHandler: TimerHandler | undefined
    dom.window.setTimeout = ((handler: TimerHandler) => {
      timeoutHandler = handler
      return 1
    }) as typeof dom.window.setTimeout
    dom.window.clearTimeout = (() => {}) as typeof dom.window.clearTimeout
    try {
      const controller = mountNeutralTradeWidget({
        ...getCommonOptions(),
        builderAddress: FIXTURE_ADDRESSES.referrer,
        onEvent: event => events.push(event),
      })
      const messages = captureBridgeMessages(controller.iframe)
      assert.equal(typeof timeoutHandler, 'function')
      if (typeof timeoutHandler === 'function')
        timeoutHandler()

      assert.deepEqual(events, [{
        type: 'error',
        code: 'unsupported-version',
        message: 'hosted widget does not support builderAddress yet',
      }])
      assert.deepEqual(messages[1], {
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: protocolVersion2,
        type: 'host:protocol-error',
        code: 'unsupported-version',
        message: 'hosted widget does not support builderAddress yet',
      })
      controller.destroy()
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })
})

describe('mount theming', () => {
  test('rejects an invalid theme before creating an iframe', () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    try {
      assert.throws(
        () => mountNeutralTradeWidget({
          ...getCommonOptions(),
          builderCode: 'ACME',
          theme: { accent: 'red' },
        }),
        (thrownObject: unknown) => {
          assert(thrownObject instanceof WidgetConfigurationError)
          assert.equal(thrownObject.code, 'invalid-theme')
          return true
        },
      )
      assert.equal(dom.window.document.querySelector('iframe'), null)
      assert.equal(dom.window.document.querySelector('#widget')?.childElementCount, 0)
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })

  test('sends a v3 theme and applies its host chrome tokens', () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    try {
      const theme = {
        accent: '#ff0000',
        background: '#123456',
        fontFamily: 'system' as const,
        radius: 9,
        text: '#f5f5f5',
      }
      const controller = mountNeutralTradeWidget({
        ...getCommonOptions(),
        builderCode: 'ACME',
        mode: 'floating',
        theme,
      })
      const messages = captureBridgeMessages(controller.iframe)

      assert.deepEqual(messages, [{
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
        type: 'host:hello',
        supportedVersions: [...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS],
        config: {
          builderCode: 'ACME',
          cluster: 'devnet',
          mode: 'floating',
          vaults: [FIXTURE_ADDRESSES.vault],
          theme,
        },
        wallet: {
          address: FIXTURE_ADDRESSES.user,
          name: 'Fixture Wallet',
        },
      }])

      const expectedStyle = dom.window.document.createElement('div').style
      const frameContainer = controller.iframe.parentElement
      const launcher = controller.element.querySelector<HTMLButtonElement>('button')
      assert(frameContainer)
      assert(launcher)
      expectedStyle.background = theme.background
      assert.equal(frameContainer.style.background, expectedStyle.background)
      assert.equal(frameContainer.style.borderRadius, '9px')
      expectedStyle.background = theme.accent
      assert.equal(launcher.style.background, expectedStyle.background)
      expectedStyle.color = theme.text
      assert.equal(launcher.style.color, expectedStyle.color)
      assert.equal(launcher.style.fontFamily, 'system-ui')

      controller.destroy()
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })

  test('retries a themed code mount with a v1 hello after timeout', () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    const events: Array<NeutralTradeWidgetEvent> = []
    const timeoutHandlers: Array<TimerHandler> = []
    dom.window.setTimeout = ((handler: TimerHandler) => {
      timeoutHandlers.push(handler)
      return timeoutHandlers.length
    }) as typeof dom.window.setTimeout
    dom.window.clearTimeout = (() => {}) as typeof dom.window.clearTimeout
    try {
      const controller = mountNeutralTradeWidget({
        ...getCommonOptions(),
        builderCode: 'ACME',
        onEvent: event => events.push(event),
        theme: { accent: '#ff0000' },
      })
      const messages = captureBridgeMessages(controller.iframe)
      assert.equal(timeoutHandlers.length, 1)

      const initialTimeoutHandler = timeoutHandlers[0]
      assert.equal(typeof initialTimeoutHandler, 'function')
      if (typeof initialTimeoutHandler === 'function')
        initialTimeoutHandler()

      assert.deepEqual(messages[1], {
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: protocolVersion1,
        type: 'host:hello',
        supportedVersions: [protocolVersion1],
        config: {
          builderCode: 'ACME',
          cluster: 'devnet',
          mode: 'inline',
          vaults: [FIXTURE_ADDRESSES.vault],
        },
        wallet: {
          address: FIXTURE_ADDRESSES.user,
          name: 'Fixture Wallet',
        },
      })
      assert.deepEqual(events, [])
      assert.equal(timeoutHandlers.length, 2)

      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        data: {
          protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
          version: protocolVersion1,
          type: 'widget:ready',
          supportedVersions: [protocolVersion1],
        },
        origin: NEUTRAL_TRADE_WIDGET_ORIGIN,
        source: controller.iframe.contentWindow,
      }))
      assert.deepEqual(events, [
        { type: 'ready', protocolVersion: protocolVersion1 },
        {
          type: 'error',
          code: 'theme-unsupported',
          message: 'hosted widget does not support theme customization yet',
        },
      ])

      const fallbackTimeoutHandler = timeoutHandlers[1]
      if (typeof fallbackTimeoutHandler === 'function')
        fallbackTimeoutHandler()
      assert.equal(events.length, 2)
      controller.destroy()
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })

  test('reports an unanswered themed code fallback', () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    const events: Array<NeutralTradeWidgetEvent> = []
    const timeoutHandlers: Array<TimerHandler> = []
    dom.window.setTimeout = ((handler: TimerHandler) => {
      timeoutHandlers.push(handler)
      return timeoutHandlers.length
    }) as typeof dom.window.setTimeout
    dom.window.clearTimeout = (() => {}) as typeof dom.window.clearTimeout
    try {
      const controller = mountNeutralTradeWidget({
        ...getCommonOptions(),
        builderCode: 'ACME',
        onEvent: event => events.push(event),
        theme: { accent: '#ff0000' },
      })
      const messages = captureBridgeMessages(controller.iframe)

      const initialTimeoutHandler = timeoutHandlers[0]
      assert.equal(typeof initialTimeoutHandler, 'function')
      if (typeof initialTimeoutHandler === 'function')
        initialTimeoutHandler()
      const fallbackTimeoutHandler = timeoutHandlers[1]
      assert.equal(typeof fallbackTimeoutHandler, 'function')
      if (typeof fallbackTimeoutHandler === 'function')
        fallbackTimeoutHandler()

      assert.deepEqual(events, [{
        type: 'error',
        code: 'unsupported-version',
        message: 'hosted widget did not complete the version handshake',
      }])
      assert.deepEqual(messages[2], {
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: protocolVersion1,
        type: 'host:protocol-error',
        code: 'unsupported-version',
        message: 'hosted widget did not complete the version handshake',
      })
      controller.destroy()
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })

  test('negotiates a themed v3 mount down to v2 and completes a deposit', async () => {
    const dom = new JSDOM('<!doctype html><div id="widget"></div>', {
      url: 'https://partner.example',
    })
    const restoreBrowserGlobals = installBrowserGlobals(dom)
    const events: Array<NeutralTradeWidgetEvent> = []
    let resolveDepositSubmitted: (() => void) | undefined
    const depositSubmitted = new Promise<void>((resolve) => {
      resolveDepositSubmitted = resolve
    })
    try {
      const operationalTransport: WidgetTransactionTransport = {
        confirmTransaction: async () => {},
        isBlockhashValid: async () => true,
        sendTransaction: async wireTransaction => getSignatureFromTransaction(
          getTransactionDecoder().decode(wireTransaction),
        ),
      }
      const controller = mountNeutralTradeWidget({
        ...getCommonOptions(),
        builderCode: 'ACME',
        onEvent: (event) => {
          events.push(event)
          if (event.type === 'deposit-submitted')
            resolveDepositSubmitted?.()
        },
        signer: createSigningSigner(),
        theme: { accent: '#ff0000' },
        transport: operationalTransport,
      })
      const messages = captureBridgeMessages(controller.iframe)
      assert.deepEqual(messages[0], {
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
        type: 'host:hello',
        supportedVersions: [...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS],
        config: {
          builderCode: 'ACME',
          cluster: 'devnet',
          mode: 'inline',
          vaults: [FIXTURE_ADDRESSES.vault],
          theme: { accent: '#ff0000' },
        },
        wallet: {
          address: FIXTURE_ADDRESSES.user,
          name: 'Signing Fixture Wallet',
        },
      })

      const dispatchReady = (): void => {
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
          data: {
            protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
            version: protocolVersion2,
            type: 'widget:ready',
            supportedVersions: [protocolVersion1, protocolVersion2],
          },
          origin: NEUTRAL_TRADE_WIDGET_ORIGIN,
          source: controller.iframe.contentWindow,
        }))
      }
      dispatchReady()
      assert.deepEqual(events, [])
      assert.deepEqual(messages[1], {
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: protocolVersion2,
        type: 'host:hello',
        supportedVersions: [protocolVersion1, protocolVersion2],
        config: {
          builderCode: 'ACME',
          cluster: 'devnet',
          mode: 'inline',
          vaults: [FIXTURE_ADDRESSES.vault],
        },
        wallet: {
          address: FIXTURE_ADDRESSES.user,
          name: 'Signing Fixture Wallet',
        },
      })

      dispatchReady()
      assert.deepEqual(events, [
        { type: 'ready', protocolVersion: protocolVersion2 },
        {
          type: 'error',
          code: 'theme-unsupported',
          message: 'hosted widget does not support theme customization yet',
        },
      ])
      dispatchReady()
      assert.deepEqual(events, [
        { type: 'ready', protocolVersion: protocolVersion2 },
        {
          type: 'error',
          code: 'theme-unsupported',
          message: 'hosted widget does not support theme customization yet',
        },
      ])

      const wireTransaction = await createDepositFixture()
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        data: {
          protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
          version: protocolVersion2,
          type: 'widget:operation-request',
          operation: 'deposit',
          requestId: 'downgraded-deposit',
          transaction: getBase64Decoder().decode(wireTransaction),
          amount: '8765432',
          attribution: {
            status: 'unavailable',
            reason: 'builder-code-unrecognized',
          },
          user: FIXTURE_ADDRESSES.user,
          vault: FIXTURE_ADDRESSES.vault,
        },
        origin: NEUTRAL_TRADE_WIDGET_ORIGIN,
        source: controller.iframe.contentWindow,
      }))
      await depositSubmitted

      const submittedEvent = events.find(event => event.type === 'deposit-submitted')
      assert(submittedEvent)
      assert.deepEqual(messages.at(-1), {
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: protocolVersion2,
        type: 'host:operation-result',
        operation: 'deposit',
        requestId: 'downgraded-deposit',
        result: {
          status: 'submitted',
          signature: submittedEvent.signature,
        },
      })
      assert.equal(
        events.filter(event => (
          event.type === 'error' && event.code === 'theme-unsupported'
        )).length,
        1,
      )
      assert.equal(events.filter(event => event.type === 'ready').length, 1)
      controller.destroy()
    }
    finally {
      restoreBrowserGlobals()
      dom.window.close()
    }
  })
})
