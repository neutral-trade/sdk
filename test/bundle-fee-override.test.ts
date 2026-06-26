import type { BundleAccount, UserBundleAccount } from '../src/types/bundle-types'
import { describe, expect, it } from 'vitest'
import {
  computeDepositFeePreview,
  effectiveFeeBpsToDecimals,
  FEE_OVERRIDE,
  hasAnyFeeOverride,
  hasCustomFeeRate,
  resolveEffectiveFeeBps,
  resolveEffectiveFeeBpsFromDefaults,
  resolveEffectiveVaultFees,
  vaultFeeDecimalsToBps,
} from '../src/utils/bundle-fee-override'

describe('bundle-fee-override', () => {
  const bundle = {
    depositFee: 100,
    withdrawalFee: 50,
    performanceFee: 2000,
    managementFeeBps: 100,
  } as unknown as BundleAccount

  const vaultDefaults = {
    dfee: 0.01,
    wfee: 0.005,
    pfee: 0.2,
    mfee: 0.02,
  }

  it('returns bundle defaults when feeOverrideFlags is 0', () => {
    const user = { feeOverrideFlags: 0 } as unknown as UserBundleAccount
    expect(resolveEffectiveFeeBps(bundle, user)).toEqual({
      depositFeeBps: 100,
      withdrawalFeeBps: 50,
      performanceFeeBps: 2000,
      managementFeeBps: 100,
    })
  })

  it('applies management override only', () => {
    const user = {
      feeOverrideFlags: FEE_OVERRIDE.MANAGEMENT,
      customManagementFeeBps: 25,
    } as unknown as UserBundleAccount
    expect(resolveEffectiveFeeBps(bundle, user)).toEqual({
      depositFeeBps: 100,
      withdrawalFeeBps: 50,
      performanceFeeBps: 2000,
      managementFeeBps: 25,
    })
  })

  it('applies performance override only', () => {
    const user = {
      feeOverrideFlags: FEE_OVERRIDE.PERFORMANCE,
      customPerformanceFeeBps: 500,
    } as unknown as UserBundleAccount
    const result = resolveEffectiveFeeBps(bundle, user)
    expect(result.performanceFeeBps).toBe(500)
    expect(result.managementFeeBps).toBe(100)
  })

  it('resolveEffectiveVaultFees uses vault defaults and user overrides', () => {
    const user = {
      feeOverrideFlags: FEE_OVERRIDE.DEPOSIT,
      customDepositFeeBps: 25,
    } as unknown as UserBundleAccount
    expect(resolveEffectiveVaultFees(vaultDefaults, user)).toEqual({
      dfee: 0.0025,
      wfee: 0.005,
      pfee: 0.2,
      mfee: 0.02,
    })
  })

  it('resolveEffectiveFeeBpsFromDefaults matches vaultFeeDecimalsToBps defaults', () => {
    const user = {
      feeOverrideFlags: FEE_OVERRIDE.DEPOSIT | FEE_OVERRIDE.WITHDRAWAL,
      customDepositFeeBps: 100,
      customWithdrawalFeeBps: 200,
    } as unknown as UserBundleAccount
    const result = resolveEffectiveFeeBpsFromDefaults(vaultFeeDecimalsToBps(vaultDefaults), user)
    expect(effectiveFeeBpsToDecimals(result)).toEqual({
      dfee: 0.01,
      wfee: 0.02,
      pfee: 0.2,
      mfee: 0.02,
    })
  })

  it('hasAnyFeeOverride and hasCustomFeeRate', () => {
    const user = {
      feeOverrideFlags: FEE_OVERRIDE.DEPOSIT,
      customDepositFeeBps: 25,
    } as unknown as UserBundleAccount
    expect(hasAnyFeeOverride(user)).toBe(true)
    const effective = resolveEffectiveVaultFees(vaultDefaults, user)
    expect(hasCustomFeeRate(effective, vaultDefaults)).toBe(true)
    expect(hasCustomFeeRate(resolveEffectiveVaultFees(vaultDefaults, {
      ...user,
      customDepositFeeBps: 100,
    }), vaultDefaults)).toBe(false)
  })

  it('computeDepositFeePreview', () => {
    expect(computeDepositFeePreview(1000, 0.01)).toEqual({
      feeAmount: 10,
      netAmount: 990,
    })
  })
})
