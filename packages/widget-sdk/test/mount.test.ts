import type { Wallet, WalletAccount } from '@wallet-standard/base'
import type { MountNeutralTradeWidgetOptions, NeutralTradeWidgetEvent } from '../src/mount'
import type { WidgetTransactionTransport } from '../src/transport'
import type { WalletStandardSigner } from '../src/wallet'
import assert from 'node:assert'
import { describe, test } from 'node:test'
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
import { FIXTURE_ADDRESSES } from './fixtures/transactions'

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

      assert.deepEqual(messages, [{
        protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
        version: NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[0],
        type: 'host:hello',
        supportedVersions: [NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[0]],
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
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        data: {
          protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
          version: NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[0],
          type: 'widget:ready',
          supportedVersions: [NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[0]],
        },
        origin: NEUTRAL_TRADE_WIDGET_ORIGIN,
        source: controller.iframe.contentWindow,
      }))
      assert.deepEqual(events, [{
        type: 'ready',
        protocolVersion: NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS[0],
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
        version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
        type: 'host:hello',
        supportedVersions: [...NEUTRAL_TRADE_WIDGET_SUPPORTED_VERSIONS],
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
        version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
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
