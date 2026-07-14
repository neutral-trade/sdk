import { describe, expect, it } from 'vitest'
import {
  ALLOWLISTED_BUNDLE_PROGRAM_IDS_BY_CLUSTER,
  buildDepositInstructions,
  fetchBundle,
  getDefaultBundleProgramIdByCluster,
  getPointsVaults,
  getVaultByAddress,
  getVaultById,
  isValidVaultAddress,
  SupportedChain,
  SupportedToken,
  tokens,
  VaultId,
  vaults,
  VaultType,
} from '../src'

describe('sdk exports', () => {
  it('exports the registry surface', () => {
    const vault = getVaultById(1)

    expect(vaults).toBeDefined()
    expect(VaultId).toBeDefined()
    expect(vault).toBeDefined()
    expect(getVaultByAddress(vault!.vaultAddress)).toBe(vault)
    expect(isValidVaultAddress(vault!.vaultAddress)).toBe(true)
    expect(getPointsVaults(vaults).length).toBeGreaterThan(0)
  })

  it('exports program constants and token tables', () => {
    expect(ALLOWLISTED_BUNDLE_PROGRAM_IDS_BY_CLUSTER.mainnet).toContain(
      getDefaultBundleProgramIdByCluster('mainnet'),
    )
    expect(SupportedChain.Solana).toBe('Solana')
    expect(SupportedToken.USDC).toBe('USDC')
    expect(tokens[SupportedToken.USDC]).toBeDefined()
    expect(VaultType.Bundle).toBe('Bundle')
  })

  it('exports generated bindings and extension helpers', () => {
    expect(fetchBundle).toBeTypeOf('function')
    expect(buildDepositInstructions).toBeTypeOf('function')
  })
})
