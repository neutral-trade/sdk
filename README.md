# @neutral-trade/sdk

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

TypeScript SDK for [Neutral Trade](https://neutral.trade) vaults.

📚 **[Documentation](https://sdk.neutral.trade/)**

## Installation

```bash
# npm
npm install @neutral-trade/sdk

# yarn
yarn add @neutral-trade/sdk

# pnpm
pnpm add @neutral-trade/sdk

# bun
bun add @neutral-trade/sdk
```

All dependencies are bundled with the SDK, so no additional peer dependencies are required.

## Quick Start

```typescript
import { NeutralTrade, VaultId } from '@neutral-trade/sdk'

// Initialize the SDK
const sdk = await NeutralTrade.create({
  rpcUrl: 'YOUR_RPC_URL_HERE'
})

// Get user balance for specific vaults
const balances = await sdk.getUserBalanceByVaultIds({
  vaultIds: [VaultId.solnl, VaultId.btcnl],
  userAddress: 'YOUR_WALLET_ADDRESS'
})

console.log(balances)
```

## Available Vaults

The SDK supports both **Drift** and **Bundle** vault types. Use the `VaultId` enum to reference vaults:

```typescript
import { VaultId } from '@neutral-trade/sdk'

// Drift Vaults
VaultId.solnl // SOL Neutral Long
VaultId.btcnl // BTC Neutral Long
VaultId.jlpdnv1 // JLP DN V1

// Bundle Vaults
VaultId.hlfundingarb // HL Funding Arbitrage
VaultId.alpdn // ALP DN
```

See the [documentation](https://sdk.neutral.trade) for the complete list of available vaults.

## Examples

Check out the [examples](./examples) directory for more usage examples.

## License

[MIT](./LICENSE)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@neutral-trade/sdk?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/@neutral-trade/sdk
[npm-downloads-src]: https://img.shields.io/npm/dm/@neutral-trade/sdk?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/@neutral-trade/sdk
[license-src]: https://img.shields.io/github/license/neutral-trade/sdk.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/neutral-trade/sdk/blob/main/LICENSE
