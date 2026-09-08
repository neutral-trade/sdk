# Changelog

## Unreleased

- Registry: add devnet vault `100000010` `Meridian Liquidity Provider(NT)`, the Accountable staging vault on Monad Testnet.
- Add `SupportedChain.MonadTestnet` (`MONAD_TESTNET_CHAIN_ID = 10143`, gas believed to be MON -- unconfirmed) and `SupportedToken.AUSD` (`Accountable USD`, `0x333a12e2B519DA16EBE75012d54574C16ef4463f`, **6 decimals** -- the Accountable integration guide's "everything is 18-decimal" does not hold on staging, so always read decimals from the token table).
- Add `chain` to registry entries: optional in the JSON, always resolved on `VaultConfig` (omitted means `SupportedChain.Solana`), so consumers never branch on it being absent.
- `getVaultByAddress` / `isValidVaultAddress` now match EVM addresses case-insensitively. Base58 Solana addresses stay case-sensitive.
- `vaultAddress` validation now rejects a malformed `0x`-prefixed address instead of accepting it on base58 length rules alone.

### Breaking changes

- **Vault 81 is no longer the `Ethereal-USDE-Bundle` Solana bundle.** It is now the Accountable `Meridian Liquidity Provider` NAV vault on Robinhood Chain: `type` `Bundle` -> `AccountableNav`, `category` `Market Neutral` -> `Private Credit`, and `vaultAddress` moves from the base58 bundle address to the ERC-4626 contract `0x24b84023c8e4Da635be228C380C09bfE5271BF9d`. Anything treating 81 as a Solana bundle breaks.
- `VaultId.ethereal_usde_bundle_81` is renamed to `VaultId.meridian_liquidity_provider_81` (the enum is generated from the registry name).
- Entry 81 now carries all three Accountable identities -- `vaultAddress` (ERC-4626 transaction target), `strategyAddress` (loan contract, `0xF62c201e9A28F6A57C4262004dd2e8B8e95bB1eC`), `accountableLoanId` (`607290214`, Accountable API only). Consumers hard-coding the loan id should drop their copy.

- Add Accountable NAV vault taxonomy: `VaultType.AccountableNav`, `SupportedChain.Robinhood` (`ROBINHOOD_CHAIN_ID = 4663`, gas in ETH), USDe metadata on Robinhood Chain (`0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34`, 18 decimals), and optional registry fields `accountableLoanId` (Accountable API id) and `strategyAddress` (strategy/loan contract). `vaultAddress` stays the ERC-4626 transaction target; Bundle/Drift helpers ignore Accountable entries.

- Add protocol v2 raw `builderAddress` attribution to `@neutral-trade/widget-sdk` while preserving protocol v1 for existing `builderCode` embeds.
- Add `@neutral-trade/widget-sdk` with inline and floating embeds, a shared versioned postMessage protocol, Wallet Standard signing, strict wire-byte transaction verification, lifecycle tracking, and devnet examples for vanilla JavaScript and React.

## 1.0.0

Full rewrite. `@neutral-trade/sdk` is now the vault registry plus the Codama-generated client for the ntbundle program, built on `@solana/kit` v6. The client (`src/generated`, `src/extensions`, `test/client`) is vendored from the program monorepo via automated client drops.

Breaking changes from 0.x:

- anchor + web3.js v1 stack removed: `Address` instead of `PublicKey`, native `bigint` instead of `BN`, plain `Instruction` objects instead of `TransactionInstruction`; callers assemble and send their own transactions.
- `NeutralTrade` facade, `createBundleProgramById`, `BundleProgram`/`BundleProvider`, price fetching, and the `./internal` entry point are gone. Use the generated fetchers plus the extension helpers (`buildDepositInstructions`, `fetchUserBundleBalance`, `resolveEffectiveFees`, …).
- Vault registry, `VaultId` enums, and token tables are unchanged and stay in this package.

The 0.x line continues on the `legacy-v0` branch.

## 0.4.0

- Removed `registry`, `registryUrl`, and `includeBuiltInVaults` from `NeutralTrade.create`. Vault configuration now comes **only** from the built-in, compile-time registry shipped with the SDK package.
- `buildBundleDepositInstructions` and `buildBundleRequestWithdrawInstruction` now accept **`vaultId` only** (plus `connection`, `user`, `amountRaw`). Callers can no longer inject arbitrary `vaultAddress` or `bundleProgramId`.
- Bundle program clients used for fund-moving instructions are restricted to an **allowlist** of official Neutral Trade program IDs per cluster.

### Breaking changes

- Removed `NeutralTradeConfig.registry`, `NeutralTradeConfig.registryUrl`, and `NeutralTradeConfig.includeBuiltInVaults`.
- `BuildBundleDepositInstructionsParams` and `BuildBundleRequestWithdrawInstructionParams` no longer accept `vault` or `bundleProgram`. Pass `vaultId` and `connection` instead.
- Admin / trusted internal callers that need arbitrary vault PDAs should import from `@neutral-trade/sdk/internal`.

### Migration

**Before:**

```typescript
const sdk = await NeutralTrade.create({
  rpcUrl,
  registryUrl: 'https://cdn.jsdelivr.net/gh/neutral-trade/sdk@main/src/registry/vaults.json',
})
```

**After:**

```typescript
// Upgrade @neutral-trade/sdk to get the latest built-in vault list
const sdk = await NeutralTrade.create({ rpcUrl })
```

For programmatic deposit/withdraw instruction building without upgrading the SDK package, use the [Neutral Trade API](https://www.neutral.trade/api/v1) or contact the team on Telegram.
