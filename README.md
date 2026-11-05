# @neutral-trade/sdk

TypeScript SDK for [Neutral Trade](https://neutral.trade) vaults on Solana — the vault registry plus a [Codama](https://github.com/codama-idl/codama)-generated client for the ntbundle program, built on [`@solana/kit`](https://github.com/anza-xyz/kit).

📚 **API reference:** https://sdk.neutral.trade

## Installation

```sh
npm install @neutral-trade/sdk @solana/kit
```

`@solana/kit` v6 is a peer dependency. Node 20+ is required.

> Migrating from 0.x? The 1.x line is a full rewrite on `@solana/kit` — `PublicKey` → `Address`, `BN` → `bigint`, instruction builders return plain `Instruction` objects, and the `NeutralTrade` class is gone. The 0.x (anchor/web3.js v1) line lives on the `legacy-v0` branch.

### Devnet prereleases

The `devnet` dist-tag carries program changes that are on devnet but not yet released. Versions look like `2.4.0-devnet.20261029091005-eb0dd02` (UTC build time, then the program monorepo commit). They never match a normal `^2.x` range, so pin one exactly:

```sh
npm install --save-exact @neutral-trade/sdk@devnet
```

The generated default program address is still the mainnet program. On devnet, pass `programAddress: address(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET)` (or a devnet registry entry's `bundleProgramId`) to every builder, fetcher, and PDA helper.

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
- `src/generated/**`, `src/extensions/**`, `test/client/**` — **bot-owned**: replaced wholesale by automated client drops from the (private) program monorepo, verified by `client-drop.manifest` + CI. Don't edit by hand — changes there belong upstream. The `client-drop-devnet` branch is the same drop from the monorepo's devnet branch; each push publishes a devnet prerelease, and it is never merged.
- `packages/widget-sdk/**` - embeddable host SDK with Wallet Standard signing, strict transaction verification, vanilla mounting, and a React entry point.
- `examples/widget-vanilla/**`, `examples/widget-react/**` - devnet widget integrations using Wallet Standard discovery.

Changes to `main` require a pull request with successful lint, tests on all three CI operating systems, and the bot-owned client paths guard. This requirement also applies to repository admins.

## License

[MIT](./LICENSE.md)
