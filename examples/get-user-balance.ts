/* eslint-disable no-console */
import process from 'node:process'
import { NeutralTrade, VaultId, vaults, VaultType } from '../src/index'
import 'dotenv/config'
/**
 * Example: Get user balance for one or more Bundle vaults
 *
 * This example demonstrates how to:
 * 1. Initialize the NeutralTrade SDK
 * 2. Get user balance for specific Bundle vaults
 * 3. Display the balance information
 *
 * Note: Drift vault balances are not available from @neutral-trade/sdk.
 */

async function main(): Promise<void> {
  const rpcUrl = 'YOUR_RPC_URL_HERE'
  console.log(rpcUrl)
  console.log('Initializing NeutralTrade SDK...')
  const sdk = await NeutralTrade.create({ rpcUrl })
  console.log('SDK initialized successfully!\n')

  const userAddress = 'YOUR_WALLET_ADDRESS_HERE'

  console.log('Example 1: Single Bundle vault (Hyperliquid Funding Arb)...')
  const singleVaultBalance = await sdk.getUserBalanceByVaultIds({
    vaultIds: [VaultId.hyperliquid_funding_arb_48],
    userAddress,
  })
  console.log('Single Vault Balance:', JSON.stringify(singleVaultBalance, null, 2))
  console.log()

  console.log('Example 2: Another Bundle vault (ALP Delta Neutral)...')
  const bundleVaultBalance = await sdk.getUserBalanceByVaultIds({
    vaultIds: [VaultId.alp_delta_neutral_49],
    userAddress,
  })
  console.log('Bundle Vault Balance:', JSON.stringify(bundleVaultBalance, null, 2))
  console.log()

  console.log('Example 3: All Bundle vault IDs from registry...')
  const bundleVaultIds = Object.values(vaults)
    .filter(v => v.type === VaultType.Bundle)
    .map(v => v.vaultId)

  const multipleVaultsBalance = await sdk.getUserBalanceByVaultIds({
    vaultIds: bundleVaultIds,
    userAddress,
  })

  console.log('Bundle vault balances:')
  for (const [vaultId, balance] of Object.entries(multipleVaultsBalance)) {
    if (balance) {
      console.log(`\n${vaultId}:`)
      console.log(`  Balance: ${balance.balanceToken.toFixed(6)} ${balance.asset}`)
      console.log(`  Balance USD: $${balance.balanceUsd.toFixed(2)}`)
      console.log(`  Net Earnings: ${balance.netEarnings.toFixed(6)} ${balance.asset}`)
      console.log(`  Net Earnings USD: $${balance.netEarningsUsd.toFixed(2)}`)
      console.log(`  Total Deposit: ${balance.totalDeposit.toFixed(6)} ${balance.asset}`)
      console.log(`  Spot Price: $${balance.spotPrice.toFixed(2)}`)
      if (balance.vaultShares !== undefined) {
        console.log(`  Vault Shares: ${balance.vaultShares.toFixed(6)}`)
      }
    }
    else {
      console.log(`\n${vaultId}: No balance found (user may not have deposited)`)
    }
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
