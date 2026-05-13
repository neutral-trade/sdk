// NeutralTrade - Main SDK class (Bundle vault balances only; Drift is not included in this package.)

import type { Program } from '@coral-xyz/anchor'
import type { Connection, TransactionInstruction } from '@solana/web3.js'
import type { BundleCluster } from './constants/programs'
import type { Ntbundle } from './idl/ntbundle'
import type { SupportedToken, UserBalanceResult, VaultRegistry, VaultRegistryEntry } from './types'
import { PublicKey } from '@solana/web3.js'
import { createAnchorProvider, createConnection } from './constants/client'
import { createBundleProgramById } from './constants/programs'
import { getBundleProgramId, getVaultRegistry, toVaultRegistry } from './constants/vaults'
import { VaultRegistryArraySchema, VaultType } from './types'
import { getBundleBalances } from './utils/bundle'
import {
  buildBundleDepositInstructions,
  buildBundleRequestWithdrawInstruction,
} from './utils/bundle-instructions'
import { initializePrices } from './utils/price'

export interface NeutralTradeConfig {
  rpcUrl: string
  /** Bundle program cluster selector. Defaults to 'mainnet'. */
  bundleCluster?: BundleCluster
  /** If true, include built-in vault registry for `bundleCluster` (mainnet vs devnet fixtures). Defaults to true. */
  includeBuiltInVaults?: boolean
  /** Optional local registry entries. Applied after built-in configs and before registryUrl (if provided). */
  registry?: VaultRegistryEntry[]
  /** Optional registry URL to fetch vault configurations from. If provided, fetched vaults override merged built-in/local entries. */
  registryUrl?: string
  /** Optional fallback prices map. Prices are fetched from Pyth Network first; fallback is used only if Pyth returns incomplete data */
  fallbackPrices?: Partial<Record<SupportedToken, number>>
}

export interface NeutralTradeCoreContext {
  connection: Connection
  bundlePrograms: Record<string, Program<Ntbundle>>
  vaults: VaultRegistry
  priceMap: Map<SupportedToken, number>
}

export class NeutralTrade {
  public readonly connection: Connection
  public readonly bundlePrograms: Record<string, Program<Ntbundle>>
  public readonly bundleCluster: BundleCluster
  /** Vault configurations after merge order: built-in (cluster-specific) < local registry < registryUrl */
  public readonly vaults: VaultRegistry
  /** Price map for deposit tokens */
  public readonly priceMap: Map<SupportedToken, number>

  protected constructor(
    connection: Connection,
    bundlePrograms: Record<string, Program<Ntbundle>>,
    bundleCluster: BundleCluster,
    vaults: VaultRegistry,
    priceMap: Map<SupportedToken, number>,
  ) {
    this.connection = connection
    this.bundlePrograms = bundlePrograms
    this.bundleCluster = bundleCluster
    this.vaults = vaults
    this.priceMap = priceMap
  }

  /**
   * Create a new NeutralTrade instance
   * Merge order: built-in catalog for `bundleCluster` (when allowed) < local registry < registryUrl
   * @throws Error if registry or registryUrl validation fails (or fetch fails for registryUrl)
   */
  protected static async initCore(config: NeutralTradeConfig): Promise<NeutralTradeCoreContext> {
    const connection = createConnection(config.rpcUrl)

    const provider = createAnchorProvider(connection)

    const cluster = config.bundleCluster ?? 'mainnet'

    const shouldUseBuiltInVaults = config.includeBuiltInVaults !== false
    let vaults: VaultRegistry = shouldUseBuiltInVaults ? { ...getVaultRegistry(cluster) } : {}

    if (config.registry) {
      const localVaults = NeutralTrade.parseVaultRegistryEntries(
        config.registry,
        'registry',
        cluster,
      )
      vaults = { ...vaults, ...localVaults }
    }

    if (config.registryUrl) {
      const remoteVaults = await NeutralTrade.fetchVaultsFromRegistry(config.registryUrl, cluster)
      vaults = { ...vaults, ...remoteVaults }
    }

    const programIds = new Set<string>()
    for (const vault of Object.values(vaults)) {
      const programId = getBundleProgramId(vault, cluster)
      if (programId) {
        programIds.add(programId)
      }
    }

    const bundlePrograms: Record<string, Program<Ntbundle>> = {}
    for (const programId of programIds) {
      bundlePrograms[programId] = createBundleProgramById(provider, programId)
    }

    // Initialize prices
    const priceMap = await initializePrices(config.fallbackPrices)

    return {
      connection,
      bundlePrograms,
      vaults,
      priceMap,
    }
  }

  static async create(config: NeutralTradeConfig): Promise<NeutralTrade> {
    const core = await this.initCore(config)
    return new NeutralTrade(
      core.connection,
      core.bundlePrograms,
      config.bundleCluster ?? 'mainnet',
      core.vaults,
      core.priceMap,
    )
  }

  private getBundleProgramForVault(vault: VaultRegistryEntry): Program<Ntbundle> {
    const programId = getBundleProgramId(vault, this.bundleCluster)
    if (!programId) {
      throw new Error(`Vault ${vault.vaultId} has no Bundle program id`)
    }
    const bundleProgram = this.bundlePrograms[programId]
    if (!bundleProgram) {
      throw new Error(
        `Bundle program client not initialized for vault ${vault.vaultId}: ${programId}. Please add it to bundlePrograms config or registry.`,
      )
    }
    return bundleProgram
  }

  private static parseVaultRegistryEntries(
    entries: unknown,
    sourceLabel: string,
    cluster: BundleCluster,
  ): VaultRegistry {
    const parseResult = VaultRegistryArraySchema.safeParse(entries)
    if (!parseResult.success) {
      throw new Error(`Invalid ${sourceLabel} data: ${parseResult.error.message}`)
    }
    return toVaultRegistry(parseResult.data, cluster)
  }

  /**
   * Fetch vault configurations from a remote registry URL
   * Expects JSON array format and transforms to Record<number, VaultConfig>
   * @throws Error if fetch fails or validation fails
   */
  private static async fetchVaultsFromRegistry(
    registryUrl: string,
    cluster: BundleCluster,
  ): Promise<VaultRegistry> {
    const response = await fetch(registryUrl)

    if (!response.ok) {
      throw new Error(
        `Failed to fetch vaults from registry: ${response.status} ${response.statusText}`,
      )
    }

    const data = await response.json()

    return NeutralTrade.parseVaultRegistryEntries(data, 'vault registry', cluster)
  }

  /**
   * Get user balance for Bundle vaults only.
   * Drift vault IDs are ignored (no keys in the result).
   */
  async getUserBalanceByVaultIds({
    vaultIds,
    userAddress,
  }: {
    vaultIds: number[]
    userAddress: string
  }): Promise<UserBalanceResult> {
    const bundleVaultIds = vaultIds.filter((id) => {
      const config = this.vaults[id]
      return config && config.type === VaultType.Bundle
    })

    if (bundleVaultIds.length === 0) {
      return {} as UserBalanceResult
    }

    return await getBundleBalances({
      vaultIds: bundleVaultIds,
      userAddress,
      vaults: this.vaults,
      bundlePrograms: this.bundlePrograms,
      bundleCluster: this.bundleCluster,
      priceMap: this.priceMap,
    })
  }

  /**
   * Build deposit instructions (`initializeBundleDepositor` when needed, then `requestDeposit`).
   * Fetches bundle and user bundle accounts on-chain.
   */
  async buildDepositInstructions({
    vaultId,
    userAddress,
    amountRaw,
  }: {
    vaultId: number
    userAddress: string
    /** Smallest token units (decimal string), same scale as SPL `amount`. */
    amountRaw: string
  }): Promise<TransactionInstruction[]> {
    const vault = this.vaults[vaultId]
    if (!vault) {
      throw new Error(`Vault config not found for vaultId ${vaultId}`)
    }
    const bundleProgram = this.getBundleProgramForVault(vault)
    return buildBundleDepositInstructions({
      bundleProgram,
      bundleCluster: this.bundleCluster,
      vault,
      user: new PublicKey(userAddress),
      amountRaw,
    })
  }

  /**
   * Build request-withdraw instruction. Fetches vault, oracle, and depositor accounts on-chain.
   */
  async buildRequestWithdrawInstruction({
    vaultId,
    userAddress,
    amountRaw,
  }: {
    vaultId: number
    userAddress: string
    /** Smallest token units (decimal string) to request withdrawing. */
    amountRaw: string
  }): Promise<TransactionInstruction> {
    const vault = this.vaults[vaultId]
    if (!vault) {
      throw new Error(`Vault config not found for vaultId ${vaultId}`)
    }
    const bundleProgram = this.getBundleProgramForVault(vault)
    return buildBundleRequestWithdrawInstruction({
      bundleProgram,
      bundleCluster: this.bundleCluster,
      vault,
      user: new PublicKey(userAddress),
      amountRaw,
    })
  }
}
