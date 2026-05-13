import type { Connection, Keypair, TransactionInstruction } from '@solana/web3.js'
import { TransactionMessage, VersionedTransaction } from '@solana/web3.js'

/** Build a v0 transaction, sign with `payer`, broadcast, and confirm. */
export async function sendV0Transaction(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message()
  const tx = new VersionedTransaction(message)
  tx.sign([payer])
  const signature = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  })
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  )
  return signature
}
