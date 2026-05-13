/* eslint-disable no-console */
/**
 * Devnet / local validator: sign and send Bundle `requestWithdrawal` (single ix; settlement is separate on-chain flow).
 *
 * Prereqs:
 * - User already has a `userBundleAccount` with shares / balance for the vault.
 * - RPC and registry same as deposit example.
 *
 * Env:
 * - `SOLANA_RPC_URL` — default `http://127.0.0.1:8899`.
 * - `SOLANA_KEYPAIR_PATH` or `SOLANA_WALLET_SECRET_KEY`.
 * - `DEVNET_BUNDLE_VAULT_ID` — optional, default `100000001`.
 * - `WITHDRAW_AMOUNT_UI` — optional UI token amount to request (partial or full per SDK math), default `0.01`.
 *
 * Run from repo `sdk/` root:
 *   pnpm example:devnet:withdraw
 */
import process from 'node:process'
import { DevnetVaultId, NeutralTrade } from '../src/index'
import { loadSignerKeypair } from './lib/load-keypair'
import { sendV0Transaction } from './lib/send-versioned-tx'
import 'dotenv/config'

async function main(): Promise<void> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'http://127.0.0.1:8899'
  const vaultId = Number(process.env.DEVNET_BUNDLE_VAULT_ID ?? DevnetVaultId.dev1_100000001)
  const amountUi = Number(process.env.WITHDRAW_AMOUNT_UI ?? '0.01')

  if (!Number.isFinite(amountUi) || amountUi <= 0) {
    throw new Error('WITHDRAW_AMOUNT_UI must be a positive number')
  }

  const payer = loadSignerKeypair()
  console.log('RPC:', rpcUrl)
  console.log('Payer:', payer.publicKey.toBase58())
  console.log('Vault ID:', vaultId)
  console.log('Withdraw request (UI amount):', amountUi)

  const nt = await NeutralTrade.create({
    rpcUrl,
    bundleCluster: 'devnet',
  })

  const ix = await nt.buildRequestWithdrawInstruction({
    vaultId,
    userAddress: payer.publicKey.toBase58(),
    amount: amountUi,
  })

  const sig = await sendV0Transaction(nt.connection, payer, [ix])
  console.log('Signature:', sig)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
