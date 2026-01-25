import type { BundleProgramId } from '../constants/programs'
import type { Token } from './tokens'
import { z } from 'zod'
import {
  SupportedChain,
  SupportedToken,
  tokens,
} from './tokens'

export {
  SupportedChain,
  SupportedToken,
  tokens,
}
export type { Token }

export enum VaultId {
  // **drift vaults**
  jlpdnv1 = 0,
  solnl = 1,
  rekt = 2,
  btcnl = 3,
  jlpdnv2 = 4,
  vip1 = 5,
  ethnl = 6,
  print = 7,
  solbasisinf = 8,
  vip2 = 9,
  vip3 = 10,
  perpsbasket = 11,
  vip5 = 12,
  vip6 = 13,
  vip7 = 14,
  vip8 = 15,
  jlpdnv3 = 16,
  vip10 = 17,
  vip11 = 18,
  vip12 = 19,
  vip13 = 20,
  solctamarco = 21,
  vip14 = 22,
  vip15 = 23,
  vip16 = 24,
  usdctangem = 25,
  btctangem = 26,
  vip17 = 27,
  vip18 = 28,
  jlpdnv4 = 29,
  solethflip = 30,
  jlpdnv5 = 31,
  vip1ag = 32,
  usdcsuper = 33,
  vip19 = 34,
  vip20 = 35,
  neutralizedjlp = 36,
  thebigshort = 37,
  fuelmaxi = 38,
  usdcsavings = 39,
  solsavings = 40,
  ethsavings = 41,
  btcsavings = 42,
  jlpdnteam = 43,
  btcdom = 44,
  fartdom = 45,
  hyperjlp = 46,
  bonkpump = 47,
  nmmjlpdn = 57,
  memesetf = 58,
  annafromperena = 59,
  vip22 = 62,
  vip23 = 63,
  vip24 = 64,
  solnlperps = 68,

  // **external vaults**
  hlbigshort = 53,
  hlhypesol = 54,
  hlaltdom = 55,
  hlbtcdom = 56,
  kaminolend = 61,

  // **bundles**
  hlfundingarb = 48,
  alpdn = 49, // vip
  alpdnforest = 50, // vip
  termmax = 51,
  ctamomentumrresearch = 52,
  ntearnusdc = 60,
  jlpdnbundle = 65,
  moonlp = 66,
  asterfundingarb = 67,
  jlpdnjupiter = 69,
  lighterllp1 = 70,
  hyperithm1 = 71,
}

export enum VaultType {
  Drift = 'Drift',
  Bundle = 'Bundle',
  Hyperliquid = 'Hyperliquid',
  Kamino = 'Kamino',
}

export interface VaultConfig {
  vaultId: VaultId
  name: string
  subname?: string
  type: VaultType
  vaultAddress: string
  depositToken: SupportedToken
  bundleProgramId?: BundleProgramId
  driftProgramId?: string
  pfee: number
}

// =============================================================================
// ZOD SCHEMAS FOR VAULT VALIDATION (used for remote registry)
// =============================================================================

export const VaultConfigSchema = z.object({
  vaultId: z.number().int().min(0),
  name: z.string().min(1).max(100),
  subname: z.string().max(100).optional(),
  type: z.nativeEnum(VaultType),
  vaultAddress: z.string().min(32).max(44),
  depositToken: z.nativeEnum(SupportedToken),
  bundleProgramId: z.string().optional(),
  driftProgramId: z.string().optional(),
  pfee: z.number().min(0).max(1),
})

export const VaultRegistrySchema = z.record(
  z.string(), // vaultId as string key
  VaultConfigSchema,
)

export type VaultRegistry = z.infer<typeof VaultRegistrySchema>
