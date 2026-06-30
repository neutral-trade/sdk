import type { Address } from '@coral-xyz/anchor'
import type { VaultRegistryEntry } from '../src/types/vault-types'
import { Buffer } from 'node:buffer'
import { BN } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { describe, expect, it, vi } from 'vitest'
import { createAnchorProvider, createConnection } from '../src/constants/client'
import {
  createAllowlistedBundleProgram,
  DEFAULT_BUNDLE_PROGRAM_ID_DEVNET,
} from '../src/constants/programs'
import { getSolanaTokenMint, SupportedToken } from '../src/types/tokens'
import { VaultCategory, VaultType } from '../src/types/vault-types'
import { buildBundleRequestSwitchInstructionWithVault } from '../src/utils/bundle-instructions-core'
import { deriveOraclePDA, deriveTempDataPDA, deriveUserPDA } from '../src/utils/pda'
import { computeRequestWithdrawalSharesFromAmountRaw } from '../src/utils/request-withdraw-shares'

describe('computeRequestWithdrawalSharesFromAmountRaw', () => {
  const totalShares = 1000n
  const totalEquity = 1050n
  const userShares = new BN('1000')

  it('burns all shares when amountRaw >= user token raw', () => {
    const userTokenRaw = (1000n * 1050n) / 1000n
    const out = computeRequestWithdrawalSharesFromAmountRaw({
      amountRaw: userTokenRaw,
      userShares,
      totalEquity,
      totalShares,
    })
    expect(out.toString()).toBe(userShares.toString())
  })

  it('burns all shares when amount exceeds user token raw', () => {
    const userTokenRaw = (1000n * 1050n) / 1000n
    const out = computeRequestWithdrawalSharesFromAmountRaw({
      amountRaw: userTokenRaw + 1n,
      userShares,
      totalEquity,
      totalShares,
    })
    expect(out.toString()).toBe(userShares.toString())
  })

  it('computes partial shares from token raw and pool ratio', () => {
    const amountRaw = 105n
    const expected = new BN(((105n * totalShares) / totalEquity).toString())
    const out = computeRequestWithdrawalSharesFromAmountRaw({
      amountRaw,
      userShares,
      totalEquity,
      totalShares,
    })
    expect(out.toString()).toBe(expected.toString())
  })

  it('caps at user shares when computed shares exceed balance', () => {
    const out = computeRequestWithdrawalSharesFromAmountRaw({
      amountRaw: 1_000_000n,
      userShares: new BN('100'),
      totalEquity: 1n,
      totalShares: 1n,
    })
    expect(out.lte(new BN('100'))).toBe(true)
    expect(out.toString()).toBe('100')
  })
})

function toPublicKey(address: Address): PublicKey {
  return typeof address === 'string' ? new PublicKey(address) : address
}

function makeBundleVault(
  vaultId: number,
  vaultAddress: PublicKey,
  depositToken = SupportedToken.USDC,
): VaultRegistryEntry {
  return {
    vaultId,
    name: `vault-${vaultId}`,
    type: VaultType.Bundle,
    category: VaultCategory.marketNeutral,
    vaultAddress: vaultAddress.toBase58(),
    depositToken,
  }
}

describe('buildBundleRequestSwitchInstructionWithVault', () => {
  const user = Keypair.generate().publicKey
  const sourceBundle = Keypair.generate().publicKey
  const targetBundle = Keypair.generate().publicKey
  const usdcMint = new PublicKey(getSolanaTokenMint(SupportedToken.USDC, 'devnet'))
  const usdtMint = new PublicKey(getSolanaTokenMint(SupportedToken.USDT, 'devnet'))

  function createMockBundleProgram() {
    const connection = createConnection('http://127.0.0.1:8899')
    const provider = createAnchorProvider(connection)
    return createAllowlistedBundleProgram(provider, DEFAULT_BUNDLE_PROGRAM_ID_DEVNET, 'devnet')
  }

  function mockSwitchFetches(
    bundleProgram: ReturnType<typeof createMockBundleProgram>,
    sourceMint: PublicKey,
    targetMint: PublicKey,
    options?: { targetUserBundleExists?: boolean },
  ) {
    const programPk = bundleProgram.programId
    const targetUserPDA = deriveUserPDA(user, targetBundle, programPk)
    const targetUserBundleExists = options?.targetUserBundleExists ?? true

    vi.spyOn(bundleProgram.provider.connection, 'getAccountInfo').mockImplementation(
      async (pk: PublicKey) => {
        if (pk.equals(targetUserPDA)) {
          return targetUserBundleExists
            ? ({ data: Buffer.alloc(1), lamports: 1, owner: programPk } as never)
            : null
        }
        return null
      },
    )

    vi.spyOn(bundleProgram.account.bundle, 'fetch').mockImplementation(async (address) => {
      const pk = toPublicKey(address)
      if (pk.equals(sourceBundle)) {
        return {
          assetAddress: sourceMint,
          bundleUnderlyingBalance: new BN('1000000000'),
          totalShares: new BN('1000000000'),
        } as never
      }
      if (pk.equals(targetBundle)) {
        return {
          assetAddress: targetMint,
          bundleUnderlyingBalance: new BN('500000000'),
          totalShares: new BN('500000000'),
        } as never
      }
      throw new Error(`unexpected bundle fetch: ${pk.toBase58()}`)
    })
    vi.spyOn(bundleProgram.account.oracleData, 'fetch').mockResolvedValue({
      averageExternalEquity: new BN('0'),
    } as never)
    vi.spyOn(bundleProgram.account.userBundleAccount, 'fetch').mockResolvedValue({
      shares: new BN('1000000000'),
    } as never)
  }

  it('throws when source and target vault id match', async () => {
    const vault = makeBundleVault(1, sourceBundle)
    const bundleProgram = createMockBundleProgram()
    await expect(
      buildBundleRequestSwitchInstructionWithVault({
        bundleProgram,
        bundleCluster: 'devnet',
        sourceVault: vault,
        targetVault: vault,
        user,
        amountRaw: '1000000',
      }),
    ).rejects.toThrow(/must differ/)
  })

  it('throws when deposit tokens differ', async () => {
    const bundleProgram = createMockBundleProgram()
    await expect(
      buildBundleRequestSwitchInstructionWithVault({
        bundleProgram,
        bundleCluster: 'devnet',
        sourceVault: makeBundleVault(1, sourceBundle, SupportedToken.USDC),
        targetVault: makeBundleVault(2, targetBundle, SupportedToken.USDT),
        user,
        amountRaw: '1000000',
      }),
    ).rejects.toThrow(/same deposit token/)
  })

  it('throws when on-chain asset mints differ', async () => {
    const bundleProgram = createMockBundleProgram()
    mockSwitchFetches(bundleProgram, usdcMint, usdtMint)
    await expect(
      buildBundleRequestSwitchInstructionWithVault({
        bundleProgram,
        bundleCluster: 'devnet',
        sourceVault: makeBundleVault(1, sourceBundle),
        targetVault: makeBundleVault(2, targetBundle),
        user,
        amountRaw: '1000000',
      }),
    ).rejects.toThrow(/same asset mint/)
  })

  it('builds requestBundleSwitch with 10 accounts (matches bundle-sc test layout)', async () => {
    const bundleProgram = createMockBundleProgram()
    mockSwitchFetches(bundleProgram, usdcMint, usdcMint, { targetUserBundleExists: true })
    const programPk = bundleProgram.programId
    const oraclePDA = deriveOraclePDA(sourceBundle, programPk)
    const userPDA = deriveUserPDA(user, sourceBundle, programPk)
    const tempDataPDA = deriveTempDataPDA(sourceBundle, programPk)
    const targetUserPDA = deriveUserPDA(user, targetBundle, programPk)

    const instructions = await buildBundleRequestSwitchInstructionWithVault({
      bundleProgram,
      bundleCluster: 'devnet',
      sourceVault: makeBundleVault(1, sourceBundle),
      targetVault: makeBundleVault(2, targetBundle),
      user,
      amountRaw: '1000000',
    })

    expect(instructions).toHaveLength(1)
    const ix = instructions[0]

    expect(ix.keys).toHaveLength(10)
    expect(ix.keys.map(k => k.pubkey.toBase58())).toEqual([
      user.toBase58(),
      userPDA.toBase58(),
      sourceBundle.toBase58(),
      oraclePDA.toBase58(),
      tempDataPDA.toBase58(),
      TOKEN_PROGRAM_ID.toBase58(),
      SystemProgram.programId.toBase58(),
      SYSVAR_RENT_PUBKEY.toBase58(),
      targetBundle.toBase58(),
      targetUserPDA.toBase58(),
    ])
    expect([...ix.data.subarray(0, 8)]).toEqual([66, 9, 104, 111, 227, 251, 51, 176])
  })

  it('prepends initializeBundleDepositor when target user bundle is missing', async () => {
    const bundleProgram = createMockBundleProgram()
    mockSwitchFetches(bundleProgram, usdcMint, usdcMint, { targetUserBundleExists: false })
    const programPk = bundleProgram.programId
    const targetUserPDA = deriveUserPDA(user, targetBundle, programPk)

    const instructions = await buildBundleRequestSwitchInstructionWithVault({
      bundleProgram,
      bundleCluster: 'devnet',
      sourceVault: makeBundleVault(1, sourceBundle),
      targetVault: makeBundleVault(2, targetBundle),
      user,
      amountRaw: '1000000',
    })

    expect(instructions).toHaveLength(2)
    expect(instructions[0].keys.map(k => k.pubkey.toBase58())).toEqual([
      user.toBase58(),
      user.toBase58(),
      SystemProgram.programId.toBase58(),
      targetBundle.toBase58(),
      targetUserPDA.toBase58(),
    ])
    expect([...instructions[0].data.subarray(0, 8)]).toEqual([126, 6, 242, 36, 22, 209, 35, 2])
    expect([...instructions[1].data.subarray(0, 8)]).toEqual([66, 9, 104, 111, 227, 251, 51, 176])
  })

  it('exposes requestBundleSwitch on Anchor program methods after IDL sync', () => {
    const bundleProgram = createMockBundleProgram()
    expect(typeof bundleProgram.methods.requestBundleSwitch).toBe('function')
  })
})
