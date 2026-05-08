// NeutralTrade - Main SDK class (Bundle vault balances only; Drift is not included in this package.)

import type { Program } from '@coral-xyz/anchor'
import type { Program as Program32 } from '@coral-xyz/anchor-32'
import type { Connection, TransactionInstruction } from '@solana/web3.js'
import type { NtbundleV1 } from './idl/bundle-v1'
import type { NtbundleV2 } from './idl/bundle-v2'
import type { SupportedToken, UserBalanceResult, VaultRegistry } from './types'
import { PublicKey } from '@solana/web3.js'
import { createAnchorProviderV29, createAnchorProviderV32, createConnection } from './constants/client'
import { createBundleProgramV1, createBundleProgramV2 } from './constants/programs'
import { vaults as builtInVaults, toVaultRegistry } from './constants/vaults'
import { VaultRegistryArraySchema, VaultType } from './types'
import { getBundleBalances } from './utils/bundle'
import {
  buildBundleDepositInstructions,
  buildBundleRequestWithdrawInstruction,
} from './utils/bundle-instructions'
import { initializePrices } from './utils/price'

export interface NeutralTradeConfig {
  rpcUrl: string
  /** Optional registry URL to fetch vault configurations from. If provided, fetched vaults will override built-in vaults. */
  registryUrl?: string
  /** Optional fallback prices map. Prices are fetched from Pyth Network first; fallback is used only if Pyth returns incomplete data */
  fallbackPrices?: Partial<Record<SupportedToken, number>>
}

export interface NeutralTradeCoreContext {
  connection: Connection
  bundleProgramV1: Program<NtbundleV1>
  bundleProgramV2: Program32<NtbundleV2>
  vaults: VaultRegistry
  priceMap: Map<SupportedToken, number>
}

export class NeutralTrade {
  public readonly connection: Connection
  public readonly bundleProgramV1: Program<NtbundleV1>
  public readonly bundleProgramV2: Program32<NtbundleV2>
  /** Vault configurations (built-in merged with remote if registryUrl was provided) */
  public readonly vaults: VaultRegistry
  /** Price map for deposit tokens */
  public readonly priceMap: Map<SupportedToken, number>

  protected constructor(
    connection: Connection,
    bundleProgramV1: Program<NtbundleV1>,
    bundleProgramV2: Program32<NtbundleV2>,
    vaults: VaultRegistry,
    priceMap: Map<SupportedToken, number>,
  ) {
    this.connection = connection
    this.bundleProgramV1 = bundleProgramV1
    this.bundleProgramV2 = bundleProgramV2
    this.vaults = vaults
    this.priceMap = priceMap
  }

  /**
   * Create a new NeutralTrade instance
   * @throws Error if registryUrl is provided but fetch fails or validation fails
   */
  protected static async initCore(config: NeutralTradeConfig): Promise<NeutralTradeCoreContext> {
    const connection = createConnection(config.rpcUrl)

    // Create Anchor providers
    const providerV29 = createAnchorProviderV29(connection)
    const providerV32 = createAnchorProviderV32(connection)

    // Create Bundle programs
    const bundleProgramV1 = createBundleProgramV1(providerV29)
    const bundleProgramV2 = createBundleProgramV2(providerV32)

    // Fetch and merge vaults from registry if URL is provided
    let vaults: VaultRegistry = { ...builtInVaults }

    if (config.registryUrl) {
      const remoteVaults = await NeutralTrade.fetchVaultsFromRegistry(config.registryUrl)
      // Remote vaults override built-in vaults
      vaults = { ...builtInVaults, ...remoteVaults }
    }

    // Initialize prices
    const priceMap = await initializePrices(config.fallbackPrices)

    return {
      connection,
      bundleProgramV1,
      bundleProgramV2,
      vaults,
      priceMap,
    }
  }

  static async create(config: NeutralTradeConfig): Promise<NeutralTrade> {
    const core = await this.initCore(config)
    return new NeutralTrade(
      core.connection,
      core.bundleProgramV1,
      core.bundleProgramV2,
      core.vaults,
      core.priceMap,
    )
  }

  /**
   * Fetch vault configurations from a remote registry URL
   * Expects JSON array format and transforms to Record<number, VaultConfig>
   * @throws Error if fetch fails or validation fails
   */
  private static async fetchVaultsFromRegistry(
    registryUrl: string,
  ): Promise<VaultRegistry> {
    const response = await fetch(registryUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch vaults from registry: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Validate with zod schema (expects array format)
    const parseResult = VaultRegistryArraySchema.safeParse(data)

    if (!parseResult.success) {
      throw new Error(`Invalid vault registry data: ${parseResult.error.message}`)
    }

    // Transform array to VaultRegistry with program IDs
    return toVaultRegistry(parseResult.data)
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
      bundleProgramV1: this.bundleProgramV1,
      bundleProgramV2: this.bundleProgramV2,
      priceMap: this.priceMap,
    })
  }

  /**
   * Build deposit instructions (optional init + requestDeposit). Fetches vault state on-chain.
   */
  async buildDepositInstructions({
    vaultId,
    userAddress,
    amount,
    needsInit = false,
  }: {
    vaultId: number
    userAddress: string
    amount: number
    needsInit?: boolean
  }): Promise<TransactionInstruction[]> {
    const vault = this.vaults[vaultId]
    if (!vault) {
      throw new Error(`Vault config not found for vaultId ${vaultId}`)
    }
    return buildBundleDepositInstructions({
      bundleProgramV1: this.bundleProgramV1,
      bundleProgramV2: this.bundleProgramV2,
      vault,
      user: new PublicKey(userAddress),
      amount,
      needsInit,
    })
  }

  /**
   * Build request-withdraw instruction. Fetches vault, oracle, and depositor accounts on-chain.
   */
  async buildRequestWithdrawInstruction({
    vaultId,
    userAddress,
    amount,
  }: {
    vaultId: number
    userAddress: string
    amount: number
  }): Promise<TransactionInstruction> {
    const vault = this.vaults[vaultId]
    if (!vault) {
      throw new Error(`Vault config not found for vaultId ${vaultId}`)
    }
    return buildBundleRequestWithdrawInstruction({
      bundleProgramV1: this.bundleProgramV1,
      bundleProgramV2: this.bundleProgramV2,
      vault,
      user: new PublicKey(userAddress),
      amount,
    })
  }
}
