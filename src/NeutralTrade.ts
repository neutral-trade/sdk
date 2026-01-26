// NeutralTrade - Main SDK class

import type { Program } from '@coral-xyz/anchor'
import type { Program as Program32 } from '@coral-xyz/anchor-32'
import type { DriftVaults } from '@drift-labs/vaults-sdk'
import type { Connection } from '@solana/web3.js'
import type { NtbundleV1 } from './idl/bundle-v1'
import type { NtbundleV2 } from './idl/bundle-v2'
import type { SupportedToken, UserBalanceResult, VaultConfig, VaultId } from './types'
import { BulkAccountLoader, DriftClient } from '@drift-labs/sdk'
import { IDL, VAULT_PROGRAM_ID, VaultClient } from '@drift-labs/vaults-sdk'
import { createAnchorProviderV29, createAnchorProviderV32, createConnection, createDummyWallet } from './constants/client'
import { createBundleProgramV1, createBundleProgramV2 } from './constants/programs'
import { vaults as builtInVaults } from './constants/vaults'
import { VaultRegistrySchema, VaultType } from './types'
import { getBundleBalances } from './utils/bundle'
import { getDriftBalances } from './utils/drift'
import { initializePrices } from './utils/price'

export interface NeutralTradeConfig {
  rpcUrl: string
  /** Optional registry URL to fetch vault configurations from. If provided, fetched vaults will override built-in vaults. */
  registryUrl?: string
  /** Optional fallback prices map. Prices are fetched from Pyth Network first; fallback is used only if Pyth returns incomplete data */
  fallbackPrices?: Partial<Record<SupportedToken, number>>
}

export class NeutralTrade {
  public readonly connection: Connection
  public readonly bundleProgramV1: Program<NtbundleV1>
  public readonly bundleProgramV2: Program32<NtbundleV2>
  public readonly driftVaultClient: VaultClient
  /** Vault configurations (built-in merged with remote if registryUrl was provided) */
  public readonly vaults: Partial<Record<VaultId, VaultConfig>>
  /** Price map for deposit tokens */
  public readonly priceMap: Map<SupportedToken, number>

  private constructor(
    connection: Connection,
    bundleProgramV1: Program<NtbundleV1>,
    bundleProgramV2: Program32<NtbundleV2>,
    driftVaultClient: VaultClient,
    vaults: Partial<Record<VaultId, VaultConfig>>,
    priceMap: Map<SupportedToken, number>,
  ) {
    this.connection = connection
    this.bundleProgramV1 = bundleProgramV1
    this.bundleProgramV2 = bundleProgramV2
    this.driftVaultClient = driftVaultClient
    this.vaults = vaults
    this.priceMap = priceMap
  }

  /**
   * Create a new NeutralTrade instance
   * This is async because DriftClient needs to subscribe
   * @throws Error if registryUrl is provided but fetch fails or validation fails
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

    // Fetch and merge vaults from registry if URL is provided
    let vaults: Partial<Record<VaultId, VaultConfig>> = { ...builtInVaults }

    if (config.registryUrl) {
      const remoteVaults = await NeutralTrade.fetchVaultsFromRegistry(config.registryUrl)
      // Remote vaults override built-in vaults
      vaults = { ...builtInVaults, ...remoteVaults }
    }

    // Initialize prices
    const priceMap = await initializePrices(vaults, config.fallbackPrices)

    return new NeutralTrade(connection, bundleProgramV1, bundleProgramV2, driftVaultClient, vaults, priceMap)
  }

  /**
   * Fetch vault configurations from a remote registry URL
   * @throws Error if fetch fails or validation fails
   */
  private static async fetchVaultsFromRegistry(
    registryUrl: string,
  ): Promise<Partial<Record<VaultId, VaultConfig>>> {
    const response = await fetch(registryUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch vaults from registry: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Validate with zod schema
    const parseResult = VaultRegistrySchema.safeParse(data)

    if (!parseResult.success) {
      throw new Error(`Invalid vault registry data: ${parseResult.error.message}`)
    }

    // Convert string keys to VaultId numbers
    const vaults: Partial<Record<VaultId, VaultConfig>> = {}
    for (const [key, value] of Object.entries(parseResult.data)) {
      const vaultId = Number.parseInt(key, 10) as VaultId
      vaults[vaultId] = value as VaultConfig
    }

    return vaults
  }

  /**
   * Get user balance for multiple vaults (both Drift and Bundle)
   */
  async getUserBalanceByVaultIds({
    vaultIds,
    userAddress,
  }: {
    vaultIds: VaultId[]
    userAddress: string
  }): Promise<UserBalanceResult> {
    // Separate drift and bundle vault IDs
    const driftVaultIds = vaultIds.filter((id) => {
      const config = this.vaults[id]
      return config && config.type === VaultType.Drift
    })

    const bundleVaultIds = vaultIds.filter((id) => {
      const config = this.vaults[id]
      return config && config.type === VaultType.Bundle
    })

    // Fetch in parallel
    const [driftResults, bundleResults] = await Promise.all([
      driftVaultIds.length > 0
        ? getDriftBalances({
            vaultIds: driftVaultIds,
            userAddress,
            vaults: this.vaults,
            driftVaultClient: this.driftVaultClient,
          })
        : {},
      bundleVaultIds.length > 0
        ? getBundleBalances({
            vaultIds: bundleVaultIds,
            userAddress,
            vaults: this.vaults,
            bundleProgramV1: this.bundleProgramV1,
            bundleProgramV2: this.bundleProgramV2,
            priceMap: this.priceMap,
          })
        : {},
    ])

    return {
      ...driftResults,
      ...bundleResults,
    } as UserBalanceResult
  }
}
