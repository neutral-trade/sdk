import type { Instruction, TransactionSigner } from '@solana/kit'
import {
  appendTransactionMessageInstruction,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,

  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,

} from '@solana/kit'
import { CliError } from './errors'

type CliInstruction = Instruction & {
  accounts: readonly unknown[]
  data: Uint8Array
}

export interface TransactionOptions {
  rpcUrl?: string
  commitment: 'processed' | 'confirmed' | 'finalized'
  skipPreflight?: boolean
}

async function buildSignedTransaction({
  instruction,
  feePayer,
  rpcUrl,
  commitment,
}: {
  instruction: CliInstruction
  feePayer: TransactionSigner
  rpcUrl: string
  commitment: 'processed' | 'confirmed' | 'finalized'
}): Promise<{
  rpc: ReturnType<typeof createSolanaRpc>
  signed: Awaited<ReturnType<typeof signTransactionMessageWithSigners>>
  base64: ReturnType<typeof getBase64EncodedWireTransaction>
}> {
  const rpc = createSolanaRpc(rpcUrl)
  const latest = await rpc.getLatestBlockhash({ commitment }).send()
  const blockhash = 'value' in latest ? latest.value : latest
  const message = appendTransactionMessageInstruction(
    instruction as never,
    setTransactionMessageLifetimeUsingBlockhash(
      blockhash,
      setTransactionMessageFeePayerSigner(feePayer, createTransactionMessage({ version: 0 })),
    ),
  )
  const signed = await signTransactionMessageWithSigners(message)
  return { rpc, signed, base64: getBase64EncodedWireTransaction(signed) }
}

export async function simulateInstructionTransaction({
  instruction,
  feePayer,
  options,
}: {
  instruction: CliInstruction
  feePayer: TransactionSigner
  options: TransactionOptions
}): Promise<unknown> {
  if (!options.rpcUrl)
    throw new CliError('--rpc-url is required for simulate mode')
  const { rpc, base64 } = await buildSignedTransaction({
    instruction,
    feePayer,
    rpcUrl: options.rpcUrl,
    commitment: options.commitment,
  })
  return rpc
    .simulateTransaction(base64, {
      encoding: 'base64',
      sigVerify: true,
      replaceRecentBlockhash: false,
      commitment: options.commitment,
    })
    .send()
}

export async function executeInstructionTransaction({
  instruction,
  feePayer,
  options,
}: {
  instruction: CliInstruction
  feePayer: TransactionSigner
  options: TransactionOptions
}): Promise<unknown> {
  if (!options.rpcUrl)
    throw new CliError('--rpc-url is required for execute mode')
  const { rpc, signed, base64 } = await buildSignedTransaction({
    instruction,
    feePayer,
    rpcUrl: options.rpcUrl,
    commitment: options.commitment,
  })
  const signature = getSignatureFromTransaction(signed)
  const result = await rpc
    .sendTransaction(base64, {
      encoding: 'base64',
      preflightCommitment: options.commitment,
      skipPreflight: Boolean(options.skipPreflight),
    })
    .send()
  return { signature, result }
}
