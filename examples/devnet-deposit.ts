/* eslint-disable no-console */
/**
 * Devnet / local validator: sign and send Bundle `requestDeposit` (and `initializeBundleDepositor` if needed).
 *
 * Prereqs:
 * - RPC reachable (local: `solana-test-validator`, or public devnet).
 * - Built-in devnet registry vault must exist on-chain at the configured address (see `src/registry/vaults.devnet.json`).
 * - Wallet has SPL USDC (devnet mint) and ATA; fund via devnet faucet / your deploy scripts.
 *
 * Env:
 * - `SOLANA_RPC_URL` — default `http://127.0.0.1:8899` (local validator).
 * - `SOLANA_KEYPAIR_PATH` or `SOLANA_WALLET_SECRET_KEY` — see `examples/lib/load-keypair.ts`.
 * - `DEVNET_BUNDLE_VAULT_ID` — optional, default built-in Dev1 (`100000001`).
 * - `DEPOSIT_AMOUNT_UI` — optional token amount in UI units (e.g. `1` for 1 USDC), default `0.01`.
 *
 * Run from repo `sdk/` root:
 *   pnpm example:devnet:deposit
 */
import process from 'node:process'
import {
  DevnetVaultId,
  getSolanaTokenDecimals,
  humanFloatToAmountRawString,
  NeutralTrade,
  SupportedToken,
} from '../src/index'
import { loadSignerKeypair } from './lib/load-keypair'
import { sendV0Transaction } from './lib/send-versioned-tx'
import 'dotenv/config'

async function main(): Promise<void> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'http://127.0.0.1:8899'
  const vaultId = Number(process.env.DEVNET_BUNDLE_VAULT_ID ?? DevnetVaultId.dev1_100000001)
  const amountUi = Number(process.env.DEPOSIT_AMOUNT_UI ?? '100')

  if (!Number.isFinite(amountUi) || amountUi <= 0) {
    throw new Error('DEPOSIT_AMOUNT_UI must be a positive number')
  }

  const payer = loadSignerKeypair()
  console.log('RPC:', rpcUrl)
  console.log('Payer:', payer.publicKey.toBase58())
  console.log('Vault ID:', vaultId)
  console.log('Deposit (UI amount):', amountUi)

  const nt = await NeutralTrade.create({
    rpcUrl,
    bundleCluster: 'devnet',
  })

  const amountRaw = humanFloatToAmountRawString(
    amountUi,
    getSolanaTokenDecimals(SupportedToken.USDC),
  )

  const instructions = await nt.buildDepositInstructions({
    vaultId,
    userAddress: payer.publicKey.toBase58(),
    amountRaw,
  })

  console.log('Instructions:', instructions.length)
  const sig = await sendV0Transaction(nt.connection, payer, instructions)
  console.log('Signature:', sig)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
