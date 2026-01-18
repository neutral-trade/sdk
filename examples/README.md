# Examples

This folder contains example code demonstrating how to use the NeutralTrade SDK.

## Get User Balance

The `get-user-balance.ts` example shows how to retrieve user balances for vaults.

### Prerequisites

1. Node.js and pnpm installed
2. A Solana RPC endpoint (you can use a public one or get one from providers like Helius, QuickNode, etc.)
3. A Solana wallet address to query

### Running the Example

1. Set environment variables (optional):
   ```bash
   export RPC_URL="https://api.mainnet-beta.solana.com"
   export USER_ADDRESS="YOUR_WALLET_ADDRESS_HERE"
   ```

2. Run the example using tsx:
   ```bash
   pnpm tsx examples/get-user-balance.ts
   ```

   Or if you prefer to use node directly after building:
   ```bash
   pnpm build
   node dist/examples/get-user-balance.js
   ```

### What the Example Shows

The example demonstrates three scenarios:

1. **Single Drift Vault**: Get balance for one Drift vault (SOLNL)
2. **Single Bundle Vault**: Get balance for one Bundle vault (HLFUNDINGARB)
3. **Multiple Vaults**: Get balance for multiple vaults of different types simultaneously

### Understanding the Balance Data

The `VaultBalanceData` object returned contains:

- `balanceToken`: Current balance in the vault's deposit token
- `balanceUsd`: Current balance in USD
- `netEarnings`: Net earnings in the deposit token
- `netEarningsUsd`: Net earnings in USD
- `totalDeposit`: Total amount deposited (including pending)
- `totalDepositUsd`: Total amount deposited in USD
- `spotPrice`: Current spot price of the deposit token
- `vaultShares`: Number of shares owned in the vault (if applicable)
- `netDeposit`: Net deposits (deposits - withdrawals)
- `asset`: The token symbol (e.g., USDC, SOL, BTC)

Additional fields may be present depending on the vault type:
- `pendingDeposit`: Pending deposit amount (Bundle vaults)
- `requestWithdrawToken`: Requested withdrawal amount (Drift vaults)
- `highWaterMark`: High water mark for profit share calculations
- `profitShareFeePaid`: Total profit share fees paid
- `pendingProfitShareFee`: Pending profit share fee (Drift vaults)

### Available Vault IDs

You can use any `VaultId` from the SDK. Some examples:

**Drift Vaults:**
- `VaultId.solnl` - SOL Neutral Long
- `VaultId.btcnl` - BTC Neutral Long
- `VaultId.rekt` - REKT vault
- `VaultId.jlpdnv1` - JLP DN V1
- And many more...

**Bundle Vaults:**
- `VaultId.hlfundingarb` - HL Funding Arbitrage
- `VaultId.alpdn` - ALP DN
- `VaultId.termmax` - Term Max
- And more...

See the `VaultId` enum in the SDK for the complete list.
