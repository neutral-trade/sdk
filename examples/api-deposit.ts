/* eslint-disable no-console */
/**
 * Call the app HTTP API for Bundle deposit instructions, deserialize, sign, and send (v0 tx).
 *
 * Prereqs:
 * - Next app running with the same vault registry / RPC as your chain (e.g. `pnpm dev` in `app/`).
 * - `SOLANA_RPC_URL` points at the same cluster the API uses for building ix (typically devnet).
 * - Wallet funded (SOL + deposit token + user ATA as required by the program).
 *
 * Env:
 * - `NT_APP_BASE_URL` — e.g. `http://localhost:3000` (no trailing slash required).
 * - `BUNDLE_VAULT_ID` — numeric vault id the API supports (default: built-in dev1).
 * - `SOLANA_RPC_URL` — default `http://127.0.0.1:8899`.
 * - `SOLANA_KEYPAIR_PATH` or `SOLANA_WALLET_SECRET_KEY`.
 * - `DEPOSIT_AMOUNT_UI` — optional UI token amount (e.g. `1` USDC), default `0.01`.
 * - `NT_API_KEY` — v1 API key (`x-api-key`); required when the app enforces `app/proxy.ts` auth.
 *
 * Run from repo `sdk/` root:
 *   pnpm example:api:deposit
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
  fetchDepositInstructionsFromApi,
} from './lib/bundle-instruction-api'
import { loadSignerKeypair } from './lib/load-keypair'
import { sendV0Transaction } from './lib/send-versioned-tx'
import 'dotenv/config'

async function main(): Promise<void> {
  const baseUrl = process.env.NT_APP_BASE_URL ?? 'http://localhost:3000'
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'http://127.0.0.1:8899'
  const vaultId = Number(process.env.BUNDLE_VAULT_ID ?? DevnetVaultId.dev1_100000001)
  const amountUi = Number(process.env.DEPOSIT_AMOUNT_UI ?? '0.01')

  if (!Number.isFinite(amountUi) || amountUi <= 0)
    throw new Error('DEPOSIT_AMOUNT_UI must be a positive number')
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
  console.log('Deposit amountRaw:', amountRaw, `(UI ~${amountUi} USDC)`)

  const data = await fetchDepositInstructionsFromApi(
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
