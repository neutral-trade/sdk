import { describe, expect, it } from 'vitest'
import { getPointsVaults } from '../src/constants/points-vaults'
import {
  ALLOWLISTED_BUNDLE_PROGRAM_IDS_BY_CLUSTER,
  assertAllowlistedBundleProgramId,
  BUNDLE_PROGRAM_ID_V2_MAINNET,
  DEFAULT_BUNDLE_PROGRAM_ID_DEVNET,
  DEFAULT_BUNDLE_PROGRAM_ID_MAINNET,
  getDefaultBundleProgramIdByCluster,
  isAllowlistedBundleProgramId,
} from '../src/constants/programs'
import { DevnetVaultId } from '../src/constants/vault-ids.devnet'
import {
  getBundleProgramId,
  getDriftProgramId,
  getVaultById,
  getVaultRegistry,
  toVaultConfig,
  toVaultRegistry,
  vaults,
  vaultsDevnet,
} from '../src/constants/vaults'
import {
  getSolanaTokenDecimals,
  getSolanaTokenMint,
  ROBINHOOD_CHAIN_ID,
  SupportedChain,
  SupportedToken,
  tokens,
  VaultCategory,
  VaultRegistryEntrySchema,
  VaultType,
} from '../src/types'

describe('types and Constants Validation', () => {
  describe('supportedToken enum', () => {
    it('should have all expected tokens', () => {
      expect(SupportedToken.USDC).toBe('USDC')
      expect(SupportedToken.USDT).toBe('USDT')
      expect(SupportedToken.USDE).toBe('USDE')
      expect(SupportedToken.SOL).toBe('SOL')
      expect(SupportedToken.WBTC).toBe('WBTC')
      expect(SupportedToken.WETH).toBe('WETH')
      expect(SupportedToken.JLP).toBe('JLP')
    })
  })

  describe('tokens definition', () => {
    it('uSDC should have correct decimals', () => {
      const usdcInfo = tokens[SupportedToken.USDC].onChain[SupportedChain.Solana]
      expect(usdcInfo?.decimals).toBe(6)
    })

    it('sOL should have correct decimals', () => {
      const solInfo = tokens[SupportedToken.SOL].onChain[SupportedChain.Solana]
      expect(solInfo?.decimals).toBe(9)
    })

    it('wBTC should have correct decimals', () => {
      const wbtcInfo = tokens[SupportedToken.WBTC].onChain[SupportedChain.Solana]
      expect(wbtcInfo?.decimals).toBe(8)
    })

    it('uSDE should have correct decimals', () => {
      const usdeInfo = tokens[SupportedToken.USDE].onChain[SupportedChain.Solana]
      expect(usdeInfo?.decimals).toBe(9)
      expect(usdeInfo?.address).toBe('DEkqHyPN7GMRJ5cArtQFAWefqbZb33Hyf6s5iCwjEonT')
    })
  })

  describe('vaultType enum', () => {
    it('should have all vault types', () => {
      expect(VaultType.Drift).toBe('Drift')
      expect(VaultType.Bundle).toBe('Bundle')
      expect(VaultType.Hyperliquid).toBe('Hyperliquid')
      expect(VaultType.Kamino).toBe('Kamino')
      expect(VaultType.AccountableNav).toBe('AccountableNav')
    })
  })

  describe('robinhood chain', () => {
    it('exposes chain enum member and chain id', () => {
      expect(SupportedChain.Robinhood).toBe('Robinhood')
      expect(ROBINHOOD_CHAIN_ID).toBe(4663)
    })

    it('uSDe has Robinhood metadata with 18 decimals', () => {
      const usdeRobinhood = tokens[SupportedToken.USDE].onChain[SupportedChain.Robinhood]
      expect(usdeRobinhood?.address).toBe('0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34')
      expect(usdeRobinhood?.decimals).toBe(18)
    })

    it('other tokens have no Robinhood deployment', () => {
      expect(tokens[SupportedToken.USDC].onChain[SupportedChain.Robinhood]).toBeNull()
    })
  })

  describe('accountable NAV registry fields', () => {
    const accountableEntry = {
      vaultId: 81,
      name: 'Meridian Liquidity Provider',
      type: VaultType.AccountableNav,
      category: VaultCategory.privateCredit,
      vaultAddress: '0x1111111111111111111111111111111111111111',
      depositToken: SupportedToken.USDE,
      accountableLoanId: 607290214,
      strategyAddress: '0x2222222222222222222222222222222222222222',
    }

    it('validates an AccountableNav entry with provider fields', () => {
      expect(VaultRegistryEntrySchema.parse(accountableEntry)).toMatchObject({
        accountableLoanId: 607290214,
        strategyAddress: '0x2222222222222222222222222222222222222222',
      })
    })

    it('rejects a non-EVM strategyAddress', () => {
      expect(() =>
        VaultRegistryEntrySchema.parse({ ...accountableEntry, strategyAddress: 'not-an-address' }),
      ).toThrow()
    })

    it('provider fields never appear on non-Accountable entries', () => {
      for (const config of Object.values(vaults)) {
        if (config.type === VaultType.AccountableNav)
          continue
        expect(config.accountableLoanId).toBeUndefined()
        expect(config.strategyAddress).toBeUndefined()
      }
    })

    it('bundle/Drift helpers ignore AccountableNav entries', () => {
      expect(getBundleProgramId(accountableEntry, 'mainnet')).toBeUndefined()
      expect(getDriftProgramId(accountableEntry)).toBeUndefined()

      const resolved = toVaultConfig(accountableEntry, 'mainnet')
      expect(resolved.bundleProgramId).toBeUndefined()
      expect(resolved.driftProgramId).toBeUndefined()
      expect(resolved.accountableLoanId).toBe(607290214)
      expect(resolved.strategyAddress).toBe('0x2222222222222222222222222222222222222222')
    })
  })

  describe('bundleProgramId defaults', () => {
    it('should have mainnet and devnet default program IDs', () => {
      expect(DEFAULT_BUNDLE_PROGRAM_ID_MAINNET).toBeDefined()
      expect(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET).toBeDefined()
    })

    it('should have valid Solana addresses', () => {
      expect(DEFAULT_BUNDLE_PROGRAM_ID_MAINNET.length).toBeGreaterThanOrEqual(32)
      expect(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET.length).toBeGreaterThanOrEqual(32)
    })

    it('mainnet and devnet defaults should be different', () => {
      expect(DEFAULT_BUNDLE_PROGRAM_ID_MAINNET).not.toBe(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET)
    })

    it('should resolve default by cluster', () => {
      expect(getDefaultBundleProgramIdByCluster('mainnet')).toBe(DEFAULT_BUNDLE_PROGRAM_ID_MAINNET)
      expect(getDefaultBundleProgramIdByCluster('devnet')).toBe(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET)
    })

    it('checks and asserts the cluster allowlist', () => {
      expect(ALLOWLISTED_BUNDLE_PROGRAM_IDS_BY_CLUSTER.mainnet).toContain(BUNDLE_PROGRAM_ID_V2_MAINNET)
      expect(isAllowlistedBundleProgramId(DEFAULT_BUNDLE_PROGRAM_ID_MAINNET, 'mainnet')).toBe(true)
      expect(isAllowlistedBundleProgramId(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET, 'mainnet')).toBe(false)
      expect(() => assertAllowlistedBundleProgramId(DEFAULT_BUNDLE_PROGRAM_ID_MAINNET, 'mainnet')).not.toThrow()
      expect(() => assertAllowlistedBundleProgramId(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET, 'mainnet')).toThrow(
        'Unsupported bundle program id for mainnet',
      )
    })
  })

  describe('vaults registry', () => {
    it('should have vaults loaded from registry', () => {
      const vaultIds = Object.keys(vaults)
      expect(vaultIds.length).toBeGreaterThan(0)
    })

    it('each vault should have required fields', () => {
      for (const [vaultIdStr, config] of Object.entries(vaults)) {
        const vaultId = Number(vaultIdStr)

        // Required fields
        expect(config.vaultId).toBe(vaultId)
        expect(config.name).toBeTruthy()
        expect(typeof config.name).toBe('string')

        // subname is optional
        if (config.subname !== undefined) {
          expect(typeof config.subname).toBe('string')
        }

        expect(Object.values(VaultType)).toContain(config.type)
        expect(config.vaultAddress).toBeTruthy()
        expect(config.depositToken).toBeDefined()
      }
    })

    it('vault addresses should be valid Solana addresses', () => {
      for (const config of Object.values(vaults)) {
        // Base58 addresses are typically 32-44 characters
        expect(config.vaultAddress.length).toBeGreaterThanOrEqual(32)
        expect(config.vaultAddress.length).toBeLessThanOrEqual(44)
      }
    })

    it('should have both Drift and Bundle vaults', () => {
      const driftVaults = Object.values(vaults).filter(v => v.type === VaultType.Drift)
      const bundleVaults = Object.values(vaults).filter(v => v.type === VaultType.Bundle)

      expect(driftVaults.length).toBeGreaterThan(0)
      expect(bundleVaults.length).toBeGreaterThan(0)
    })

    it('should set bundleProgramId on every Bundle vault (toVaultConfig default)', () => {
      for (const v of Object.values(vaults)) {
        if (v.type !== VaultType.Bundle)
          continue
        expect(v.bundleProgramId).toBeDefined()
        expect(typeof v.bundleProgramId).toBe('string')
        expect(v.bundleProgramId!.length).toBeGreaterThanOrEqual(32)
      }
      for (const v of Object.values(vaultsDevnet)) {
        if (v.type !== VaultType.Bundle)
          continue
        expect(v.bundleProgramId).toBeDefined()
        expect(typeof v.bundleProgramId).toBe('string')
      }
    })

    it('vaultIds should be unique', () => {
      const vaultIds = Object.values(vaults).map(v => v.vaultId)
      const uniqueIds = new Set(vaultIds)
      expect(uniqueIds.size).toBe(vaultIds.length)
    })

    it('transforms raw entries into resolved registry configs', () => {
      const rawBundleVault = { ...vaults[48], bundleProgramId: undefined }
      const resolved = toVaultConfig(rawBundleVault, 'devnet')
      const registry = toVaultRegistry([rawBundleVault], 'devnet')

      expect(resolved.bundleProgramId).toBe(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET)
      expect(resolved.driftProgramId).toBeUndefined()
      expect(registry[rawBundleVault.vaultId]).toEqual(resolved)
    })

    it('resolves Drift ids and points-ready vaults', () => {
      const driftVault = Object.values(vaults).find(vault => vault.type === VaultType.Drift)!
      const pointsVaults = getPointsVaults(vaults)

      expect(getDriftProgramId(driftVault)).toBeTruthy()
      expect(pointsVaults.every(vault => vault.enabled)).toBe(true)
      expect(pointsVaults.every(vault => vault.depositToken.length > 0)).toBe(true)
    })
  })

  describe('getBundleProgramId function', () => {
    it('should return registry bundleProgramId when present', () => {
      expect(getBundleProgramId(vaults[69], 'mainnet')).toBe(vaults[69].bundleProgramId)
    })

    it('should return cluster fallback when bundleProgramId is missing', () => {
      const missingProgramIdVault = { ...vaults[48], bundleProgramId: undefined }
      expect(getBundleProgramId(missingProgramIdVault, 'mainnet')).toBe(DEFAULT_BUNDLE_PROGRAM_ID_MAINNET)
      expect(getBundleProgramId(missingProgramIdVault, 'devnet')).toBe(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET)
    })
  })

  describe('devnet registry', () => {
    it('exposes fixture vault and DevnetVaultId', () => {
      expect(vaultsDevnet[100000002]).toBeDefined()
      expect(vaultsDevnet[100000002].name).toBe('bundle-1')
      expect(DevnetVaultId.bundle_1_100000002).toBe(100000002)
      expect(getVaultRegistry('devnet')).toBe(vaultsDevnet)
      expect(getVaultById(100000002, 'devnet')?.vaultAddress).toBe('HXvKAH4QyYMe7MsxC88pb19MhhYCEDHai87E8tZkmXmB')
    })

    it('devnet USDC mint uses team mock SPL', () => {
      expect(getSolanaTokenMint(SupportedToken.USDC, 'devnet')).toBe(
        '6a8hWCCa2QDQTqzLUapZwZtgHTox8BsgataN6JVLwdo7',
      )
      expect(getSolanaTokenMint(SupportedToken.USDC, 'mainnet')).toBe(
        tokens[SupportedToken.USDC].onChain[SupportedChain.Solana]!.address,
      )
      expect(getSolanaTokenDecimals(SupportedToken.USDC)).toBe(6)
    })
  })
})
