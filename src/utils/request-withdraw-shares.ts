import BN from 'bn.js'

/**
 * Shares to burn for `requestWithdrawal`, from integer token raw and on-chain totals.
 * Full position: pass `amountRaw >= userTokenRaw` where `userTokenRaw = (userShares * totalEquity) / totalShares`.
 */
export function computeRequestWithdrawalSharesFromAmountRaw({
  amountRaw,
  userShares,
  totalEquity,
  totalShares,
}: {
  amountRaw: bigint
  userShares: BN
  totalEquity: bigint
  totalShares: bigint
}): BN {
  const us = BigInt(userShares.toString())
  if (totalShares === 0n || us === 0n)
    return new BN(0)
  const userTokenRaw = (us * totalEquity) / totalShares
  if (amountRaw >= userTokenRaw)
    return userShares
  if (totalEquity === 0n)
    return new BN(0)
  const computedShares = (amountRaw * totalShares) / totalEquity
  const sharesBn = new BN(computedShares.toString())
  return sharesBn.gt(userShares) ? userShares : sharesBn
}
