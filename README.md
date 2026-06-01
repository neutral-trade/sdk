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

// Initialize the SDK (uses built-in vault registry for your cluster)
const sdk = await NeutralTrade.create({
  rpcUrl: 'YOUR_RPC_URL_HERE',
})

// Get user balance for Bundle vaults only
const balances = await sdk.getUserBalanceByVaultIds({
  vaultIds: [VaultId.hyperliquid_funding_arb_48, VaultId.alp_delta_neutral_49],
  userAddress: 'YOUR_WALLET_ADDRESS',
})

console.log(balances)
```

## Vault registry

Vault configurations are **bundled with the SDK** at build time (`src/registry/vaults.json` for mainnet, `vaults.devnet.json` for devnet). The SDK does **not** fetch or accept external registry overrides.

### Getting the latest vault list

**Upgrade the SDK package** whenever Neutral Trade ships new vaults:

```bash
pnpm add @neutral-trade/sdk@latest
# or pin a specific version, e.g. @neutral-trade/sdk@0.4.0
```

Each release includes an updated built-in registry. There is no runtime registry URL.

### Integrators who cannot upgrade frequently

- Use the **[Neutral Trade API](https://www.neutral.trade/api/v1)** to build unsigned deposit/withdraw instructions server-side, or
- **Contact us on [Telegram](https://t.me/neutraltrade)** for API access and integration support.

Built-in configs include multiple vault **types** in metadata (`VaultType` may still include `Drift` for historical entries). **Balance queries** in this package apply only to **`VaultType.Bundle`** rows.

```typescript
import { VaultId } from '@neutral-trade/sdk'

// Examples — Bundle vaults (balances supported here)
VaultId.hyperliquid_funding_arb_48 // Hyperliquid Funding Arb
VaultId.alp_delta_neutral_49 // ALP Delta Neutral
```

See the [documentation](https://sdk.neutral.trade) for the complete list of vault IDs.

### Cluster selection

Use `bundleCluster` to select the built-in registry and default Bundle program ID (`mainnet` or `devnet`):

```typescript
const sdk = await NeutralTrade.create({
  rpcUrl: 'YOUR_RPC_URL_HERE',
  bundleCluster: 'devnet',
})
```

If a vault entry includes `bundleProgramId`, that vault-specific program ID is used instead of the cluster default. Only official Neutral Trade program IDs are accepted for fund-moving instructions.

## Examples

See the [examples](./examples) directory. From the `sdk/` package root (clone this repo):

```bash
# Local validator default RPC: http://127.0.0.1:8899 — override with SOLANA_RPC_URL
export SOLANA_KEYPAIR_PATH="$HOME/.config/solana/id.json"
pnpm example:devnet:deposit
pnpm example:devnet:withdraw
```

Uses the built-in devnet registry (`src/registry/vaults.devnet.json`, e.g. vault `100000001`). Your RPC must serve that vault on-chain; override vault id with `DEVNET_BUNDLE_VAULT_ID`.

## License

[MIT](./LICENSE)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@neutral-trade/sdk?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/@neutral-trade/sdk
[npm-downloads-src]: https://img.shields.io/npm/dm/@neutral-trade/sdk?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/@neutral-trade/sdk
[license-src]: https://img.shields.io/github/license/neutral-trade/sdk.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/neutral-trade/sdk/blob/main/LICENSE
