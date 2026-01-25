// =============================================================================
// BUNDLE VAULTS
// =============================================================================

import type { VaultConfig } from '../types'
import { SupportedToken, VaultId, VaultType } from '../types'
import { BundleProgramId } from './programs'

export const bundle_vaults: Partial<Record<VaultId, VaultConfig>> = {
  [VaultId.hlfundingarb]: {
    vaultId: VaultId.hlfundingarb,
    name: 'Hyperliquid Funding Arb',

    type: VaultType.Bundle,
    vaultAddress: 'nE1x7KQq2sm3GQrafQUUdBkSPPT52FmiMM9qAS1dgnC',
    depositToken: SupportedToken.USDC,
    pfee: 0.2,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.alpdn]: {
    vaultId: VaultId.alpdn,
    name: 'ALP Delta Neutral',

    type: VaultType.Bundle,
    vaultAddress: '5XNsfSeuB3SgknCHrbrv47UgcNNUMoG8CBzUJnwPcSej',
    depositToken: SupportedToken.USDC,
    pfee: 0,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.alpdnforest]: {
    vaultId: VaultId.alpdnforest,
    name: 'ALP Delta Neutral Forest',

    type: VaultType.Bundle,
    vaultAddress: 'HELqBHiykXecZqYEHSKFh7mzythQoM8CaXQuR6TESdPB',
    depositToken: SupportedToken.USDC,
    pfee: 0,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.termmax]: {
    vaultId: VaultId.termmax,
    name: 'Term Max',

    type: VaultType.Bundle,
    vaultAddress: 'AvK6eRQNXiFfGSibrA96qDEtACkPyoouGrRGseryZFdE',
    depositToken: SupportedToken.USDC,
    pfee: 0.2,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.ctamomentumrresearch]: {
    vaultId: VaultId.ctamomentumrresearch,
    name: 'CTA Momentum',
    subname: 'R* Research',
    type: VaultType.Bundle,
    vaultAddress: 'HDDrsNSYpfHHfr646T4vfZvXDKcbzYYBEGTietGgi7rh',
    depositToken: SupportedToken.USDC,
    pfee: 0.25,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.ntearnusdc]: {
    vaultId: VaultId.ntearnusdc,
    name: 'NT Earn',

    type: VaultType.Bundle,
    vaultAddress: 'HWjMfYfc7KoPchoEDa5UFyVSpJxY3aV1RAccKvABYb9z',
    depositToken: SupportedToken.USDC,
    pfee: 0,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.jlpdnbundle]: {
    vaultId: VaultId.jlpdnbundle,
    name: 'JLP Delta Neutral',
    subname: 'Vault-CEX',
    type: VaultType.Bundle,
    vaultAddress: '9cMB2bMsLa9hZjRnjxFhg2DM9CLmjabMsGvfQUtdgupk',
    depositToken: SupportedToken.USDC,
    pfee: 0.25,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.moonlp]: {
    vaultId: VaultId.moonlp,
    name: 'Moon LP',

    type: VaultType.Bundle,
    vaultAddress: 'FMtgtataz4L2efYanxTGpVjg4njNe2j8QLLsnw5zeBPx',
    depositToken: SupportedToken.USDC,
    pfee: 0,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.asterfundingarb]: {
    vaultId: VaultId.asterfundingarb,
    name: 'Aster Funding Arb',

    type: VaultType.Bundle,
    vaultAddress: '976iyYPcj5obNC25A4SRP3quDLbDPeXLjF1cgUamMKBK',
    depositToken: SupportedToken.USDT,
    pfee: 0.25,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.jlpdnjupiter]: {
    vaultId: VaultId.jlpdnjupiter,
    name: 'JLP Delta Neutral',
    subname: 'vault-jupiter',
    type: VaultType.Bundle,
    vaultAddress: 'GiNbTRuRqvVGEEQGZKMjmwX84LrsbqfzVVNtWYbcZPCY',
    depositToken: SupportedToken.USDC,
    pfee: 0.25,
    bundleProgramId: BundleProgramId.V2,
  },
  [VaultId.lighterllp1]: {
    vaultId: VaultId.lighterllp1,
    name: 'Lighter LLP',

    type: VaultType.Bundle,
    vaultAddress: 'dvsWTBqogw1cou8ducadzc3YCmUssjrrio8LmMtNWmz',
    depositToken: SupportedToken.USDC,
    pfee: 0,
    bundleProgramId: BundleProgramId.V1,
  },
  [VaultId.hyperithm1]: {
    vaultId: VaultId.hyperithm1,
    name: 'Hyperithm Cross-Exchange Arb',

    type: VaultType.Bundle,
    vaultAddress: '2bPiNfGc7exUcGkvV5nbsSkuNH3inFU18kgNEkB8fiaT',
    depositToken: SupportedToken.USDC,
    pfee: 0.2,
    bundleProgramId: BundleProgramId.V1,
  },
}
