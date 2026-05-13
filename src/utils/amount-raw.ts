/** Max SPL token amount we accept (fits u64). */
const U64_MAX = 18446744073709551615n

/**
 * Parse `amountRaw`: base-10 digits only, smallest token units (same scale as SPL `amount`).
 * @throws Error with message `INVALID_AMOUNT_RAW` on invalid input
 */
export function parseAmountRawToBigInt(amountRaw: string): bigint {
  const t = amountRaw.trim()
  if (!/^\d+$/.test(t))
    throw new Error('INVALID_AMOUNT_RAW')
  const v = BigInt(t)
  if (v <= 0n)
    throw new Error('INVALID_AMOUNT_RAW')
  if (v > U64_MAX)
    throw new Error('INVALID_AMOUNT_RAW')
  return v
}

/**
 * Legacy UI path: finite `human` × 10^`decimals`, rounded to nearest integer token unit.
 * Prefer integrators sending `amountRaw` from a decimal string instead of this helper.
 * @throws Error with message `INVALID_HUMAN_AMOUNT` when out of range or non-finite
 */
export function humanFloatToAmountRawString(human: number, decimals: number): string {
  if (!Number.isFinite(human) || human <= 0)
    throw new Error('INVALID_HUMAN_AMOUNT')
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
    throw new Error('INVALID_HUMAN_AMOUNT')
  const scaled = human * 10 ** decimals
  if (!Number.isFinite(scaled))
    throw new Error('INVALID_HUMAN_AMOUNT')
  const rounded = Math.round(scaled)
  if (rounded <= 0)
    throw new Error('INVALID_HUMAN_AMOUNT')
  return parseAmountRawToBigInt(BigInt(rounded).toString()).toString()
}
