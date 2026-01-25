import { describe, expect, it } from 'vitest'
import { bundle_vaults } from '../src/constants/bundle-vaults'
import { drift_vaults } from '../src/constants/drift-vaults'
import { BundleProgramId } from '../src/constants/programs'
import {
  SupportedChain,
  SupportedToken,
  tokens,
  VaultId,
  VaultType,
} from '../src/types'

describe('types and Constants Validation', () => {
  describe('supportedToken enum', () => {
    it('should have all expected tokens', () => {
      expect(SupportedToken.USDC).toBe('USDC')
      expect(SupportedToken.USDT).toBe('USDT')
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
  })

  describe('vaultId enum', () => {
    it('should have Drift vault IDs', () => {
      expect(VaultId.jlpdnv1).toBeDefined()
      expect(VaultId.solnl).toBeDefined()
      expect(VaultId.btcnl).toBeDefined()
    })

    it('should have Bundle vault IDs', () => {
      expect(VaultId.hlfundingarb).toBeDefined()
      expect(VaultId.termmax).toBeDefined()
      expect(VaultId.ntearnusdc).toBeDefined()
      expect(VaultId.jlpdnbundle).toBeDefined()
    })

    it('should be numeric enum', () => {
      expect(typeof VaultId.jlpdnv1).toBe('number')
      expect(typeof VaultId.hlfundingarb).toBe('number')
    })
  })

  describe('vaultType enum', () => {
    it('should have all vault types', () => {
      expect(VaultType.Drift).toBe('Drift')
      expect(VaultType.Bundle).toBe('Bundle')
      expect(VaultType.Hyperliquid).toBe('Hyperliquid')
      expect(VaultType.Kamino).toBe('Kamino')
    })
  })

  describe('bundleProgramId', () => {
    it('should have V1 and V2 program IDs', () => {
      expect(BundleProgramId.V1).toBeDefined()
      expect(BundleProgramId.V2).toBeDefined()
    })

    it('should have valid Solana addresses', () => {
      expect(BundleProgramId.V1.length).toBeGreaterThanOrEqual(32)
      expect(BundleProgramId.V2.length).toBeGreaterThanOrEqual(32)
    })

    it('v1 and V2 should be different', () => {
      expect(BundleProgramId.V1).not.toBe(BundleProgramId.V2)
    })
  })

  describe('bundle_vaults configuration', () => {
    it('should have at least one bundle vault', () => {
      const vaultIds = Object.keys(bundle_vaults)
      expect(vaultIds.length).toBeGreaterThan(0)
    })

    it('each bundle vault should have required fields', () => {
      for (const config of Object.values(bundle_vaults)) {
        if (!config)
          continue

        // Required fields
        expect(config.vaultId).toBeDefined()
        expect(config.name).toBeTruthy()
        expect(typeof config.name).toBe('string')
        // subname is optional
        if (config.subname !== undefined) {
          expect(typeof config.subname).toBe('string')
        }
        expect(config.type).toBe(VaultType.Bundle)
        expect(config.vaultAddress).toBeTruthy()
        expect(config.depositToken).toBeDefined()
        expect(config.bundleProgramId).toBeDefined()
        expect(typeof config.pfee).toBe('number')

        // pfee should be within valid range (0 to 1)
        expect(config.pfee).toBeGreaterThanOrEqual(0)
        expect(config.pfee).toBeLessThanOrEqual(1)
      }
    })

    it('bundle vaults should have valid bundleProgramId', () => {
      for (const config of Object.values(bundle_vaults)) {
        if (!config)
          continue

        expect([BundleProgramId.V1, BundleProgramId.V2]).toContain(config.bundleProgramId)
      }
    })

    it('bundle vault addresses should be valid Solana addresses', () => {
      for (const config of Object.values(bundle_vaults)) {
        if (!config)
          continue

        // Base58 addresses are typically 32-44 characters
        expect(config.vaultAddress.length).toBeGreaterThanOrEqual(32)
        expect(config.vaultAddress.length).toBeLessThanOrEqual(44)
      }
    })
  })

  describe('drift_vaults configuration', () => {
    it('should have at least one drift vault', () => {
      const vaultIds = Object.keys(drift_vaults)
      expect(vaultIds.length).toBeGreaterThan(0)
    })

    it('each drift vault should have required fields', () => {
      for (const config of Object.values(drift_vaults)) {
        if (!config)
          continue

        // Required fields
        expect(config.vaultId).toBeDefined()
        expect(config.name).toBeTruthy()
        expect(typeof config.name).toBe('string')
        // subname is optional
        if (config.subname !== undefined) {
          expect(typeof config.subname).toBe('string')
        }
        expect(config.type).toBe(VaultType.Drift)
        expect(config.vaultAddress).toBeTruthy()
        expect(config.depositToken).toBeDefined()
        expect(typeof config.pfee).toBe('number')

        // pfee should be within valid range (0 to 1)
        expect(config.pfee).toBeGreaterThanOrEqual(0)
        expect(config.pfee).toBeLessThanOrEqual(1)

        // driftProgramId is optional (only jlpdnv1 has it)
        if (config.driftProgramId) {
          expect(typeof config.driftProgramId).toBe('string')
          expect(config.driftProgramId.length).toBeGreaterThanOrEqual(32)
        }
      }
    })

    it('drift vaults should NOT have bundleProgramId', () => {
      for (const config of Object.values(drift_vaults)) {
        if (!config)
          continue

        // Drift vaults shouldn't have bundleProgramId
        expect(config.bundleProgramId).toBeUndefined()
      }
    })

    it('drift vault addresses should be valid Solana addresses', () => {
      for (const config of Object.values(drift_vaults)) {
        if (!config)
          continue

        // Base58 addresses are typically 32-44 characters
        expect(config.vaultAddress.length).toBeGreaterThanOrEqual(32)
        expect(config.vaultAddress.length).toBeLessThanOrEqual(44)
      }
    })
  })

  describe('vault ID uniqueness', () => {
    it('bundle and drift vaults should not overlap', () => {
      const bundleIds = new Set(Object.keys(bundle_vaults).map(Number))
      const driftIds = new Set(Object.keys(drift_vaults).map(Number))

      for (const id of bundleIds) {
        expect(driftIds.has(id)).toBe(false)
      }
    })
  })
})
