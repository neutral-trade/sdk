// constants/client.ts

import type { Wallet } from '@coral-xyz/anchor'
import { AnchorProvider } from '@coral-xyz/anchor'
import { Connection, Keypair } from '@solana/web3.js'
import { ZERO_ADDRESS } from './addr'

/* ------------------------------------------------------------------ *
 *  Dummy Wallet for Read-Only Operations                            *
 * ------------------------------------------------------------------ */
export function createDummyWallet(): Wallet {
  return {
    publicKey: ZERO_ADDRESS,
    signTransaction: async tx => tx,
    signAllTransactions: async txs => txs,
    payer: Keypair.generate(),
  }
}

/* ------------------------------------------------------------------ *
 *  Factory functions to create providers from rpcUrl                 *
 * ------------------------------------------------------------------ */
export function createConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, 'confirmed')
}

export function createAnchorProvider(connection: Connection, wallet?: Wallet): AnchorProvider {
  return new AnchorProvider(
    connection,
    wallet ?? createDummyWallet(),
    AnchorProvider.defaultOptions(),
  )
}
