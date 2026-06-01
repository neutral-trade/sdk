# Changelog

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
