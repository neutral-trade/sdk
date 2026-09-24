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
import { VaultId } from '../src/constants/vault-ids'
import { DevnetVaultId } from '../src/constants/vault-ids.devnet'
import {
  getBundleProgramId,
  getDriftProgramId,
  getVaultByAddress,
  getVaultById,
  getVaultRegistry,
  isValidVaultAddress,
  toVaultConfig,
  toVaultRegistry,
  vaults,
  vaultsDevnet,
} from '../src/constants/vaults'
import {
  ETHEREUM_CHAIN_ID,
  getSolanaTokenDecimals,
  getSolanaTokenMint,
  MONAD_CHAIN_ID,
  MONAD_TESTNET_CHAIN_ID,
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
      expect(SupportedToken.AUSD).toBe('AUSD')
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

  describe('monad testnet chain', () => {
    it('exposes chain enum member and chain id', () => {
      expect(SupportedChain.MonadTestnet).toBe('MonadTestnet')
      expect(MONAD_TESTNET_CHAIN_ID).toBe(10143)
    })

    it('aUSD is 6 decimals on Monad Testnet, not the 18 the guide claims', () => {
      const ausd = tokens[SupportedToken.AUSD].onChain[SupportedChain.MonadTestnet]
      expect(ausd?.address).toBe('0x333a12e2B519DA16EBE75012d54574C16ef4463f')
      expect(ausd?.decimals).toBe(6)
    })

    it('aUSD has no Solana deployment', () => {
      expect(tokens[SupportedToken.AUSD].onChain[SupportedChain.Solana]).toBeNull()
      expect(() => getSolanaTokenMint(SupportedToken.AUSD)).toThrow()
    })
  })

  describe('ethereum and monad mainnet chains', () => {
    it('expose chain enum members and chain ids', () => {
      expect(SupportedChain.Ethereum).toBe('Ethereum')
      expect(ETHEREUM_CHAIN_ID).toBe(1)
      expect(SupportedChain.Monad).toBe('Monad')
      expect(MONAD_CHAIN_ID).toBe(143)
    })

    it('uSDC is 6 decimals on both', () => {
      const eth = tokens[SupportedToken.USDC].onChain[SupportedChain.Ethereum]
      expect(eth?.address).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      expect(eth?.decimals).toBe(6)
      const monad = tokens[SupportedToken.USDC].onChain[SupportedChain.Monad]
      expect(monad?.address).toBe('0x754704Bc059F8C67012fEd69BC8A327a5aafb603')
      expect(monad?.decimals).toBe(6)
    })

    it('other tokens have no Ethereum or Monad deployment', () => {
      expect(tokens[SupportedToken.USDE].onChain[SupportedChain.Ethereum]).toBeNull()
      expect(tokens[SupportedToken.AUSD].onChain[SupportedChain.Monad]).toBeNull()
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

    it('rejects a truncated EVM vaultAddress', () => {
      expect(() =>
        VaultRegistryEntrySchema.parse({ ...accountableEntry, vaultAddress: '0x11111111111111111111111111111111111111' }),
      ).toThrow()
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

  describe('accountable NAV registry entries', () => {
    it('mainnet 81 is the Robinhood MLP vault with all three identities', () => {
      const mlp = getVaultById(VaultId.meridian_liquidity_provider_81, 'mainnet')!
      expect(mlp.type).toBe(VaultType.AccountableNav)
      expect(mlp.chain).toBe(SupportedChain.Robinhood)
      expect(mlp.name).toBe('Meridian Liquidity Provider')
      expect(mlp.depositToken).toBe(SupportedToken.USDE)
      // ERC-4626 transaction target
      expect(mlp.vaultAddress).toBe('0x24b84023c8e4Da635be228C380C09bfE5271BF9d')
      // loan contract (navGraceDeadline / VOA) -- NOT the ERC-4626 address
      expect(mlp.strategyAddress).toBe('0xF62c201e9A28F6A57C4262004dd2e8B8e95bB1eC')
      // API-only id -- never an address, never a Neutral vaultId
      expect(mlp.accountableLoanId).toBe(607290214)
    })

    it('mainnet 85 / 86 are Neutral Trade Autopilot on Ethereum and Monad', () => {
      const eth = getVaultById(VaultId.neutral_trade_autopilot_ethereum_85, 'mainnet')!
      expect(eth.type).toBe(VaultType.AccountableNav)
      expect(eth.chain).toBe(SupportedChain.Ethereum)
      expect(eth.depositToken).toBe(SupportedToken.USDC)
      expect(eth.vaultAddress).toBe('0x909dAdBcA7955614A455d9e7447aD4adB4902C8E')
      expect(eth.strategyAddress).toBe('0x56B935Fe5183cC0DE489233d032F9A4B8ec2f9Ff')
      expect(eth.accountableLoanId).toBe(608250934)

      const monad = getVaultById(VaultId.neutral_trade_autopilot_monad_86, 'mainnet')!
      expect(monad.type).toBe(VaultType.AccountableNav)
      expect(monad.chain).toBe(SupportedChain.Monad)
      expect(monad.depositToken).toBe(SupportedToken.USDC)
      expect(monad.vaultAddress).toBe('0xaABab7598be3c4fE58c593e73C2F5934b73b573E')
      expect(monad.strategyAddress).toBe('0x5ee57E42DF67e5707F0CAE1a18DfeaDB4F0Df86c')
      expect(monad.accountableLoanId).toBe(608250958)
    })

    it('devnet staging vault lives on Monad Testnet and takes AUSD', () => {
      const staging = getVaultById(DevnetVaultId.meridian_liquidity_provider_nt_100000010, 'devnet')!
      expect(staging.type).toBe(VaultType.AccountableNav)
      expect(staging.chain).toBe(SupportedChain.MonadTestnet)
      expect(staging.name).toBe('Meridian Liquidity Provider(NT)')
      expect(staging.depositToken).toBe(SupportedToken.AUSD)
      expect(staging.vaultAddress).toBe('0x22767B5c9C5472A2784e31Acb95dF599338662d9')
      expect(staging.strategyAddress).toBe('0xD327a1584d34Bc7381C16D056B6951fC7A9587d7')
      expect(staging.accountableLoanId).toBe(609080863)
    })

    it('the three identities are all distinct on every Accountable entry', () => {
      const entries = [...Object.values(vaults), ...Object.values(vaultsDevnet)]
        .filter(v => v.type === VaultType.AccountableNav)
      expect(entries.length).toBeGreaterThan(0)
      for (const v of entries) {
        expect(v.strategyAddress).toBeDefined()
        expect(v.accountableLoanId).toBeDefined()
        expect(v.vaultAddress.toLowerCase()).not.toBe(v.strategyAddress!.toLowerCase())
        expect(v.accountableLoanId).not.toBe(v.vaultId)
      }
    })

    it('resolves chain to Solana on entries that omit it', () => {
      expect(getVaultById(VaultId.master_bundle_76, 'mainnet')!.chain).toBe(SupportedChain.Solana)
      expect(getVaultById(DevnetVaultId.bundle_1_100000002, 'devnet')!.chain).toBe(SupportedChain.Solana)
    })

    it('looks up EVM vaults regardless of address casing', () => {
      const mlp = getVaultById(VaultId.meridian_liquidity_provider_81, 'mainnet')!
      expect(getVaultByAddress(mlp.vaultAddress.toLowerCase())?.vaultId).toBe(mlp.vaultId)
      expect(isValidVaultAddress(mlp.vaultAddress.toUpperCase().replace('0X', '0x'))).toBe(true)
    })

    it('base58 vault lookups stay case-sensitive', () => {
      const bundle = Object.values(vaults).find(v => v.chain === SupportedChain.Solana)!
      expect(isValidVaultAddress(bundle.vaultAddress)).toBe(true)
      expect(isValidVaultAddress(bundle.vaultAddress.toLowerCase())).toBe(false)
    })

    it('bundle/Drift helpers skip the real Accountable entries too', () => {
      const accountable = [
        getVaultById(VaultId.meridian_liquidity_provider_81, 'mainnet')!,
        getVaultById(DevnetVaultId.meridian_liquidity_provider_nt_100000010, 'devnet')!,
      ]
      for (const v of accountable) {
        expect(getBundleProgramId(v, 'mainnet')).toBeUndefined()
        expect(getDriftProgramId(v)).toBeUndefined()
        expect(v.bundleProgramId).toBeUndefined()
        expect(v.driftProgramId).toBeUndefined()
      }
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
        if (config.chain !== SupportedChain.Solana) {
          expect(config.vaultAddress).toMatch(/^0x[0-9a-f]{40}$/i)
          continue
        }
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
