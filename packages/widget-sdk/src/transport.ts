import type { WidgetCluster } from './protocol'
import {
  createSolanaRpc,
  getBase64EncodedWireTransaction,
  getTransactionDecoder,
  blockhash as parseBlockhash,
  signature as parseSignature,
} from '@solana/kit'

const DEFAULT_CONFIRMATION_TIMEOUT_MS = 90_000
const DEFAULT_CONFIRMATION_POLL_INTERVAL_MS = 1_000

export const DEFAULT_WIDGET_RPC_URLS: Readonly<Record<WidgetCluster, string>> = Object.freeze({
  devnet: 'https://api.devnet.solana.com',
  mainnet: 'https://api.mainnet-beta.solana.com',
})

export interface ConfirmTransactionInput {
  blockhash: string
  signal: AbortSignal
  signature: string
}

export interface WidgetTransactionTransport {
  confirmTransaction: (input: ConfirmTransactionInput) => Promise<void>
  isBlockhashValid: (blockhash: string) => Promise<boolean>
  sendTransaction: (signedWireTransaction: Uint8Array) => Promise<string>
}

export interface RpcTransactionTransportConfig {
  confirmationPollIntervalMs?: number
  confirmationTimeoutMs?: number
  rpcUrl?: string
}

function stringifyTransactionError(transactionError: unknown): string {
  if (typeof transactionError === 'string')
    return transactionError
  try {
    return JSON.stringify(transactionError)
  }
  catch {
    return String(transactionError)
  }
}

function waitForNextPoll(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Transaction confirmation was cancelled'))
      return
    }
    let timeout: ReturnType<typeof setTimeout>
    const handleAbort = (): void => {
      clearTimeout(timeout)
      reject(new Error('Transaction confirmation was cancelled'))
    }
    timeout = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, milliseconds)
    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

export function createRpcTransactionTransport(
  cluster: WidgetCluster,
  config: RpcTransactionTransportConfig = {},
): WidgetTransactionTransport {
  const rpc = createSolanaRpc(config.rpcUrl ?? DEFAULT_WIDGET_RPC_URLS[cluster])
  const confirmationPollIntervalMs
    = config.confirmationPollIntervalMs ?? DEFAULT_CONFIRMATION_POLL_INTERVAL_MS
  const confirmationTimeoutMs
    = config.confirmationTimeoutMs ?? DEFAULT_CONFIRMATION_TIMEOUT_MS

  if (!Number.isSafeInteger(confirmationPollIntervalMs) || confirmationPollIntervalMs <= 0)
    throw new Error('confirmationPollIntervalMs must be a positive safe integer')
  if (!Number.isSafeInteger(confirmationTimeoutMs) || confirmationTimeoutMs <= 0)
    throw new Error('confirmationTimeoutMs must be a positive safe integer')

  const isBlockhashValid = async (blockhash: string): Promise<boolean> => {
    const response = await rpc
      .isBlockhashValid(parseBlockhash(blockhash), { commitment: 'confirmed' })
      .send()
    return response.value
  }

  return Object.freeze({
    isBlockhashValid,
    async sendTransaction(signedWireTransaction: Uint8Array): Promise<string> {
      const signedTransaction = getTransactionDecoder().decode(signedWireTransaction)
      const base64Transaction = getBase64EncodedWireTransaction(signedTransaction)
      return await rpc
        .sendTransaction(base64Transaction, {
          encoding: 'base64',
          maxRetries: 3n,
          preflightCommitment: 'confirmed',
          skipPreflight: false,
        })
        .send()
    },
    async confirmTransaction({
      blockhash,
      signal,
      signature,
    }: ConfirmTransactionInput): Promise<void> {
      const startedAt = Date.now()
      const transactionSignature = parseSignature(signature)
      while (Date.now() - startedAt < confirmationTimeoutMs) {
        if (signal.aborted)
          throw new Error('Transaction confirmation was cancelled')
        const response = await rpc
          .getSignatureStatuses([transactionSignature], { searchTransactionHistory: true })
          .send()
        const status = response.value[0]
        if (status?.err) {
          throw new Error(
            `Transaction failed: ${stringifyTransactionError(status.err)}`,
          )
        }
        if (
          status?.confirmationStatus === 'confirmed'
          || status?.confirmationStatus === 'finalized'
        ) {
          return
        }
        if (!status && !(await isBlockhashValid(blockhash)))
          throw new Error('Transaction blockhash expired before confirmation')
        await waitForNextPoll(confirmationPollIntervalMs, signal)
      }
      throw new Error(`Transaction was not confirmed within ${confirmationTimeoutMs}ms`)
    },
  })
}
