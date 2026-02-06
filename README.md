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
  vaultIds: [VaultId.sol_super_staking_1, VaultId.btc_super_staking_3],
  userAddress: 'YOUR_WALLET_ADDRESS'
})

console.log(balances)
```

## Available Vaults

The SDK supports both **Drift** and **Bundle** vault types. Use the `VaultId` enum to reference vaults:

```typescript
import { VaultId } from '@neutral-trade/sdk'

// Drift Vaults
VaultId.sol_super_staking_1 // SOL Super Staking
VaultId.btc_super_staking_3 // BTC Super Staking
VaultId.jlp_delta_neutral_vault_1_0 // JLP Delta Neutral (vault-1)

// Bundle Vaults
VaultId.hyperliquid_funding_arb_48 // Hyperliquid Funding Arb
VaultId.alp_delta_neutral_49 // ALP Delta Neutral
```

See the [documentation](https://sdk.neutral.trade) for the complete list of available vaults.

## Configuration Registry

The SDK includes built-in vault configurations, but you can also fetch the latest configurations from a remote registry. This is useful if you don't upgrade the SDK package frequently.

### Registry URLs

- **GitHub Raw**: `https://raw.githubusercontent.com/neutral-trade/sdk/main/src/registry/vaults.json`
- **jsDelivr CDN**: `https://cdn.jsdelivr.net/gh/neutral-trade/sdk@main/src/registry/vaults.json`

### Usage

**Use the registry URL if you don't upgrade the SDK frequently:**

```typescript
const sdk = await NeutralTrade.create({
  rpcUrl: 'YOUR_RPC_URL_HERE',
  registryUrl: 'https://cdn.jsdelivr.net/gh/neutral-trade/sdk@main/src/registry/vaults.json'
})
```

This ensures you always have the latest vault configurations without needing to update the SDK package.

**Use built-in configs if you upgrade the SDK regularly:**

```typescript
const sdk = await NeutralTrade.create({
  rpcUrl: 'YOUR_RPC_URL_HERE'
  // No registryUrl - uses built-in configurations
})
```

This is simpler and doesn't require an additional network request at initialization.

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
