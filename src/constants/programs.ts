import type { AnchorProvider } from '@coral-xyz/anchor-29'
import type { AnchorProvider as AnchorProvider32 } from '@coral-xyz/anchor-32'
import type { NtbundleV1 } from '../idl/bundle-v1'
import type { NtbundleV2 } from '../idl/bundle-v2'
import { Program } from '@coral-xyz/anchor-29'
import { Program as Program32 } from '@coral-xyz/anchor-32'
import { PublicKey } from '@solana/web3.js'
import idlV1 from '../idl/bundle-v1.json'
import idlV2 from '../idl/bundle-v2.json'

export type BundleProgram = Program<NtbundleV1> | Program32<NtbundleV2>
export type BundleProvider = AnchorProvider | AnchorProvider32

export enum BundleProgramId {
  V1 = 'BUNDDh4P5XviMm1f3gCvnq2qKx6TGosAGnoUK12e7cXU',
  V2 = 'BUNDeH5A4c47bcEoAjBhN3sCjLgYnRsmt9ibMztqVkC9',
}

/**
 * Create Bundle Program instances for a given provider
 */
export function createBundleProgramV1(provider: AnchorProvider): Program<NtbundleV1> {
  return new Program<NtbundleV1>(
    idlV1 as NtbundleV1,
    new PublicKey(BundleProgramId.V1),
    provider,
  )
}

export function createBundleProgramV2(provider: AnchorProvider32): Program32<NtbundleV2> {
  return new Program32<NtbundleV2>(idlV2 as NtbundleV2, provider)
}
