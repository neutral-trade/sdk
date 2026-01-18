import { describe, expect, it } from 'vitest'
import {
  // Main class
  NeutralTrade,
  // Constants
  bundle_vaults,
  drift_vaults,
  BundleProgramId,
  // Types/Enums
  SupportedChain,
  SupportedToken,
  tokens,
  VaultId,
  VaultType,
  // Utilities
  deriveOraclePDA,
  deriveUserPDA,
  getVaultDepositorAddressSync,
} from '../src'

describe('SDK Exports', () => {
  describe('NeutralTrade class', () => {
    it('should export NeutralTrade class', () => {
      expect(NeutralTrade).toBeDefined()
      expect(typeof NeutralTrade).toBe('function') // class is a function
    })

    it('NeutralTrade should have create static method', () => {
      expect(NeutralTrade.create).toBeDefined()
      expect(typeof NeutralTrade.create).toBe('function')
    })
  })

  describe('Constants exports', () => {
    it('should export bundle_vaults', () => {
      expect(bundle_vaults).toBeDefined()
      expect(typeof bundle_vaults).toBe('object')
    })

    it('should export drift_vaults', () => {
      expect(drift_vaults).toBeDefined()
      expect(typeof drift_vaults).toBe('object')
    })

    it('should export BundleProgramId', () => {
      expect(BundleProgramId).toBeDefined()
      expect(BundleProgramId.V1).toBeDefined()
      expect(BundleProgramId.V2).toBeDefined()
    })
  })

  describe('Type/Enum exports', () => {
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

    it('should export VaultId enum', () => {
      expect(VaultId).toBeDefined()
      expect(typeof VaultId.jlpdnv1).toBe('number')
    })

    it('should export VaultType enum', () => {
      expect(VaultType).toBeDefined()
      expect(VaultType.Drift).toBe('Drift')
      expect(VaultType.Bundle).toBe('Bundle')
    })
  })

  describe('Utility function exports', () => {
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
