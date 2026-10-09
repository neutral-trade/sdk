import type { VaultRegistryEntry } from '../src/types/vault-types'
import { describe, expect, it } from 'vitest'
import { parseIndexerVaults, syncVaultRegistry } from '../scripts/vault-registry-sync'

// Old registry fixture: a slice of src/registry/vaults.json (sorted by vaultId descending).
const registryJson = `[
  {
    "vaultId": 87,
    "name": "Zavara-SOL-Bundle",
    "type": "Bundle",
    "category": "Market Neutral",
    "vaultAddress": "7opUmfSUpCeobeAFkMYcVTn76CyLwgVDqoDqmnZZ9Zpi",
    "depositToken": "SOL",
    "pointsMultiplier": 1,
    "pointsEnabled": false
  },
  {
    "vaultId": 85,
    "name": "Neutral Trade Autopilot (Ethereum)",
    "type": "AccountableNav",
    "category": "Master Vault",
    "chain": "Ethereum",
    "vaultAddress": "0x909dAdBcA7955614A455d9e7447aD4adB4902C8E",
    "strategyAddress": "0x56B935Fe5183cC0DE489233d032F9A4B8ec2f9Ff",
    "accountableLoanId": 608250934,
    "depositToken": "USDC",
    "pointsMultiplier": 2,
    "pointsEnabled": true
  },
  {
    "vaultId": 80,
    "name": "Options-MM-Z",
    "type": "Bundle",
    "category": "Market Neutral",
    "vaultAddress": "3vZKAcd74bzwNYZmsJndYExkGj6ABQwrUoiMtdNfzLZe",
    "depositToken": "USDC",
    "pointsMultiplier": 1,
    "pointsEnabled": true
  },
  {
    "vaultId": 69,
    "name": "JLP Delta Neutral",
    "subname": "vault-jupiter",
    "type": "Bundle",
    "category": "Market Neutral",
    "vaultAddress": "GiNbTRuRqvVGEEQGZKMjmwX84LrsbqfzVVNtWYbcZPCY",
    "depositToken": "USDC",
    "bundleProgramId": "BUNDeH5A4c47bcEoAjBhN3sCjLgYnRsmt9ibMztqVkC9",
    "pointsMultiplier": 1,
    "pointsEnabled": false
  },
  {
    "vaultId": 0,
    "name": "JLP Delta Neutral",
    "subname": "vault-1",
    "type": "Drift",
    "category": "Market Neutral",
    "vaultAddress": "3Nkctq19AW7gs5hkxixUDjS9UVjmCwcNCo7rqPpub87c",
    "depositToken": "USDC",
    "driftProgramId": "9Fcn3Fd4d5ocrb12xCUtEvezxcjFEAyHBPfrZDiPt9Qj",
    "pointsEnabled": false
  }
]
`

const DEFAULT_PROGRAM = 'BUNDDh4P5XviMm1f3gCvnq2qKx6TGosAGnoUK12e7cXU'
const V2_PROGRAM = 'BUNDeH5A4c47bcEoAjBhN3sCjLgYnRsmt9ibMztqVkC9'

// /v2/vaults rows as the indexer returns them (trimmed to a realistic subset of fields).
function solanaRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    asset: { decimals: 6, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
    category: 'marketNeutral',
    chain: 'solana',
    depositFeeBps: 0,
    enabled: true,
    managementFeeBps: 0,
    ntMultiplier: 1,
    performanceFeeBps: 2000,
    programId: DEFAULT_PROGRAM,
    visible: true,
    ...overrides,
  }
}

const inSyncRows = [
  solanaRow({
    legacyVaultId: 87,
    name: 'Zavara SOL',
    bundleKey: '7opUmfSUpCeobeAFkMYcVTn76CyLwgVDqoDqmnZZ9Zpi',
    asset: { decimals: 9, mint: 'So11111111111111111111111111111111111111112', symbol: 'WSOL' },
  }),
  {
    asset: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, mint: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
    bundleKey: '0x909dAdBcA7955614A455d9e7447aD4adB4902C8E',
    category: 'fundOfFund',
    chain: 'evm:1',
    chainId: 1,
    evm: { accountableLoanId: 608250934, strategy: '0x56B935Fe5183cC0DE489233d032F9A4B8ec2f9Ff' },
    legacyVaultId: 85,
    name: 'Neutral Trade Autopilot',
    ntMultiplier: 2,
    programId: '0x909dAdBcA7955614A455d9e7447aD4adB4902C8E',
  },
  // Indexer name and category differ from the SDK entry; neither may be copied over.
  solanaRow({
    legacyVaultId: 80,
    name: 'Options Market Making',
    category: 'directional',
    bundleKey: '3vZKAcd74bzwNYZmsJndYExkGj6ABQwrUoiMtdNfzLZe',
  }),
  solanaRow({
    legacyVaultId: 69,
    name: 'JLP Delta Neutral',
    bundleKey: 'GiNbTRuRqvVGEEQGZKMjmwX84LrsbqfzVVNtWYbcZPCY',
    programId: V2_PROGRAM,
  }),
]

function envelope(vaults: unknown[]): unknown {
  return { data: { count: vaults.length, unavailableVaults: [], vaults } }
}

function sync(rows: unknown[]): VaultRegistryEntry[] {
  return syncVaultRegistry(parseIndexerVaults(envelope(rows)), JSON.parse(registryJson))
}

function serialize(registry: VaultRegistryEntry[]): string {
  return `${JSON.stringify(registry, null, 2)}\n`
}

function byId(registry: VaultRegistryEntry[], vaultId: number): VaultRegistryEntry | undefined {
  return registry.find(entry => entry.vaultId === vaultId)
}

describe('syncVaultRegistry', () => {
  it('produces byte-identical output when the registry is already in sync', () => {
    const result = sync(inSyncRows)
    expect(result).toEqual(JSON.parse(registryJson))
    expect(serialize(result)).toBe(registryJson)
  })

  it('adds a new Solana bundle in vaultId-descending position with points disabled', () => {
    const result = sync([
      ...inSyncRows,
      solanaRow({
        legacyVaultId: 88,
        name: 'New-USDC-Bundle',
        category: 'etf',
        bundleKey: 'C68A4mAhA9EE4rWq9HmFnq3SPcbNmst6qiBWcna5VDHy',
        programId: V2_PROGRAM,
        ntMultiplier: 1.5,
      }),
    ])
    expect(result.map(entry => entry.vaultId)).toEqual([88, 87, 85, 80, 69, 0])
    expect(result[0]).toEqual({
      vaultId: 88,
      name: 'New-USDC-Bundle',
      type: 'Bundle',
      category: 'Index',
      vaultAddress: 'C68A4mAhA9EE4rWq9HmFnq3SPcbNmst6qiBWcna5VDHy',
      depositToken: 'USDC',
      bundleProgramId: V2_PROGRAM,
      pointsMultiplier: 1.5,
      pointsEnabled: false,
    })
  })

  it('adds a new EVM vault with the same shape as existing AccountableNav entries', () => {
    const result = sync([
      ...inSyncRows,
      {
        asset: { address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', decimals: 6, mint: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', symbol: 'USDC' },
        bundleKey: '0xaABab7598be3c4fE58c593e73C2F5934b73b573E',
        category: 'fundOfFund',
        chain: 'evm:143',
        chainId: 143,
        evm: { accountableLoanId: 608250958, strategy: '0x5ee57E42DF67e5707F0CAE1a18DfeaDB4F0Df86c' },
        legacyVaultId: 86,
        name: 'Neutral Trade Autopilot (Monad)',
        ntMultiplier: 1,
        programId: '0xaABab7598be3c4fE58c593e73C2F5934b73b573E',
      },
    ])
    // Same object (keys and key order) as vaultId 86 in src/registry/vaults.json.
    expect(serialize([byId(result, 86)!])).toBe(`[
  {
    "vaultId": 86,
    "name": "Neutral Trade Autopilot (Monad)",
    "type": "AccountableNav",
    "category": "Master Vault",
    "chain": "Monad",
    "vaultAddress": "0xaABab7598be3c4fE58c593e73C2F5934b73b573E",
    "strategyAddress": "0x5ee57E42DF67e5707F0CAE1a18DfeaDB4F0Df86c",
    "accountableLoanId": 608250958,
    "depositToken": "USDC",
    "pointsMultiplier": 1,
    "pointsEnabled": false
  }
]
`)
  })

  it('skips rows without a legacyVaultId, such as drafts', () => {
    const result = sync([
      ...inSyncRows,
      solanaRow({ legacyVaultId: null, name: null, category: null, bundleKey: 'C68A4mAhA9EE4rWq9HmFnq3SPcbNmst6qiBWcna5VDHy' }),
      solanaRow({ legacyVaultId: null, name: 'Draft', bundleKey: 'G5aMxQTbGWMnYycpfjHpD7Y1muoKBwaB1HtCdpUUcQZp' }),
    ])
    expect(serialize(result)).toBe(registryJson)
  })

  it('leaves registry entries the indexer does not list untouched', () => {
    const result = sync([])
    expect(serialize(result)).toBe(registryJson)
  })

  it('updates indexer-owned fields of an existing entry without renaming or recategorizing it', () => {
    const result = sync([
      solanaRow({
        legacyVaultId: 80,
        name: 'Options Market Making',
        category: 'directional',
        bundleKey: '3vZKAcd74bzwNYZmsJndYExkGj6ABQwrUoiMtdNfzLZe',
        programId: V2_PROGRAM,
        ntMultiplier: 3,
        asset: { decimals: 6, mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
      }),
      // Back on the default program: the explicit override is dropped.
      solanaRow({ legacyVaultId: 69, name: 'JLP Delta Neutral', bundleKey: 'GiNbTRuRqvVGEEQGZKMjmwX84LrsbqfzVVNtWYbcZPCY' }),
    ])
    expect(byId(result, 80)).toEqual({
      vaultId: 80,
      name: 'Options-MM-Z',
      type: 'Bundle',
      category: 'Market Neutral',
      vaultAddress: '3vZKAcd74bzwNYZmsJndYExkGj6ABQwrUoiMtdNfzLZe',
      depositToken: 'USDT',
      pointsMultiplier: 3,
      pointsEnabled: true,
      bundleProgramId: V2_PROGRAM,
    })
    expect(byId(result, 69)).not.toHaveProperty('bundleProgramId')
    expect(byId(result, 69)).toMatchObject({ name: 'JLP Delta Neutral', subname: 'vault-jupiter' })
  })

  it('skips new rows whose chain or deposit token the SDK cannot represent', () => {
    const result = sync([
      ...inSyncRows,
      solanaRow({ legacyVaultId: 90, name: 'Odd-Token', bundleKey: 'C68A4mAhA9EE4rWq9HmFnq3SPcbNmst6qiBWcna5VDHy', asset: { decimals: 6, mint: 'C68A4mAhA9EE4rWq9HmFnq3SPcbNmst6qiBWcna5VDHy', symbol: 'BONK' } }),
      {
        asset: { decimals: 6, mint: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', symbol: 'USDC' },
        bundleKey: '0xaABab7598be3c4fE58c593e73C2F5934b73b573E',
        category: 'fundOfFund',
        chain: 'evm:8453',
        evm: { accountableLoanId: 1, strategy: '0x5ee57E42DF67e5707F0CAE1a18DfeaDB4F0Df86c' },
        legacyVaultId: 91,
        name: 'Unknown Chain',
        ntMultiplier: 1,
        programId: '0xaABab7598be3c4fE58c593e73C2F5934b73b573E',
      },
    ])
    expect(serialize(result)).toBe(registryJson)
  })
})
