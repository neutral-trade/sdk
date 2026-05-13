/**
 * Wire format matches `app/app/api/v1/_lib/serialize-solana-instruction.ts`.
 */
import { Buffer } from 'node:buffer'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'

export interface SerializedSolanaInstruction {
  programId: string
  accounts: {
    pubkey: string
    isSigner: boolean
    isWritable: boolean
  }[]
  dataBase64: string
}

export function deserializeInstruction(s: SerializedSolanaInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(s.programId),
    keys: s.accounts.map(a => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    })),
    data: Buffer.from(s.dataBase64, 'base64'),
  })
}

function stripTrailingSlash(base: string): string {
  return base.replace(/\/+$/, '')
}

export interface BundleIxApiData {
  vaultId: number
  chain: string
  depositToken: string
  instructions: SerializedSolanaInstruction[]
  note?: string
}

interface BundleIxApiOk {
  success: true
  data: BundleIxApiData
}

/** Parsed JSON shape before narrowing (route returns 4xx with `success: false`). */
interface BundleIxApiJson {
  success?: boolean
  data?: BundleIxApiData
  error?: string
  message?: string
}

function assertOk(json: unknown, res: Response): asserts json is BundleIxApiOk {
  if (typeof json !== 'object' || json === null) {
    throw new Error(`Invalid JSON from ${res.url} (status ${res.status})`)
  }
  const o = json as BundleIxApiJson
  if (o.success !== true || o.data == null) {
    throw new Error(
      `Bundle ix API error (${res.status}): ${o.message ?? o.error ?? JSON.stringify(json)}`,
    )
  }
}

export interface BundleIxRequestBody {
  userAddress: string
  amountRaw: string
}

function v1JsonHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }
}

/**
 * POST `/api/v1/vault/:vaultId/deposit-instructions` — same body as the Next.js route.
 * `apiKey` is required by `app/proxy.ts` for all `/api/v1/*` routes (except `/api/v1/docs`).
 */
export async function fetchDepositInstructionsFromApi(
  baseUrl: string,
  vaultId: number,
  body: BundleIxRequestBody,
  apiKey: string,
): Promise<BundleIxApiData> {
  const url = `${stripTrailingSlash(baseUrl)}/api/v1/vault/${vaultId}/deposit-instructions`
  const res = await fetch(url, {
    method: 'POST',
    headers: v1JsonHeaders(apiKey),
    body: JSON.stringify(body),
  })
  const json: unknown = await res.json()
  assertOk(json, res)
  return json.data
}

/**
 * POST `/api/v1/vault/:vaultId/withdraw-instructions` — same body as the Next.js route.
 * `apiKey` is required by `app/proxy.ts` for all `/api/v1/*` routes (except `/api/v1/docs`).
 */
export async function fetchWithdrawInstructionsFromApi(
  baseUrl: string,
  vaultId: number,
  body: BundleIxRequestBody,
  apiKey: string,
): Promise<BundleIxApiData> {
  const url = `${stripTrailingSlash(baseUrl)}/api/v1/vault/${vaultId}/withdraw-instructions`
  const res = await fetch(url, {
    method: 'POST',
    headers: v1JsonHeaders(apiKey),
    body: JSON.stringify(body),
  })
  const json: unknown = await res.json()
  assertOk(json, res)
  return json.data
}
