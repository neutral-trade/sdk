import type { NeutralTradeWidgetEvent, WalletStandardSigner } from '@neutral-trade/widget-sdk'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import type { StandardConnectFeature } from '@wallet-standard/features'
import type { ReactElement } from 'react'
import {
  createWalletStandardSigner,
} from '@neutral-trade/widget-sdk'
import { NeutralTradeWidget } from '@neutral-trade/widget-sdk/react'
import { getWallets } from '@wallet-standard/app'
import {
  StandardConnect,
} from '@wallet-standard/features'
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'

const DEVNET_VAULT = 'HXvKAH4QyYMe7MsxC88pb19MhhYCEDHai87E8tZkmXmB'
const walletRegistry = getWallets()

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

function App(): ReactElement {
  const [wallets, setWallets] = useState<ReadonlyArray<Wallet>>([])
  const [selectedWalletIndex, setSelectedWalletIndex] = useState(0)
  const [signer, setSigner] = useState<WalletStandardSigner>()
  const [eventText, setEventText] = useState('Waiting for a wallet…')
  const vaults = useMemo(() => [DEVNET_VAULT], [])

  useEffect(() => {
    const refreshWallets = (): void => {
      setWallets(walletRegistry.get().filter(wallet => (
        'solana:signTransaction' in wallet.features
      )))
    }
    const unregisterRegisteredListener = walletRegistry.on('register', refreshWallets)
    const unregisterUnregisteredListener = walletRegistry.on('unregister', refreshWallets)
    refreshWallets()
    return () => {
      unregisterRegisteredListener()
      unregisterUnregisteredListener()
    }
  }, [])

  const handleEvent = useCallback((event: NeutralTradeWidgetEvent) => {
    setEventText(formatEvent(event))
  }, [])

  const connect = async (): Promise<void> => {
    const wallet = wallets[selectedWalletIndex]
    if (!wallet)
      return
    try {
      const account = await getConnectedAccount(wallet)
      setSigner(createWalletStandardSigner(wallet, account))
    }
    catch (thrownObject) {
      setEventText(thrownObject instanceof Error
        ? thrownObject.message
        : String(thrownObject))
    }
  }

  return (
    <main>
      <h1>Neutral Trade widget</h1>
      <div className="controls">
        <select
          aria-label="Wallet"
          onChange={event => setSelectedWalletIndex(Number(event.target.value))}
          value={selectedWalletIndex}
        >
          {wallets.map((wallet, index) => (
            <option key={wallet.name} value={index}>{wallet.name}</option>
          ))}
        </select>
        <button disabled={wallets.length === 0} onClick={() => void connect()} type="button">
          Connect wallet
        </button>
      </div>
      {signer && (
        <NeutralTradeWidget
          builderCode="ACME"
          cluster="devnet"
          launcherLabel="Open Neutral Trade"
          mode="floating"
          onEvent={handleEvent}
          signer={signer}
          vaults={vaults}
        />
      )}
      <h2>Lifecycle events</h2>
      <pre>{eventText}</pre>
    </main>
  )
}

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
