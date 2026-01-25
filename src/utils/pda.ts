// PDA derivation utilities

import { PublicKey } from '@solana/web3.js'

const encoder = new TextEncoder()

// Seed constants for Bundle
export const SEED_ORACLE = encoder.encode('ORACLE')
export const SEED_USER = encoder.encode('USER_BUNDLE')
export const SEED_TEMP = encoder.encode('BUNDLE_TEMP_DATA')
export const SEED_PENDING_AUTH = encoder.encode('PENDING_BUNDLE_ASSET_AUTHORITY')

/**
 * Derive Oracle PDA for Bundle vault
 */
export function deriveOraclePDA(bundlePDA: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [SEED_ORACLE, bundlePDA.toBuffer()],
    programId,
  )
  return pda
}

/**
 * Derive User PDA for Bundle vault
 */
export function deriveUserPDA(
  userKey: PublicKey,
  bundlePDA: PublicKey,
  programId: PublicKey,
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [SEED_USER, userKey.toBuffer(), bundlePDA.toBuffer()],
    programId,
  )
  return pda
}

/**
 * Derive Temp Data PDA for Bundle vault
 */
export function deriveTempDataPDA(bundlePDA: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [SEED_TEMP, bundlePDA.toBuffer()],
    programId,
  )
  return pda
}

/**
 * Get Vault Depositor PDA for Drift vault
 * Custom code to handle jlpdnv1 special case
 */
export function getVaultDepositorAddressSync(
  programId: PublicKey,
  vault: PublicKey,
  authority: PublicKey,
): PublicKey {
  let _vault = vault

  // Special case for jlpdnv1 vault
  if (vault.toBase58() === '3Nkctq19AW7gs5hkxixUDjS9UVjmCwcNCo7rqPpub87c') {
    const name = new Uint8Array(32)
    name.set(encoder.encode('Neutral Trade'))
    _vault = PublicKey.findProgramAddressSync(
      [encoder.encode('vault'), name],
      programId,
    )[0]
  }

  return PublicKey.findProgramAddressSync(
    [encoder.encode('vault_depositor'), _vault.toBuffer(), authority.toBuffer()],
    programId,
  )[0]
}
