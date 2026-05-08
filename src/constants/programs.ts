import type { AnchorProvider } from '@coral-xyz/anchor'
import type { Ntbundle } from '../idl/ntbundle'
import { Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import ntbundleIdl from '../idl/ntbundle.json'

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
 * Create Bundle Program client for a specific program id.
 */
export function createBundleProgramById(
  provider: AnchorProvider,
  programId: string,
): Program<Ntbundle> {
  const resolved = toCustomProgramPublicKey(programId).toBase58()
  const idlWithAddress = {
    ...ntbundleIdl,
    address: resolved,
  } as Ntbundle
  return new Program<Ntbundle>(
    idlWithAddress,
    provider,
  )
}
