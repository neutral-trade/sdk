import type { AnchorProvider } from '@coral-xyz/anchor'
import type { Ntbundle } from '../idl/ntbundle'
import { Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import ntbundleIdlMain from '../idl/ntbundle.json'
import ntbundleIdlJupiter from '../idl/ntbundle.jupiter.json'

export type BundleProgram = Program<Ntbundle>
export type BundleProvider = AnchorProvider

export type BundleCluster = 'mainnet' | 'devnet'

function toCustomProgramPublicKey(programId: string): PublicKey {
  try {
    return new PublicKey(programId)
  }
  catch {
    throw new Error(`Invalid custom bundle program id: ${programId}`)
  }
}

export const DEFAULT_BUNDLE_PROGRAM_ID_MAINNET = 'BUNDDh4P5XviMm1f3gCvnq2qKx6TGosAGnoUK12e7cXU'

/**
 * Secondary mainnet ntbundle program id (used when a vault sets `bundleProgramId` to this value).
 * Kept in sync with `sdk/src/registry/vaults.json` (e.g. vaultId 69 JLP Delta Neutral).
 */
export const BUNDLE_PROGRAM_ID_V2_MAINNET = 'BUNDeH5A4c47bcEoAjBhN3sCjLgYnRsmt9ibMztqVkC9'

// Source: bundle-sc/Anchor.toml [programs.devnet]
export const DEFAULT_BUNDLE_PROGRAM_ID_DEVNET = '7trSyt7d1ZRnvfGh9JaQZwZMWtfAXMvMwN3UxgMzVFbv'

export const DEFAULT_BUNDLE_PROGRAM_IDS_BY_CLUSTER: Record<BundleCluster, string> = {
  mainnet: DEFAULT_BUNDLE_PROGRAM_ID_MAINNET,
  devnet: DEFAULT_BUNDLE_PROGRAM_ID_DEVNET,
}

export function getDefaultBundleProgramIdByCluster(cluster: BundleCluster = 'mainnet'): string {
  return DEFAULT_BUNDLE_PROGRAM_IDS_BY_CLUSTER[cluster]
}

/**
 * Pick Anchor IDL bytes for this bundle program deployment.
 * Main vs Jupiter have different on-chain account layouts; same IDL + only `address` override breaks decode (e.g. vaultId 69).
 *
 * Jupiter IDL source: `bundle-backend/bundles-revamped/shared/targetV2Jupiter/idl/ntbundle.json`
 */
function ntbundleIdlJsonForProgramId(programIdBase58: string): typeof ntbundleIdlMain {
  if (programIdBase58 === BUNDLE_PROGRAM_ID_V2_MAINNET)
    return ntbundleIdlJupiter
  return ntbundleIdlMain
}

/**
 * Create Bundle Program client for a specific program id.
 */
export function createBundleProgramById(
  provider: AnchorProvider,
  programId: string,
): Program<Ntbundle> {
  const resolved = toCustomProgramPublicKey(programId).toBase58()
  const base = ntbundleIdlJsonForProgramId(resolved)
  const idlWithAddress = {
    ...base,
    address: resolved,
  } as Ntbundle
  return new Program<Ntbundle>(
    idlWithAddress,
    provider,
  )
}
