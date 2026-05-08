import { BN } from '@coral-xyz/anchor'
import { describe, expect, it } from 'vitest'
import { computeRequestWithdrawalSharesAmount } from '../src/utils/bundle-instructions'

describe('computeRequestWithdrawalSharesAmount', () => {
  const assetDecimals = 6
  const pps = 1.05e6
  const userShares = new BN('1000000000')
  const userVaultBalance = 1050

  it('uses all user shares when amount >= user vault balance', () => {
    const out = computeRequestWithdrawalSharesAmount({
      amount: userVaultBalance,
      userVaultBalance,
      pps,
      assetDecimals,
      userShares,
    })
    expect(out.toString()).toBe(userShares.toString())
  })

  it('uses all user shares when amount exceeds user vault balance', () => {
    const out = computeRequestWithdrawalSharesAmount({
      amount: userVaultBalance + 1,
      userVaultBalance,
      pps,
      assetDecimals,
      userShares,
    })
    expect(out.toString()).toBe(userShares.toString())
  })

  it('computes partial shares from token amount and pps', () => {
    const amount = 105
    const expected = new BN(Math.floor((amount * 10 ** assetDecimals) / pps))
    const out = computeRequestWithdrawalSharesAmount({
      amount,
      userVaultBalance,
      pps,
      assetDecimals,
      userShares,
    })
    expect(out.toString()).toBe(expected.toString())
  })

  it('caps at user shares when computed shares exceed balance', () => {
    const out = computeRequestWithdrawalSharesAmount({
      amount: userVaultBalance,
      userVaultBalance,
      pps: 0.001,
      assetDecimals,
      userShares: new BN('100'),
    })
    expect(out.lte(new BN('100'))).toBe(true)
    expect(out.toString()).toBe('100')
  })
})
