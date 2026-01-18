// NeutralTrade - Main SDK class

import type { Program } from '@coral-xyz/anchor'
import type { Program as Program32 } from '@coral-xyz/anchor-32'
import type { DriftVaults } from '@drift-labs/vaults-sdk'
import type { Connection } from '@solana/web3.js'
import type { NtbundleV1 } from './idl/bundle-v1'
import type { NtbundleV2 } from './idl/bundle-v2'
import type { UserBalanceResult, VaultBalanceData, VaultConfig, VaultId } from './types'
import { BulkAccountLoader, DriftClient } from '@drift-labs/sdk'
import { IDL, VAULT_PROGRAM_ID, VaultClient } from '@drift-labs/vaults-sdk'
import { PublicKey } from '@solana/web3.js'
import { calculateBundleUserBalance } from './bundle/balance'
import { bundle_vaults } from './constants/bundle-vaults'
import { createAnchorProviderV29, createAnchorProviderV32, createConnection, createDummyWallet } from './constants/client'
import { drift_vaults } from './constants/drift-vaults'
import { BundleProgramId, createBundleProgramV1, createBundleProgramV2 } from './constants/programs'
import { calculateDriftVaultBalance } from './drift/balance'
import { tokens, VaultType } from './types'
import { deriveOraclePDA, deriveUserPDA, getVaultDepositorAddressSync } from './utils/pda'

export interface NeutralTradeConfig {
  rpcUrl: string
}

export class NeutralTrade {
  public readonly connection: Connection
  public readonly bundleProgramV1: Program<NtbundleV1>
  public readonly bundleProgramV2: Program32<NtbundleV2>
  public readonly driftVaultClient: VaultClient

  private constructor(
    connection: Connection,
    bundleProgramV1: Program<NtbundleV1>,
    bundleProgramV2: Program32<NtbundleV2>,
    driftVaultClient: VaultClient,
  ) {
    this.connection = connection
    this.bundleProgramV1 = bundleProgramV1
    this.bundleProgramV2 = bundleProgramV2
    this.driftVaultClient = driftVaultClient
  }

  /**
   * Create a new NeutralTrade instance
   * This is async because DriftClient needs to subscribe
   */
  static async create(config: NeutralTradeConfig): Promise<NeutralTrade> {
    const connection = createConnection(config.rpcUrl)
    const dummyWallet = createDummyWallet()

    // Create Anchor providers
    const providerV29 = createAnchorProviderV29(connection)
    const providerV32 = createAnchorProviderV32(connection)

    // Create Bundle programs
    const bundleProgramV1 = createBundleProgramV1(providerV29)
    const bundleProgramV2 = createBundleProgramV2(providerV32)

    // Create Drift client and subscribe
    const accountLoader = new BulkAccountLoader(connection, 'confirmed', 0)
    const driftClient = new DriftClient({
      connection,
      wallet: dummyWallet,
      env: 'mainnet-beta',
      opts: {
        commitment: 'confirmed',
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
      accountSubscription: {
        type: 'polling',
        accountLoader,
      },
    })

    // Subscribe to Drift client (one-time)
    await driftClient.subscribe()

    // Create Drift vault client
    const vaultProgram = new (await import('@coral-xyz/anchor')).Program<DriftVaults>(
      IDL,
      VAULT_PROGRAM_ID,
      providerV29,
    )

    const driftVaultClient = new VaultClient({
      driftClient,
      program: vaultProgram,
      cliMode: false,
    })

    return new NeutralTrade(connection, bundleProgramV1, bundleProgramV2, driftVaultClient)
  }

  /**
   * Get user balance for multiple vaults (both Drift and Bundle)
   */
  async getUserBalanceByVaultIds({
    vaultIds,
    userAddress,
    usdcPrice,
  }: {
    vaultIds: VaultId[]
    userAddress: string
    /** Optional USDC price for bundle vaults. Defaults to 1 if not provided. */
    usdcPrice?: number
  }): Promise<UserBalanceResult> {
    // Separate drift and bundle vault IDs
    const driftVaultIds = vaultIds.filter((id) => {
      const config = drift_vaults[id]
      return config && config.type === VaultType.Drift
    })

    const bundleVaultIds = vaultIds.filter((id) => {
      const config = bundle_vaults[id]
      return config && config.type === VaultType.Bundle
    })

    // Fetch in parallel
    const [driftResults, bundleResults] = await Promise.all([
      driftVaultIds.length > 0 ? this.getDriftBalances(driftVaultIds, userAddress) : {},
      bundleVaultIds.length > 0 ? this.getBundleBalances(bundleVaultIds, userAddress, usdcPrice) : {},
    ])

    return {
      ...driftResults,
      ...bundleResults,
    } as UserBalanceResult
  }

  /**
   * Get Drift vault balances using fetchMultiple
   */
  private async getDriftBalances(
    vaultIds: VaultId[],
    userAddress: string,
  ): Promise<Record<VaultId, VaultBalanceData | null>> {
    const result: Record<VaultId, VaultBalanceData | null> = {} as Record<VaultId, VaultBalanceData | null>
    const userPublicKey = new PublicKey(userAddress)

    // Get all vault configs
    const vaultConfigs = vaultIds.map(id => drift_vaults[id]!).filter(Boolean)

    if (vaultConfigs.length === 0) {
      return result
    }

    // Prepare vault addresses and depositor PDAs
    const vaultAddresses = vaultConfigs.map(c => new PublicKey(c.vaultAddress))

    const vaultDepositorPDAs = vaultConfigs.map((c) => {
      const vaultPubkey = new PublicKey(c.vaultAddress)
      const programId = c.driftProgramId
        ? new PublicKey(c.driftProgramId)
        : VAULT_PROGRAM_ID
      return getVaultDepositorAddressSync(programId, vaultPubkey, userPublicKey)
    })

    // Fetch all vaults and depositors using fetchMultiple
    const [vaults, vaultDepositors] = await Promise.all([
      this.driftVaultClient.program.account.vault.fetchMultiple(vaultAddresses),
      this.driftVaultClient.program.account.vaultDepositor.fetchMultiple(vaultDepositorPDAs),
    ])

    // Calculate balance for each vault
    for (let i = 0; i < vaultIds.length; i++) {
      const vaultId = vaultIds[i]
      const config = vaultConfigs[i]
      const vault = vaults[i]
      const vaultDepositor = vaultDepositors[i]

      if (!vault || !vaultDepositor) {
        result[vaultId] = null
        continue
      }

      try {
        result[vaultId] = await calculateDriftVaultBalance({
          vault,
          vaultDepositor,
          driftVaultClient: this.driftVaultClient,
          profitShareFeePercent: (config.pfee ?? 0) * 100,
          asset: config.depositToken,
        })
      }
      catch (e) {
        console.error(`Error calculating balance for drift vault ${vaultId}:`, e)
        result[vaultId] = null
      }
    }

    return result
  }

  /**
   * Get Bundle vault balances using fetchMultiple (with on-chain PPS)
   */
  private async getBundleBalances(
    vaultIds: VaultId[],
    userAddress: string,
    usdcPrice: number = 1,
  ): Promise<Record<VaultId, VaultBalanceData | null>> {
    const result: Record<VaultId, VaultBalanceData | null> = {} as Record<VaultId, VaultBalanceData | null>
    const userPublicKey = new PublicKey(userAddress)

    // Group vaults by program version
    const v1Vaults: { vaultId: VaultId, config: VaultConfig }[] = []
    const v2Vaults: { vaultId: VaultId, config: VaultConfig }[] = []

    for (const vaultId of vaultIds) {
      const config = bundle_vaults[vaultId]
      if (!config)
        continue

      if (config.bundleProgramId === BundleProgramId.V2) {
        v2Vaults.push({ vaultId, config })
      }
      else {
        v1Vaults.push({ vaultId, config })
      }
    }

    // Process V1 vaults
    if (v1Vaults.length > 0) {
      const v1BundlePDAs = v1Vaults.map(({ config }) => new PublicKey(config.vaultAddress))
      const v1OraclePDAs = v1BundlePDAs.map(bundlePDA =>
        deriveOraclePDA(bundlePDA, this.bundleProgramV1.programId),
      )
      const v1UserPDAs = v1BundlePDAs.map(bundlePDA =>
        deriveUserPDA(userPublicKey, bundlePDA, this.bundleProgramV1.programId),
      )

      // Fetch all accounts using fetchMultiple (3 calls instead of 3*N calls)
      const [v1Bundles, v1Oracles, v1Users] = await Promise.all([
        this.bundleProgramV1.account.bundle.fetchMultiple(v1BundlePDAs),
        this.bundleProgramV1.account.oracleData.fetchMultiple(v1OraclePDAs),
        this.bundleProgramV1.account.userBundleAccount.fetchMultiple(v1UserPDAs),
      ])

      for (let i = 0; i < v1Vaults.length; i++) {
        const { vaultId, config } = v1Vaults[i]
        const bundle = v1Bundles[i]
        const oracle = v1Oracles[i]
        const userBundle = v1Users[i]

        if (!bundle || !oracle || !userBundle) {
          result[vaultId] = null
          continue
        }

        const assetKey = config.depositToken as keyof typeof tokens
        const assetDecimals = tokens[assetKey]?.onChain?.Solana?.decimals || 6

        result[vaultId] = calculateBundleUserBalance({
          oracleData: oracle,
          bundleData: bundle,
          userBundle,
          assetDecimals,
          spotPrice: usdcPrice,
          asset: config.depositToken,
        })
      }
    }

    // Process V2 vaults
    if (v2Vaults.length > 0) {
      const v2BundlePDAs = v2Vaults.map(({ config }) => new PublicKey(config.vaultAddress))
      const v2OraclePDAs = v2BundlePDAs.map(bundlePDA =>
        deriveOraclePDA(bundlePDA, this.bundleProgramV2.programId),
      )
      const v2UserPDAs = v2BundlePDAs.map(bundlePDA =>
        deriveUserPDA(userPublicKey, bundlePDA, this.bundleProgramV2.programId),
      )

      // Fetch all accounts using fetchMultiple
      const [v2Bundles, v2Oracles, v2Users] = await Promise.all([
        this.bundleProgramV2.account.bundle.fetchMultiple(v2BundlePDAs),
        this.bundleProgramV2.account.oracleData.fetchMultiple(v2OraclePDAs),
        this.bundleProgramV2.account.userBundleAccount.fetchMultiple(v2UserPDAs),
      ])

      for (let i = 0; i < v2Vaults.length; i++) {
        const { vaultId, config } = v2Vaults[i]
        const bundle = v2Bundles[i]
        const oracle = v2Oracles[i]
        const userBundle = v2Users[i]

        if (!bundle || !oracle || !userBundle) {
          result[vaultId] = null
          continue
        }

        const assetKey = config.depositToken as keyof typeof tokens
        const assetDecimals = tokens[assetKey]?.onChain?.Solana?.decimals || 6

        result[vaultId] = calculateBundleUserBalance({
          oracleData: oracle,
          bundleData: bundle,
          userBundle,
          assetDecimals,
          spotPrice: usdcPrice,
          asset: config.depositToken,
        })
      }
    }

    return result
  }
}
