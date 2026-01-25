// constants/client.ts

import type { Wallet } from '@coral-xyz/anchor'
import { AnchorProvider } from '@coral-xyz/anchor'
import { AnchorProvider as AnchorProvider32 } from '@coral-xyz/anchor-32'
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

export function createAnchorProviderV29(connection: Connection, wallet?: Wallet): AnchorProvider {
  return new AnchorProvider(
    connection,
    wallet ?? createDummyWallet(),
    AnchorProvider.defaultOptions(),
  )
}

export function createAnchorProviderV32(connection: Connection, wallet?: Wallet): AnchorProvider32 {
  return new AnchorProvider32(
    connection,
    wallet ?? createDummyWallet(),
    AnchorProvider32.defaultOptions(),
  )
}
