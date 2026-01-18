import { PublicKey } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { BundleProgramId } from '../src/constants/programs'
import {
  deriveOraclePDA,
  deriveUserPDA,
  getVaultDepositorAddressSync,
} from '../src/utils/pda'

describe('pda utility functions', () => {
  // Test constants
  const testBundlePDA = new PublicKey('nE1x7KQq2sm3GQrafQUUdBkSPPT52FmiMM9qAS1dgnC')
  const testUserKey = new PublicKey('HhVo8kHYr89vR1B1Z98ipbxXtmAKZ23EfETUbKyyFBtu')
  const testProgramId = new PublicKey(BundleProgramId.V1)

  describe('deriveOraclePDA', () => {
    it('should derive a valid Oracle PDA', () => {
      const oraclePDA = deriveOraclePDA(testBundlePDA, testProgramId)

      expect(oraclePDA).toBeInstanceOf(PublicKey)
      expect(PublicKey.isOnCurve(oraclePDA)).toBe(false) // PDAs are off-curve
    })

    it('should return deterministic results for same inputs', () => {
      const pda1 = deriveOraclePDA(testBundlePDA, testProgramId)
      const pda2 = deriveOraclePDA(testBundlePDA, testProgramId)

      expect(pda1.toBase58()).toBe(pda2.toBase58())
    })

    it('should return different PDAs for different bundle addresses', () => {
      const anotherBundlePDA = new PublicKey('5XNsfSeuB3SgknCHrbrv47UgcNNUMoG8CBzUJnwPcSej')
      const pda1 = deriveOraclePDA(testBundlePDA, testProgramId)
      const pda2 = deriveOraclePDA(anotherBundlePDA, testProgramId)

      expect(pda1.toBase58()).not.toBe(pda2.toBase58())
    })

    it('should return different PDAs for different program IDs', () => {
      const anotherProgramId = new PublicKey(BundleProgramId.V2)
      const pda1 = deriveOraclePDA(testBundlePDA, testProgramId)
      const pda2 = deriveOraclePDA(testBundlePDA, anotherProgramId)

      expect(pda1.toBase58()).not.toBe(pda2.toBase58())
    })
  })

  describe('deriveUserPDA', () => {
    it('should derive a valid User PDA', () => {
      const userPDA = deriveUserPDA(testUserKey, testBundlePDA, testProgramId)

      expect(userPDA).toBeInstanceOf(PublicKey)
      expect(PublicKey.isOnCurve(userPDA)).toBe(false) // PDAs are off-curve
    })

    it('should return deterministic results for same inputs', () => {
      const pda1 = deriveUserPDA(testUserKey, testBundlePDA, testProgramId)
      const pda2 = deriveUserPDA(testUserKey, testBundlePDA, testProgramId)

      expect(pda1.toBase58()).toBe(pda2.toBase58())
    })

    it('should return different PDAs for different users', () => {
      const anotherUserKey = new PublicKey('C77bxLHWjnAVeG9HdMxu1gunFnjRCcWUDZYfa7xbacHr')
      const pda1 = deriveUserPDA(testUserKey, testBundlePDA, testProgramId)
      const pda2 = deriveUserPDA(anotherUserKey, testBundlePDA, testProgramId)

      expect(pda1.toBase58()).not.toBe(pda2.toBase58())
    })

    it('should return different PDAs for different bundles', () => {
      const anotherBundlePDA = new PublicKey('5XNsfSeuB3SgknCHrbrv47UgcNNUMoG8CBzUJnwPcSej')
      const pda1 = deriveUserPDA(testUserKey, testBundlePDA, testProgramId)
      const pda2 = deriveUserPDA(testUserKey, anotherBundlePDA, testProgramId)

      expect(pda1.toBase58()).not.toBe(pda2.toBase58())
    })
  })

  describe('getVaultDepositorAddressSync', () => {
    const driftVaultProgramId = new PublicKey('vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR')
    const testVault = new PublicKey('bu2YJQZCcJzpUQZTine5rBZHwTNVWznGEMRnUHPTMRv')
    const testAuthority = new PublicKey('HhVo8kHYr89vR1B1Z98ipbxXtmAKZ23EfETUbKyyFBtu')

    it('should derive a valid Vault Depositor PDA for regular vault', () => {
      const depositorPDA = getVaultDepositorAddressSync(
        driftVaultProgramId,
        testVault,
        testAuthority,
      )

      expect(depositorPDA).toBeInstanceOf(PublicKey)
      expect(PublicKey.isOnCurve(depositorPDA)).toBe(false)
    })

    it('should return deterministic results for same inputs', () => {
      const pda1 = getVaultDepositorAddressSync(driftVaultProgramId, testVault, testAuthority)
      const pda2 = getVaultDepositorAddressSync(driftVaultProgramId, testVault, testAuthority)

      expect(pda1.toBase58()).toBe(pda2.toBase58())
    })

    it('should return different PDAs for different authorities', () => {
      const anotherAuthority = new PublicKey('C77bxLHWjnAVeG9HdMxu1gunFnjRCcWUDZYfa7xbacHr')
      const pda1 = getVaultDepositorAddressSync(driftVaultProgramId, testVault, testAuthority)
      const pda2 = getVaultDepositorAddressSync(driftVaultProgramId, testVault, anotherAuthority)

      expect(pda1.toBase58()).not.toBe(pda2.toBase58())
    })

    describe('jlpdnv1 special case', () => {
      // jlpdnv1 vault address that triggers special handling
      const jlpdnv1Vault = new PublicKey('3Nkctq19AW7gs5hkxixUDjS9UVjmCwcNCo7rqPpub87c')

      it('should use special program ID for jlpdnv1 vault', () => {
        const depositorPDA = getVaultDepositorAddressSync(
          driftVaultProgramId,
          jlpdnv1Vault,
          testAuthority,
        )

        expect(depositorPDA).toBeInstanceOf(PublicKey)
        expect(PublicKey.isOnCurve(depositorPDA)).toBe(false)
      })

      it('should return different PDA for jlpdnv1 vs regular vault with same authority', () => {
        const jlpdnv1Depositor = getVaultDepositorAddressSync(
          driftVaultProgramId,
          jlpdnv1Vault,
          testAuthority,
        )
        const regularDepositor = getVaultDepositorAddressSync(
          driftVaultProgramId,
          testVault,
          testAuthority,
        )

        expect(jlpdnv1Depositor.toBase58()).not.toBe(regularDepositor.toBase58())
      })

      it('should be deterministic for jlpdnv1 vault', () => {
        const pda1 = getVaultDepositorAddressSync(driftVaultProgramId, jlpdnv1Vault, testAuthority)
        const pda2 = getVaultDepositorAddressSync(driftVaultProgramId, jlpdnv1Vault, testAuthority)

        expect(pda1.toBase58()).toBe(pda2.toBase58())
      })
    })
  })
})
