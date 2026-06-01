// NeutralTrade - Main SDK class (Bundle vault balances only; Drift is not included in this package.)

import type { Connection, TransactionInstruction } from '@solana/web3.js'
import type { BundleCluster } from './constants/programs'
import type { NeutralTradeCoreContext } from './neutral-trade-core'
import type { SupportedToken, UserBalanceResult, VaultRegistry } from './types'
import {
  buildDepositInstructionsForVaultId,
  buildRequestWithdrawInstructionForVaultId,
  initNeutralTradeCore,

} from './neutral-trade-core'
import { VaultType } from './types'
import { getBundleBalances } from './utils/bundle'

export interface NeutralTradeConfig {
  rpcUrl: string
  /** Bundle program cluster selector. Defaults to 'mainnet'. */
  bundleCluster?: BundleCluster
  /** Optional fallback prices map. Prices are fetched from Pyth Network first; fallback is used only if Pyth returns incomplete data */
  fallbackPrices?: Partial<Record<SupportedToken, number>>
}

export { type NeutralTradeCoreContext }

export class NeutralTrade {
  public readonly connection: Connection
  public readonly bundlePrograms: NeutralTradeCoreContext['bundlePrograms']
  public readonly bundleCluster: BundleCluster
  /** Built-in vault configurations for the selected cluster. */
  public readonly vaults: VaultRegistry
  /** Price map for deposit tokens */
  public readonly priceMap: Map<SupportedToken, number>

  protected constructor(
    core: NeutralTradeCoreContext,
    bundleCluster: BundleCluster,
  ) {
    this.connection = core.connection
    this.bundlePrograms = core.bundlePrograms
    this.bundleCluster = bundleCluster
    this.vaults = core.vaults
    this.priceMap = core.priceMap
  }

  protected static async initCore(config: NeutralTradeConfig): Promise<NeutralTradeCoreContext> {
    return initNeutralTradeCore(config)
  }

  static async create(config: NeutralTradeConfig): Promise<NeutralTrade> {
    const core = await this.initCore(config)
    return new NeutralTrade(core, config.bundleCluster ?? 'mainnet')
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
   * Uses the built-in vault registry only.
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
    if (!this.vaults[vaultId]) {
      throw new Error(`Vault config not found for vaultId ${vaultId}`)
    }
    return buildDepositInstructionsForVaultId(
      {
        connection: this.connection,
        bundlePrograms: this.bundlePrograms,
        vaults: this.vaults,
        priceMap: this.priceMap,
      },
      this.bundleCluster,
      { vaultId, userAddress, amountRaw },
    )
  }

  /**
   * Build request-withdraw instruction. Uses the built-in vault registry only.
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
    if (!this.vaults[vaultId]) {
      throw new Error(`Vault config not found for vaultId ${vaultId}`)
    }
    return buildRequestWithdrawInstructionForVaultId(
      {
        connection: this.connection,
        bundlePrograms: this.bundlePrograms,
        vaults: this.vaults,
        priceMap: this.priceMap,
      },
      this.bundleCluster,
      { vaultId, userAddress, amountRaw },
    )
  }
}
