import { describe, expect, it } from 'vitest'
import { humanFloatToAmountRawString, parseAmountRawToBigInt } from '../src/utils/amount-raw'

describe('parseAmountRawToBigInt', () => {
  it('accepts positive integer strings', () => {
    expect(parseAmountRawToBigInt('1')).toBe(1n)
    expect(parseAmountRawToBigInt('1000000')).toBe(1_000_000n)
  })

  it('rejects invalid', () => {
    expect(() => parseAmountRawToBigInt('')).toThrow('INVALID_AMOUNT_RAW')
    expect(() => parseAmountRawToBigInt('0')).toThrow('INVALID_AMOUNT_RAW')
    expect(() => parseAmountRawToBigInt('1.5')).toThrow('INVALID_AMOUNT_RAW')
  })

  it('trims whitespace', () => {
    expect(parseAmountRawToBigInt(' 1 ')).toBe(1n)
  })
})

describe('humanFloatToAmountRawString', () => {
  it('converts USDC-style amounts', () => {
    expect(humanFloatToAmountRawString(1, 6)).toBe('1000000')
    expect(humanFloatToAmountRawString(0.01, 6)).toBe('10000')
  })
})
