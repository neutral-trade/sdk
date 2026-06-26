import type { BundleAccount, UserBundleAccount } from '../types/bundle-types'

/** Mirrors `bundle-sc` `FEE_OVERRIDE_*` bit flags. */
export const FEE_OVERRIDE = {
  DEPOSIT: 1 << 0,
  WITHDRAWAL: 1 << 1,
  PERFORMANCE: 1 << 2,
  MANAGEMENT: 1 << 3,
} as const

export interface EffectiveFeeBps {
  depositFeeBps: number
  withdrawalFeeBps: number
  performanceFeeBps: number
  managementFeeBps: number
}

/** Decimal fees matching frontend `VaultConfig` (`0.01` = 1%). */
export interface EffectiveVaultFeeDecimals {
  dfee: number
  wfee: number
  pfee: number
  mfee: number
}

interface BundleFeeBpsSource {
  depositFee?: unknown
  withdrawalFee?: unknown
  performanceFee?: unknown
  managementFeeBps?: unknown
}

const FEE_EPS = 1e-9

export function bpsToFeeDecimal(bps: number): number {
  return bps / 10_000
}

export function feeDecimalToBps(decimal: number): number {
  return Math.round(decimal * 10_000)
}

function toNum(value: unknown): number {
  if (typeof value === 'number')
    return value
  if (typeof value === 'bigint')
    return Number(value)
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(String(value ?? 0))
}

function bundleDefaultFeeBps(bundle: BundleAccount): EffectiveFeeBps {
  const b = bundle as BundleAccount & BundleFeeBpsSource
  return {
    depositFeeBps: toNum(b.depositFee),
    withdrawalFeeBps: toNum(b.withdrawalFee),
    performanceFeeBps: toNum(b.performanceFee),
    managementFeeBps: toNum(b.managementFeeBps),
  }
}

export function vaultFeeDecimalsToBps(fees: EffectiveVaultFeeDecimals): EffectiveFeeBps {
  return {
    depositFeeBps: feeDecimalToBps(fees.dfee),
    withdrawalFeeBps: feeDecimalToBps(fees.wfee),
    performanceFeeBps: feeDecimalToBps(fees.pfee),
    managementFeeBps: feeDecimalToBps(fees.mfee),
  }
}

export function effectiveFeeBpsToDecimals(fees: EffectiveFeeBps): EffectiveVaultFeeDecimals {
  return {
    dfee: bpsToFeeDecimal(fees.depositFeeBps),
    wfee: bpsToFeeDecimal(fees.withdrawalFeeBps),
    pfee: bpsToFeeDecimal(fees.performanceFeeBps),
    mfee: bpsToFeeDecimal(fees.managementFeeBps),
  }
}

/**
 * Apply per-user fee override flags onto default bps (bundle or vault-config defaults).
 */
export function resolveEffectiveFeeBpsFromDefaults(
  defaults: EffectiveFeeBps,
  user: UserBundleAccount,
): EffectiveFeeBps {
  const flags = toNum(user.feeOverrideFlags)
  if (flags === 0)
    return defaults

  return {
    depositFeeBps: (flags & FEE_OVERRIDE.DEPOSIT) !== 0
      ? toNum(user.customDepositFeeBps)
      : defaults.depositFeeBps,
    withdrawalFeeBps: (flags & FEE_OVERRIDE.WITHDRAWAL) !== 0
      ? toNum(user.customWithdrawalFeeBps)
      : defaults.withdrawalFeeBps,
    performanceFeeBps: (flags & FEE_OVERRIDE.PERFORMANCE) !== 0
      ? toNum(user.customPerformanceFeeBps)
      : defaults.performanceFeeBps,
    managementFeeBps: (flags & FEE_OVERRIDE.MANAGEMENT) !== 0
      ? toNum(user.customManagementFeeBps)
      : defaults.managementFeeBps,
  }
}

/**
 * Mirror on-chain `resolve_effective_fees`. Returns fee rates in bps.
 */
export function resolveEffectiveFeeBps(
  bundle: BundleAccount,
  user: UserBundleAccount,
): EffectiveFeeBps {
  return resolveEffectiveFeeBpsFromDefaults(bundleDefaultFeeBps(bundle), user)
}

/**
 * Resolve effective fees for UI vault config defaults + optional user bundle account.
 * Returns decimal fees (`0.01` = 1%).
 */
export function resolveEffectiveVaultFees(
  vaultDefaults: EffectiveVaultFeeDecimals,
  user?: UserBundleAccount | null,
): EffectiveVaultFeeDecimals {
  if (!user)
    return vaultDefaults
  const effectiveBps = resolveEffectiveFeeBpsFromDefaults(
    vaultFeeDecimalsToBps(vaultDefaults),
    user,
  )
  return effectiveFeeBpsToDecimals(effectiveBps)
}

export function hasAnyFeeOverride(user?: UserBundleAccount | null): boolean {
  if (!user)
    return false
  return toNum(user.feeOverrideFlags) !== 0
}

export function hasCustomFeeRate(
  effectiveFees: EffectiveVaultFeeDecimals,
  vaultDefaults: EffectiveVaultFeeDecimals,
): boolean {
  return (
    Math.abs(effectiveFees.dfee - vaultDefaults.dfee) > FEE_EPS
    || Math.abs(effectiveFees.wfee - vaultDefaults.wfee) > FEE_EPS
    || Math.abs(effectiveFees.pfee - vaultDefaults.pfee) > FEE_EPS
    || Math.abs(effectiveFees.mfee - vaultDefaults.mfee) > FEE_EPS
  )
}

export function computeDepositFeePreview(
  grossAmount: number,
  depositFeeDecimal: number,
): { feeAmount: number, netAmount: number } {
  if (grossAmount <= 0 || depositFeeDecimal <= 0) {
    return { feeAmount: 0, netAmount: grossAmount }
  }
  const feeAmount = grossAmount * depositFeeDecimal
  return { feeAmount, netAmount: grossAmount - feeAmount }
}
