import type { Wallet, WalletAccount } from '@wallet-standard/base'
import type { Root } from 'react-dom/client'
import type { NeutralTradeWidgetEvent } from '../src/mount'
import type { WidgetTransactionTransport } from '../src/transport'
import type { WalletStandardSigner } from '../src/wallet'
import assert from 'node:assert'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createElement, Fragment, StrictMode, useState } from 'react'
import {
  NEUTRAL_TRADE_WIDGET_ORIGIN,
} from '../src/mount'
import {
  NEUTRAL_TRADE_WIDGET_PROTOCOL,
  NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
} from '../src/protocol'
import { NeutralTradeWidget } from '../src/react'
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

interface HarnessProps {
  maxComputeUnitLimit: number
  vault: string
}

function Harness({ maxComputeUnitLimit, vault }: HarnessProps) {
  const [readyEventCount, setReadyEventCount] = useState(0)
  const handleEvent = (event: NeutralTradeWidgetEvent): void => {
    if (event.type === 'ready')
      setReadyEventCount(count => count + 1)
  }

  return createElement(
    Fragment,
    null,
    createElement('output', { id: 'ready-event-count' }, readyEventCount),
    createElement(NeutralTradeWidget, {
      ref: () => {},
      builderCode: 'ACME',
      cluster: 'devnet',
      mode: 'inline',
      onEvent: handleEvent,
      signer,
      transport,
      vaults: [vault],
      verifierLimits: { maxComputeUnitLimit },
    }),
  )
}

const BROWSER_GLOBAL_NAMES = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLIFrameElement',
  'Event',
  'MessageEvent',
  'KeyboardEvent',
  'MutationObserver',
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
  previousDescriptors.set(
    'IS_REACT_ACT_ENVIRONMENT',
    Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'),
  )
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
    writable: true,
  })

  return () => {
    for (const [propertyName, descriptor] of previousDescriptors) {
      if (descriptor)
        Object.defineProperty(globalThis, propertyName, descriptor)
      else
        delete globalRecord[propertyName]
    }
  }
}

test('preserves the iframe across equivalent React prop identities', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    pretendToBeVisual: true,
    url: 'https://partner.example',
  })
  const restoreBrowserGlobals = installBrowserGlobals(dom)
  let reactRoot: Root | undefined
  try {
    const { act } = await import('react')
    const { createRoot } = await import('react-dom/client')
    const container = dom.window.document.querySelector<HTMLElement>('#root')
    assert(container)
    reactRoot = createRoot(container)

    await act(async () => {
      reactRoot?.render(createElement(
        StrictMode,
        null,
        createElement(Harness, {
          maxComputeUnitLimit: 300_000,
          vault: FIXTURE_ADDRESSES.vault,
        }),
      ))
    })
    const initialIframe = container.querySelector('iframe')
    assert(initialIframe)
    assert(initialIframe.contentWindow)

    await act(async () => {
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        data: {
          protocol: NEUTRAL_TRADE_WIDGET_PROTOCOL,
          version: NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION,
          type: 'widget:ready',
          supportedVersions: [NEUTRAL_TRADE_WIDGET_PROTOCOL_VERSION],
        },
        origin: NEUTRAL_TRADE_WIDGET_ORIGIN,
        source: initialIframe.contentWindow,
      }))
    })

    assert.equal(
      container.querySelector('#ready-event-count')?.textContent,
      '1',
    )
    assert.equal(container.querySelector('iframe'), initialIframe)

    await act(async () => {
      reactRoot?.render(createElement(
        StrictMode,
        null,
        createElement(Harness, {
          maxComputeUnitLimit: 300_000,
          vault: FIXTURE_ADDRESSES.alternateVault,
        }),
      ))
    })
    const vaultChangedIframe = container.querySelector('iframe')
    assert(vaultChangedIframe)
    assert.notEqual(vaultChangedIframe, initialIframe)

    await act(async () => {
      reactRoot?.render(createElement(
        StrictMode,
        null,
        createElement(Harness, {
          maxComputeUnitLimit: 400_000,
          vault: FIXTURE_ADDRESSES.alternateVault,
        }),
      ))
    })
    assert.notEqual(container.querySelector('iframe'), vaultChangedIframe)
  }
  finally {
    if (reactRoot) {
      const { act } = await import('react')
      await act(async () => reactRoot?.unmount())
    }
    restoreBrowserGlobals()
    dom.window.close()
  }
})
