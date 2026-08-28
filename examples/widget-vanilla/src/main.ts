import type { NeutralTradeWidgetController, NeutralTradeWidgetEvent } from '@neutral-trade/widget-sdk'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import type { StandardConnectFeature } from '@wallet-standard/features'
import {
  createWalletStandardSigner,
  mount,
} from '@neutral-trade/widget-sdk'
import { getWallets } from '@wallet-standard/app'
import {
  StandardConnect,
} from '@wallet-standard/features'

const DEVNET_VAULT = 'HXvKAH4QyYMe7MsxC88pb19MhhYCEDHai87E8tZkmXmB'
const builderAddress = new URL(window.location.href).searchParams.get('builderAddress')
const builderAttribution = builderAddress
  ? { builderAddress }
  : { builderCode: 'ACME' }
const walletRegistry = getWallets()
const walletSelect = document.querySelector<HTMLSelectElement>('#wallet')!
const connectButton = document.querySelector<HTMLButtonElement>('#connect')!
const eventOutput = document.querySelector<HTMLPreElement>('#events')!
let controller: NeutralTradeWidgetController | undefined
let wallets: ReadonlyArray<Wallet> = []

function isConnectFeature(
  value: unknown,
): value is StandardConnectFeature[typeof StandardConnect] {
  if (typeof value !== 'object' || value === null)
    return false
  return typeof (value as Record<string, unknown>).connect === 'function'
}

async function getConnectedAccount(wallet: Wallet): Promise<WalletAccount> {
  const existingAccount = wallet.accounts[0]
  if (existingAccount)
    return existingAccount
  const connectFeature = wallet.features[StandardConnect]
  if (!isConnectFeature(connectFeature))
    throw new Error(`${wallet.name} has no connected account and cannot connect`)
  const result = await connectFeature.connect()
  const connectedAccount = result.accounts[0]
  if (!connectedAccount)
    throw new Error(`${wallet.name} did not return an account`)
  return connectedAccount
}

function formatEvent(event: NeutralTradeWidgetEvent): string {
  return JSON.stringify(
    event,
    (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value,
    2,
  )
}

function refreshWallets(): void {
  wallets = walletRegistry.get().filter(wallet => (
    'solana:signTransaction' in wallet.features
  ))
  walletSelect.replaceChildren(...wallets.map((wallet, index) => {
    const option = document.createElement('option')
    option.value = String(index)
    option.textContent = wallet.name
    return option
  }))
  connectButton.disabled = wallets.length === 0
  if (wallets.length === 0)
    eventOutput.textContent = 'Install a Wallet Standard compatible Solana wallet.'
}

connectButton.addEventListener('click', async () => {
  const wallet = wallets[Number(walletSelect.value)]
  if (!wallet)
    return
  connectButton.disabled = true
  try {
    const account = await getConnectedAccount(wallet)
    controller?.destroy()
    controller = mount({
      ...builderAttribution,
      cluster: 'devnet',
      element: '#widget',
      mode: 'inline',
      onEvent: (event) => {
        eventOutput.textContent = formatEvent(event)
      },
      signer: createWalletStandardSigner(wallet, account),
      vaults: [DEVNET_VAULT],
    })
  }
  catch (thrownObject) {
    const message = thrownObject instanceof Error
      ? thrownObject.message
      : String(thrownObject)
    eventOutput.textContent = message
  }
  finally {
    connectButton.disabled = false
  }
})

walletRegistry.on('register', refreshWallets)
walletRegistry.on('unregister', refreshWallets)
refreshWallets()
