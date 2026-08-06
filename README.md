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

Build an attributed first deposit:

```ts
import { buildAttributedDepositTx } from "@neutral-trade/sdk";

const instructions = await buildAttributedDepositTx(rpc, {
  user, // TransactionSigner
  vault: bundleAddress,
  amountRaw: 1_000_000n,
  referrer: referrerAddress,
});
// Send every returned instruction in one transaction, without reordering.
```

The builder also accepts `{ code, resolver }` instead of `referrer`. Code resolution is offchain; the resolver must return the referrer's address before the transaction is built. Preflight verifies that referrals are enabled and that the referrer account is registered, active, funded to the referrer minimum, and configured with a nonzero effective referral rate.

Attribution is one-shot. The program accepts `setUserReferrer` only while the user's bundle account has no prior deposit or withdrawal activity, so the builder places it before `requestDeposit` and rejects an account that is no longer virgin. A fresh account in a permissioned vault must be initialized through the program's permissioned flow before using this builder. Referral rates are snapshotted into the user's account at bind time. A later `setReferrerRateOverride` affects only users bound afterward.

Build referrer registration:

```ts
import { buildBuilderRegistrationTx } from "@neutral-trade/sdk";

const plan = await buildBuilderRegistrationTx(rpc, {
  referrer, // TransactionSigner
  vault: bundleAddress,
  depositAmountRaw: 1_000_000n, // optional
});

if (plan.kind === "atomic") {
  // Send plan.instructions in one transaction.
} else {
  // Send plan.depositInstructions when nonempty, wait for keeper processing,
  // then send plan.registrationInstructions in a second transaction.
}
```

A new referrer in a vault with `referrerMinDepositAmount === 0n` uses the atomic path. A referrer whose confirmed `netDeposits` are below the configured minimum needs keeper processing before registration because `requestDeposit` does not update that field. The SDK counts an existing `pendingDeposit` toward the projected net balance and computes the smallest additional gross deposit that covers any remaining deficit after the effective deposit fee. When the existing pending deposit is sufficient, `depositInstructions` is empty and `grossDepositAmountRaw` is zero. Every requested deposit is raised to the vault's regular minimum when necessary, including deposits in an atomic plan. Fresh referrers in permissioned vaults must initialize their depositor account through the permissioned flow first. Setting the referral minimum to zero is the appropriate policy for capital-light distributors.

Low-level generated bindings are also available from the `./generated` subpath.

## Repo layout & contributing

- `src/registry/**`, `src/constants/**`, `src/types/**` — the vault registry. **PRs welcome** (new vault listings land here).
- `src/custom/**` - hand-written transaction composition that remains stable across generated client drops.
- `src/generated/**`, `src/extensions/**`, `test/client/**` — **bot-owned**: replaced wholesale by automated client drops from the (private) program monorepo, verified by `client-drop.manifest` + CI. Don't edit by hand — changes there belong upstream.

## License

[MIT](./LICENSE.md)
