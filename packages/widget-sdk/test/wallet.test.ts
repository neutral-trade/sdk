import type { SolanaSignTransactionFeature } from '@solana/wallet-standard-features'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import assert from 'node:assert'
import { describe, test } from 'node:test'
import {
  SolanaSignTransaction,
} from '@solana/wallet-standard-features'
import {
  createWalletStandardSigner,
  signVerifiedTransaction,
  WalletStandardSignerError,
} from '../src/wallet'
import { FIXTURE_ADDRESSES } from './fixtures/transactions'

function createFixtureWallet(
  signTransaction: SolanaSignTransactionFeature[typeof SolanaSignTransaction]['signTransaction'],
): { account: WalletAccount, wallet: Wallet } {
  const account: WalletAccount = {
    address: FIXTURE_ADDRESSES.user,
    chains: ['solana:devnet'],
    features: [SolanaSignTransaction],
    publicKey: new Uint8Array(32).fill(15),
  }
  const wallet: Wallet = {
    accounts: [account],
    chains: ['solana:devnet'],
    features: {
      [SolanaSignTransaction]: {
        version: '1.0.0',
        supportedTransactionVersions: [0],
        signTransaction,
      },
    },
    icon: 'data:image/svg+xml;base64,AA==',
    name: 'Fixture Wallet',
    version: '1.0.0',
  }
  return { account, wallet }
}

describe('wallet Standard adapter', () => {
  test('uses solana:signTransaction with the selected account and cluster', async () => {
    const transaction = new Uint8Array([1, 2, 3, 4])
    let receivedChain: string | undefined
    let receivedAccount: WalletAccount | undefined
    const { account, wallet } = createFixtureWallet(async (...inputs) => {
      assert.equal(inputs.length, 1)
      receivedChain = inputs[0]?.chain
      receivedAccount = inputs[0]?.account
      return [{ signedTransaction: inputs[0]?.transaction ?? new Uint8Array() }]
    })
    const signer = createWalletStandardSigner(wallet, account)

    const signedTransaction = await signVerifiedTransaction(signer, {
      cluster: 'devnet',
      transaction,
      transactionVersion: 0,
    })

    assert.equal(receivedChain, 'solana:devnet')
    assert.equal(receivedAccount, account)
    assert.deepEqual(signedTransaction, transaction)
    assert.notEqual(signedTransaction, transaction)
  })

  test('refuses a cluster the account does not support', async () => {
    const { account, wallet } = createFixtureWallet(async (...inputs) => inputs.map(input => ({
      signedTransaction: input.transaction,
    })))
    const signer = createWalletStandardSigner(wallet, account)

    await assert.rejects(
      signVerifiedTransaction(signer, {
        cluster: 'mainnet',
        transaction: new Uint8Array([1]),
        transactionVersion: 0,
      }),
      (thrownObject: unknown) => {
        assert(thrownObject instanceof WalletStandardSignerError)
        assert.equal(thrownObject.code, 'chain-not-supported')
        return true
      },
    )
  })

  test('accepts an equivalent connected account object', () => {
    const { account, wallet } = createFixtureWallet(async () => [])
    const equivalentAccount: WalletAccount = {
      ...account,
      publicKey: account.publicKey.slice(),
    }

    const signer = createWalletStandardSigner(wallet, equivalentAccount)

    assert.equal(signer.account, account)
  })

  test('signs with the wallet current equivalent account object', async () => {
    let receivedAccount: WalletAccount | undefined
    const { account, wallet } = createFixtureWallet(async (...inputs) => {
      receivedAccount = inputs[0]?.account
      return inputs.map(input => ({ signedTransaction: input.transaction }))
    })
    const signer = createWalletStandardSigner(wallet, account)
    const refreshedAccount: WalletAccount = {
      ...account,
      publicKey: account.publicKey.slice(),
    }
    Object.defineProperty(wallet, 'accounts', { value: [refreshedAccount] })

    await signVerifiedTransaction(signer, {
      cluster: 'devnet',
      transaction: new Uint8Array([1]),
      transactionVersion: 0,
    })

    assert.equal(receivedAccount, refreshedAccount)
  })

  test('refuses accounts that are not connected to the wallet', () => {
    const { account, wallet } = createFixtureWallet(async () => [])
    const disconnectedAccount: WalletAccount = {
      ...account,
      address: FIXTURE_ADDRESSES.alternateUser,
    }
    assert.throws(
      () => createWalletStandardSigner(wallet, disconnectedAccount),
      WalletStandardSignerError,
    )
  })
})
