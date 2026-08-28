import type { SolanaSignTransactionFeature, SolanaTransactionVersion } from '@solana/wallet-standard-features'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import type { WidgetCluster } from './protocol'
import {
  SolanaSignTransaction,
} from '@solana/wallet-standard-features'

type SolanaSignTransactionFeatureValue
  = SolanaSignTransactionFeature[typeof SolanaSignTransaction]

export interface WalletStandardSigner {
  readonly account: WalletAccount
  readonly wallet: Wallet
}

export class WalletStandardSignerError extends Error {
  readonly code:
    | 'account-not-found'
    | 'chain-not-supported'
    | 'feature-not-supported'
    | 'invalid-wallet-response'
    | 'transaction-version-not-supported'

  constructor(
    code: WalletStandardSignerError['code'],
    message: string,
  ) {
    super(message)
    this.name = 'WalletStandardSignerError'
    this.code = code
  }
}

function getSignTransactionFeature(wallet: Wallet): SolanaSignTransactionFeatureValue {
  const feature = wallet.features[SolanaSignTransaction]
  if (typeof feature !== 'object' || feature === null) {
    throw new WalletStandardSignerError(
      'feature-not-supported',
      `${wallet.name} does not support ${SolanaSignTransaction}`,
    )
  }
  const candidate = feature as Record<string, unknown>
  if (
    candidate.version !== '1.0.0'
    || typeof candidate.signTransaction !== 'function'
    || !Array.isArray(candidate.supportedTransactionVersions)
  ) {
    throw new WalletStandardSignerError(
      'feature-not-supported',
      `${wallet.name} exposes an incompatible ${SolanaSignTransaction} feature`,
    )
  }
  return feature as SolanaSignTransactionFeatureValue
}

function accountPublicKeysEqual(
  first: WalletAccount['publicKey'],
  second: WalletAccount['publicKey'],
): boolean {
  return first.length === second.length
    && first.every((value, index) => value === second[index])
}

function findConnectedAccount(
  wallet: Wallet,
  account: WalletAccount,
): WalletAccount | undefined {
  return wallet.accounts.find(connectedAccount => (
    connectedAccount.address === account.address
    && accountPublicKeysEqual(connectedAccount.publicKey, account.publicKey)
  ))
}

export function createWalletStandardSigner(
  wallet: Wallet,
  account: WalletAccount | undefined = wallet.accounts[0],
): WalletStandardSigner {
  if (!account) {
    throw new WalletStandardSignerError(
      'account-not-found',
      `${wallet.name} has no connected account`,
    )
  }
  const connectedAccount = findConnectedAccount(wallet, account)
  if (!connectedAccount) {
    throw new WalletStandardSignerError(
      'account-not-found',
      `Account ${account.address} is not connected to ${wallet.name}`,
    )
  }
  getSignTransactionFeature(wallet)
  return Object.freeze({ account: connectedAccount, wallet })
}

export function getWalletStandardChain(cluster: WidgetCluster): 'solana:devnet' | 'solana:mainnet' {
  return cluster === 'devnet' ? 'solana:devnet' : 'solana:mainnet'
}

export async function signVerifiedTransaction(
  signer: WalletStandardSigner,
  input: {
    cluster: WidgetCluster
    transaction: Uint8Array
    transactionVersion: SolanaTransactionVersion
  },
): Promise<Uint8Array> {
  const feature = getSignTransactionFeature(signer.wallet)
  const chain = getWalletStandardChain(input.cluster)
  const connectedAccount = findConnectedAccount(signer.wallet, signer.account)
  if (!connectedAccount) {
    throw new WalletStandardSignerError(
      'account-not-found',
      `Account ${signer.account.address} is not connected to ${signer.wallet.name}`,
    )
  }
  if (!connectedAccount.features.includes(SolanaSignTransaction)) {
    throw new WalletStandardSignerError(
      'feature-not-supported',
      `Account ${connectedAccount.address} cannot sign Solana transactions`,
    )
  }
  if (!connectedAccount.chains.includes(chain)) {
    throw new WalletStandardSignerError(
      'chain-not-supported',
      `Account ${connectedAccount.address} does not support ${chain}`,
    )
  }
  if (!feature.supportedTransactionVersions.includes(input.transactionVersion)) {
    throw new WalletStandardSignerError(
      'transaction-version-not-supported',
      `${signer.wallet.name} does not support transaction version ${input.transactionVersion}`,
    )
  }

  const outputs = await feature.signTransaction({
    account: connectedAccount,
    chain,
    transaction: input.transaction.slice(),
  })
  if (
    outputs.length !== 1
    || !(outputs[0]?.signedTransaction instanceof Uint8Array)
  ) {
    throw new WalletStandardSignerError(
      'invalid-wallet-response',
      `${signer.wallet.name} returned an invalid signed transaction`,
    )
  }
  return outputs[0].signedTransaction.slice()
}
