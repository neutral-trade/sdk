/* eslint-disable no-console */
import process from 'node:process'
import { NeutralTrade, VaultId } from '../src/index'
import 'dotenv/config'
/**
 * Example: Get user balance for one or more vaults
 *
 * This example demonstrates how to:
 * 1. Initialize the NeutralTrade SDK
 * 2. Get user balance for specific vaults
 * 3. Display the balance information
 */

async function main(): Promise<void> {
  // Initialize the SDK with your RPC URL
  // You can use any Solana RPC endpoint (e.g., Helius, QuickNode, public RPC)
  const rpcUrl = 'YOUR_RPC_URL_HERE'
  console.log(rpcUrl)
  console.log('Initializing NeutralTrade SDK...')
  const sdk = await NeutralTrade.create({ rpcUrl })
  console.log('SDK initialized successfully!\n')

  // Replace with your user's Solana wallet address
  const userAddress = 'YOUR_WALLET_ADDRESS_HERE'

  // Example 1: Get balance for a single Drift vault
  console.log('Example 1: Getting balance for a single Drift vault (SOLNL)...')
  const singleVaultBalance = await sdk.getUserBalanceByVaultIds({
    vaultIds: [VaultId.solnl],
    userAddress,
  })

  console.log('Single Vault Balance:', JSON.stringify(singleVaultBalance, null, 2))
  console.log()

  // Example 2: Get balance for a single Bundle vault
  console.log('Example 2: Getting balance for a single Bundle vault (HLFUNDINGARB)...')
  const bundleVaultBalance = await sdk.getUserBalanceByVaultIds({
    vaultIds: [VaultId.hlfundingarb],
    userAddress,
  })

  console.log('Bundle Vault Balance:', JSON.stringify(bundleVaultBalance, null, 2))
  console.log()

  // Example 3: Get balance for multiple vaults (both Drift and Bundle)
  console.log('Example 3: Getting balance for multiple vaults...')
  const multipleVaultsBalance = await sdk.getUserBalanceByVaultIds({
    vaultIds: [
      ...Object.values(VaultId) as VaultId[],
    ],
    userAddress,
  })

  console.log('Multiple Vaults Balance:')
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

// Run the example
main().catch((error) => {
  console.error('Error:', error)

  process.exit(1)
})
