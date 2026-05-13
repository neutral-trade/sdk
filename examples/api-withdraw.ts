/* eslint-disable no-console */
/**
 * Call the app HTTP API for Bundle `requestWithdrawal` instruction, deserialize, sign, and send (v0 tx).
 *
 * Prereqs:
 * - Next app running; user must already have bundle position / shares for the vault.
 * - Same cluster alignment notes as `api-deposit.ts`.
 *
 * Env:
 * - `NT_APP_BASE_URL` — e.g. `http://localhost:3000`.
 * - `BUNDLE_VAULT_ID` — default built-in dev1.
 * - `SOLANA_RPC_URL` — default `http://127.0.0.1:8899`.
 * - `SOLANA_KEYPAIR_PATH` or `SOLANA_WALLET_SECRET_KEY`.
 * - `WITHDRAW_AMOUNT_UI` — optional UI token amount for the request, default `0.01`.
 * - `NT_API_KEY` — v1 API key (`x-api-key`); required when the app enforces `app/proxy.ts` auth.
 *
 * Run from repo `sdk/` root:
 *   pnpm example:api:withdraw
 */
import process from 'node:process'
import { Connection } from '@solana/web3.js'
import {
  DevnetVaultId,
  getSolanaTokenDecimals,
  humanFloatToAmountRawString,
  SupportedToken,
} from '../src/index'
import {
  deserializeInstruction,
  fetchWithdrawInstructionsFromApi,
} from './lib/bundle-instruction-api'
import { loadSignerKeypair } from './lib/load-keypair'
import { sendV0Transaction } from './lib/send-versioned-tx'
import 'dotenv/config'

async function main(): Promise<void> {
  const baseUrl = process.env.NT_APP_BASE_URL ?? 'http://localhost:3000'
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'http://127.0.0.1:8899'
  const vaultId = Number(process.env.BUNDLE_VAULT_ID ?? DevnetVaultId.dev1_100000001)
  const amountUi = Number(process.env.WITHDRAW_AMOUNT_UI ?? '0.01')

  if (!Number.isFinite(amountUi) || amountUi <= 0)
    throw new Error('WITHDRAW_AMOUNT_UI must be a positive number')
  if (!Number.isFinite(vaultId))
    throw new Error('BUNDLE_VAULT_ID must be a finite number')

  const apiKey = process.env.NT_API_KEY?.trim()
  if (!apiKey)
    throw new Error('Set NT_API_KEY (v1 x-api-key) for /api/v1/vault/... requests')

  const payer = loadSignerKeypair()
  const userAddress = payer.publicKey.toBase58()
  const amountRaw = humanFloatToAmountRawString(
    amountUi,
    getSolanaTokenDecimals(SupportedToken.USDC),
  )

  console.log('API:', baseUrl)
  console.log('RPC (send):', rpcUrl)
  console.log('Vault ID:', vaultId)
  console.log('Payer:', userAddress)
  console.log('Withdraw amountRaw:', amountRaw, `(UI ~${amountUi} USDC)`)

  const data = await fetchWithdrawInstructionsFromApi(
    baseUrl,
    vaultId,
    {
      userAddress,
      amountRaw,
    },
    apiKey,
  )
  const instructions = data.instructions.map(deserializeInstruction)
  console.log('Instructions from API:', instructions.length)
  if (data.note)
    console.log('Note:', data.note)

  const connection = new Connection(rpcUrl, 'confirmed')
  const sig = await sendV0Transaction(connection, payer, instructions)
  console.log('Signature:', sig)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
