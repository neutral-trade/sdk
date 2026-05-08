import { describe, expect, it } from 'vitest'
import {
  BUNDLE_PROGRAM_ID_V2_MAINNET,
  // Constants
  DEFAULT_BUNDLE_PROGRAM_ID_DEVNET,
  DEFAULT_BUNDLE_PROGRAM_ID_MAINNET,
  // Utilities
  deriveOraclePDA,
  derivePendingAuthPDA,
  deriveTempDataPDA,
  deriveUserPDA,
  getDefaultBundleProgramIdByCluster,
  getVaultByAddress,
  getVaultById,
  getVaultDepositorAddressSync,
  isValidVaultAddress,
  // Main class
  NeutralTrade,
  // Types/Enums
  SupportedChain,
  SupportedToken,
  tokens,
  vaults,
  VaultType,
} from '../src'

describe('sDK Exports', () => {
  describe('neutralTrade class', () => {
    it('should export NeutralTrade class', () => {
      expect(NeutralTrade).toBeDefined()
      expect(typeof NeutralTrade).toBe('function') // class is a function
    })

    it('neutralTrade should have create static method', () => {
      expect(NeutralTrade.create).toBeDefined()
      expect(typeof NeutralTrade.create).toBe('function')
    })
  })

  describe('constants exports', () => {
    it('should export vaults', () => {
      expect(vaults).toBeDefined()
      expect(typeof vaults).toBe('object')
    })

    it('should export vault utility functions', () => {
      expect(getVaultByAddress).toBeDefined()
      expect(typeof getVaultByAddress).toBe('function')
      expect(getVaultById).toBeDefined()
      expect(typeof getVaultById).toBe('function')
      expect(isValidVaultAddress).toBeDefined()
      expect(typeof isValidVaultAddress).toBe('function')
    })

    it('should export default bundle program IDs', () => {
      expect(DEFAULT_BUNDLE_PROGRAM_ID_MAINNET).toBeDefined()
      expect(DEFAULT_BUNDLE_PROGRAM_ID_DEVNET).toBeDefined()
      expect(BUNDLE_PROGRAM_ID_V2_MAINNET).toBeDefined()
      expect(BUNDLE_PROGRAM_ID_V2_MAINNET).not.toBe(DEFAULT_BUNDLE_PROGRAM_ID_MAINNET)
      expect(getDefaultBundleProgramIdByCluster).toBeDefined()
    })

    it('should export bundle PDA helpers', () => {
      expect(deriveTempDataPDA).toBeDefined()
      expect(derivePendingAuthPDA).toBeDefined()
    })
  })

  describe('type/Enum exports', () => {
    it('should export SupportedChain enum', () => {
      expect(SupportedChain).toBeDefined()
      expect(SupportedChain.Solana).toBe('Solana')
    })

    it('should export SupportedToken enum', () => {
      expect(SupportedToken).toBeDefined()
      expect(SupportedToken.USDC).toBe('USDC')
    })

    it('should export tokens object', () => {
      expect(tokens).toBeDefined()
      expect(tokens[SupportedToken.USDC]).toBeDefined()
    })

    it('should export VaultType enum', () => {
      expect(VaultType).toBeDefined()
      expect(VaultType.Drift).toBe('Drift')
      expect(VaultType.Bundle).toBe('Bundle')
    })

    it('vaults should use numeric keys', () => {
      const vaultKeys = Object.keys(vaults)
      expect(vaultKeys.length).toBeGreaterThan(0)
      // All keys should be numeric strings
      vaultKeys.forEach((key) => {
        expect(Number.isNaN(Number(key))).toBe(false)
      })
    })
  })

  describe('utility function exports', () => {
    it('should export deriveOraclePDA', () => {
      expect(deriveOraclePDA).toBeDefined()
      expect(typeof deriveOraclePDA).toBe('function')
    })

    it('should export deriveUserPDA', () => {
      expect(deriveUserPDA).toBeDefined()
      expect(typeof deriveUserPDA).toBe('function')
    })

    it('should export getVaultDepositorAddressSync', () => {
      expect(getVaultDepositorAddressSync).toBeDefined()
      expect(typeof getVaultDepositorAddressSync).toBe('function')
    })
  })
})
