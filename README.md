# @neutral-trade/sdk

TypeScript SDK for [Neutral Trade](https://neutral.trade) vaults on Solana — the vault registry plus a [Codama](https://github.com/codama-idl/codama)-generated client for the ntbundle program, built on [`@solana/kit`](https://github.com/anza-xyz/kit).

📚 **API reference:** https://sdk.neutral.trade

## Installation

```sh
npm install @neutral-trade/sdk @solana/kit
```

`@solana/kit` v6 is a peer dependency. Node 20+ is required.

> Migrating from 0.x? The 1.x line is a full rewrite on `@solana/kit` — `PublicKey` → `Address`, `BN` → `bigint`, instruction builders return plain `Instruction` objects, and the `NeutralTrade` class is gone. The 0.x (anchor/web3.js v1) line lives on the `legacy-v0` branch.

## Usage

```ts
import { createSolanaRpc } from "@solana/kit";
import { fetchBundle, getVaultById, vaults } from "@neutral-trade/sdk";

const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");
const vault = getVaultById(1); // vault registry, bundled
const bundle = await fetchBundle(rpc, vault.address);
```

Build deposit instructions (extensions layer):

```ts
import { buildDepositInstructions } from "@neutral-trade/sdk";

const instructions = await buildDepositInstructions(rpc, {
  user, // TransactionSigner
  bundleAccount: bundleAddress,
  amountRaw: 1_000_000n,
});
// Assemble and send with your own transaction pipeline.
```

Low-level generated bindings are also available from the `./generated` subpath.

## Repo layout & contributing

- `src/registry/**`, `src/constants/**`, `src/types/**` — the vault registry. **PRs welcome** (new vault listings land here).
- `src/generated/**`, `src/extensions/**`, `test/client/**` — **bot-owned**: replaced wholesale by automated client drops from the (private) program monorepo, verified by `client-drop.manifest` + CI. Don't edit by hand — changes there belong upstream.

## License

[MIT](./LICENSE.md)
