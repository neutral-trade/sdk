import { describe, expect, it } from 'vitest'
import { BundleProgramId } from '../src/constants/programs'
import { getBundleProgramId, vaults } from '../src/constants/vaults'
import {
  SupportedChain,
  SupportedToken,
  tokens,
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

        expect([VaultType.Drift, VaultType.Bundle, VaultType.Hyperliquid, VaultType.Kamino]).toContain(config.type)
        expect(config.vaultAddress).toBeTruthy()
        expect(config.depositToken).toBeDefined()

        // pfee is optional but should be within valid range if present
        if (config.pfee !== undefined) {
          expect(config.pfee).toBeGreaterThanOrEqual(0)
          expect(config.pfee).toBeLessThanOrEqual(1)
        }
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

    it('vaultIds should be unique', () => {
      const vaultIds = Object.values(vaults).map(v => v.vaultId)
      const uniqueIds = new Set(vaultIds)
      expect(uniqueIds.size).toBe(vaultIds.length)
    })
  })

  describe('getBundleProgramId function', () => {
    it('should return V2 for vaultId 69 and 72', () => {
      expect(getBundleProgramId(69)).toBe(BundleProgramId.V2)
      expect(getBundleProgramId(72)).toBe(BundleProgramId.V2)
    })

    it('should return V1 for other bundle vaults', () => {
      expect(getBundleProgramId(48)).toBe(BundleProgramId.V1)
      expect(getBundleProgramId(60)).toBe(BundleProgramId.V1)
    })
  })
})
