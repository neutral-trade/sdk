import { BN } from '@coral-xyz/anchor'
import { describe, expect, it } from 'vitest'
import { computeRequestWithdrawalSharesFromAmountRaw } from '../src/utils/bundle-instructions'

describe('computeRequestWithdrawalSharesFromAmountRaw', () => {
  const totalShares = 1000n
  const totalEquity = 1050n
  const userShares = new BN('1000')

  it('burns all shares when amountRaw >= user token raw', () => {
    const userTokenRaw = (1000n * 1050n) / 1000n
    const out = computeRequestWithdrawalSharesFromAmountRaw({
      amountRaw: userTokenRaw,
      userShares,
      totalEquity,
      totalShares,
    })
    expect(out.toString()).toBe(userShares.toString())
  })

  it('burns all shares when amount exceeds user token raw', () => {
    const userTokenRaw = (1000n * 1050n) / 1000n
    const out = computeRequestWithdrawalSharesFromAmountRaw({
      amountRaw: userTokenRaw + 1n,
      userShares,
      totalEquity,
      totalShares,
    })
    expect(out.toString()).toBe(userShares.toString())
  })

  it('computes partial shares from token raw and pool ratio', () => {
    const amountRaw = 105n
    const expected = new BN(((105n * totalShares) / totalEquity).toString())
    const out = computeRequestWithdrawalSharesFromAmountRaw({
      amountRaw,
      userShares,
      totalEquity,
      totalShares,
    })
    expect(out.toString()).toBe(expected.toString())
  })

  it('caps at user shares when computed shares exceed balance', () => {
    const out = computeRequestWithdrawalSharesFromAmountRaw({
      amountRaw: 1_000_000n,
      userShares: new BN('100'),
      totalEquity: 1n,
      totalShares: 1n,
    })
    expect(out.lte(new BN('100'))).toBe(true)
    expect(out.toString()).toBe('100')
  })
})
