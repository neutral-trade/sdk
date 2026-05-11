/**
 * Diagnose which Bundle vaultId breaks `getUserBalanceByVaultIds` (e.g. Anchor/Borsh "Invalid bool").
 *
 * Simulates the app's **Bundle** balance path only (`NeutralTrade` → `getBundleBalances` → `fetchMultiple`).
 * For **Drift + Bundle** like the Next app, run `pnpm diagnose:portfolio-balances` in `@neutral-trade/internal`.
 *
 * Loads optional `sdk/.env` (repo root `sdk/.env`). `diagnose/.env` is gitignored if you keep secrets there.
 *
 * Usage (from `sdk/`):
 *   pnpm diagnose:balances
 *   RPC_URL=https://... USER_WALLET=... pnpm diagnose:balances
 *   pnpm diagnose:balances -- --rpc=https://... --user=...
 *
 * Optional: THROTTLE_MS=250 (delay between per-vault RPC probes to avoid 429).
 * Set LOG_BALANCES=0 to skip printing token/USD lines (default: print).
 */
/* eslint-disable no-console */
import type { VaultBalanceData, VaultRegistryEntry } from '../src/types'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { NeutralTrade, SupportedToken, vaults, VaultType } from '../src/index'

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })

const logBalances = process.env.LOG_BALANCES !== '0'

function fmt(n: number, decimals = 6): string {
  if (!Number.isFinite(n))
    return 'n/a'
  return n.toFixed(decimals)
}

/** Human-readable one line per vault (same fields the app uses for “有幾錢”). */
function logBalanceRow(vaultId: number, name: string, row: VaultBalanceData | null | undefined): void {
  if (!row) {
    console.log(`  [${vaultId}] ${name}: (null — 多數係未開過 depositor 帳戶)`)
    return
  }
  const sym = row.asset ?? '?'
  const td = row.totalDeposit ?? 0
  const bt = row.balanceToken ?? 0
  const tdu = row.totalDepositUsd ?? 0
  const bu = row.balanceUsd ?? 0
  const ne = row.netEarnings ?? 0
  console.log(
    `  [${vaultId}] ${name}: totalDeposit=${fmt(td)} ${sym} | balanceToken=${fmt(bt)} ${sym} | totalDepositUsd≈$${fmt(tdu, 2)} | balanceUsd≈$${fmt(bu, 2)} | netEarnings=${fmt(ne)} ${sym}`,
  )
}

function printBalanceTable(title: string, vaultIds: number[], getRow: (id: number) => VaultBalanceData | null | undefined): void {
  if (!logBalances)
    return
  console.log(title)
  for (const id of vaultIds) {
    const meta = vaults[id]
    logBalanceRow(id, meta?.name ?? '(unknown)', getRow(id))
  }
  const sumDepositUsd = vaultIds.reduce((s, id) => s + (getRow(id)?.totalDepositUsd ?? 0), 0)
  const sumBalanceUsd = vaultIds.reduce((s, id) => s + (getRow(id)?.balanceUsd ?? 0), 0)
  console.log(
    `  ── 加總 (${vaultIds.length} 個 Bundle vault): totalDepositUsd ≈ $${fmt(sumDepositUsd, 2)} | balanceUsd ≈ $${fmt(sumBalanceUsd, 2)}`,
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseArgs(): { rpcUrl: string | undefined, userAddress: string | undefined } {
  const argv = process.argv.slice(2)
  let rpcUrl = process.env.RPC_URL ?? process.env.SOLANA_RPC_URL
  let userAddress = process.env.USER_WALLET ?? process.env.USER_ADDRESS
  for (const a of argv) {
    if (a.startsWith('--rpc='))
      rpcUrl = a.slice('--rpc='.length)
    else if (a.startsWith('--user='))
      userAddress = a.slice('--user='.length)
  }
  return { rpcUrl, userAddress }
}

function bundleVaultIdsSorted(): number[] {
  return Object.values(vaults)
    .filter((v: VaultRegistryEntry) => v.type === VaultType.Bundle)
    .map(v => v.vaultId)
    .sort((a, b) => a - b)
}

async function main(): Promise<void> {
  const { rpcUrl, userAddress } = parseArgs()
  if (!rpcUrl || !userAddress) {
    console.error('Missing RPC_URL (or SOLANA_RPC_URL) and USER_WALLET (or USER_ADDRESS), or pass --rpc= / --user=')
    process.exit(1)
  }

  console.log('NeutralTrade (Bundle only) — diagnosing getUserBalanceByVaultIds\n')
  const sdk = await NeutralTrade.create({
    rpcUrl,
    fallbackPrices: {
      [SupportedToken.USDC]: 1,
      [SupportedToken.USDT]: 1,
    },
  })

  const ids = bundleVaultIdsSorted()
  const throttleMs = Number(process.env.THROTTLE_MS ?? 250)
  console.log(`Bundle vault count: ${ids.length}\n`)

  console.log('--- (1) Single call with ALL bundle vault IDs (like a naive mega-batch) ---')
  try {
    const batchResult = await sdk.getUserBalanceByVaultIds({ vaultIds: ids, userAddress })
    console.log('OK: mega-batch succeeded.\n')
    printBalanceTable('(1b) Mega-batch 每個 vault 餘額（SDK 回傳）:', ids, id => batchResult[id])
    console.log('')
  }
  catch (e) {
    console.error('FAIL: mega-batch threw:', e instanceof Error ? e.message : e)
    console.error('')
  }

  console.log('--- (2) Per-vaultId single fetch (finds exact vaultIds that throw on decode) ---')
  const failures: { vaultId: number, name: string, message: string }[] = []
  const perVaultResult: Record<number, VaultBalanceData | null | undefined> = {}
  for (const vaultId of ids) {
    const meta = vaults[vaultId]
    const name = meta?.name ?? '(unknown)'
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const one = await sdk.getUserBalanceByVaultIds({ vaultIds: [vaultId], userAddress })
          perVaultResult[vaultId] = one[vaultId] ?? null
          break
        }
        catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.includes('429') && attempt < 2) {
            await sleep(800 * (attempt + 1))
            continue
          }
          throw e
        }
      }
      process.stdout.write('.')
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      failures.push({ vaultId, name, message })
      process.stdout.write('x')
    }
    await sleep(throttleMs)
  }
  console.log('\n')

  if (failures.length === 0) {
    console.log('All per-vault single fetches OK.')
    printBalanceTable('\n(2b) 逐個 fetch 每個 vault 餘額（應同 (1b) 一致）:', ids, id => perVaultResult[id])
  }
  else {
    console.log(`Failing vaultIds (${failures.length}):`)
    for (const f of failures) {
      console.log(`  vaultId=${f.vaultId}  name=${f.name}`)
      console.log(`    error: ${f.message}`)
    }
    if (logBalances) {
      console.log('\n(2b) 成功 fetch 到嘅 vault 餘額（失敗嘅會係空白）:')
      for (const id of ids) {
        if (failures.some(f => f.vaultId === id))
          continue
        logBalanceRow(id, vaults[id]?.name ?? '(unknown)', perVaultResult[id])
      }
    }
  }

  console.log('\n--- (3) Optional: first failing chunk of 12 (same size as app hook) ---')
  const chunkSize = 12
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize)
    try {
      await sdk.getUserBalanceByVaultIds({ vaultIds: slice, userAddress })
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.log(`Chunk starting index ${i} vaultIds [${slice.join(', ')}] FAILED: ${message}`)
    }
    await sleep(throttleMs)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
