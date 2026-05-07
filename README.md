# @neutral-trade/sdk

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

TypeScript SDK for [Neutral Trade](https://neutral.trade) **Bundle** vaults (on-chain reads, balances, registry).

📚 **[Documentation](https://sdk.neutral.trade/)**

## Drift vault balances (legacy)

This package **does not** depend on `@drift-labs/*`. The public registry may still list historical Drift vault metadata, but **`NeutralTrade.getUserBalanceByVaultIds` only returns Bundle vaults**. Drift depositor balances are outside this package’s scope.

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

Runtime dependencies are declared normally (Anchor, Solana web3, etc.); consumers should not need extra setup for Bundle flows.

## Quick Start

```typescript
import { NeutralTrade, VaultId } from '@neutral-trade/sdk'

// Initialize the SDK
const sdk = await NeutralTrade.create({
  rpcUrl: 'YOUR_RPC_URL_HERE'
})

// Get user balance for Bundle vaults only
const balances = await sdk.getUserBalanceByVaultIds({
  vaultIds: [VaultId.hyperliquid_funding_arb_48, VaultId.alp_delta_neutral_49],
  userAddress: 'YOUR_WALLET_ADDRESS'
})

console.log(balances)
```

## Vault registry

Built-in configs include multiple vault **types** in metadata (`VaultType` may still include `Drift` for historical entries). **Balance queries** in this package apply only to **`VaultType.Bundle`** rows.

```typescript
import { VaultId } from '@neutral-trade/sdk'

// Examples — Bundle vaults (balances supported here)
VaultId.hyperliquid_funding_arb_48 // Hyperliquid Funding Arb
VaultId.alp_delta_neutral_49 // ALP Delta Neutral
```

See the [documentation](https://sdk.neutral.trade) for the complete list of vault IDs.

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
