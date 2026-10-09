#!/usr/bin/env tsx
// Pulls /v2/vaults from the bundle indexer and upserts it into src/registry/vaults.json.
// Requires INDEXER_API_URL and INDEXER_API_KEY. Run `pnpm generate` afterwards for the VaultId enum.
import type { VaultRegistryEntry } from '../src/types/vault-types'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { VaultRegistryArraySchema } from '../src/types/vault-types'
import { parseIndexerVaults, syncVaultRegistry } from './vault-registry-sync'

const { INDEXER_API_URL, INDEXER_API_KEY } = process.env
if (!INDEXER_API_URL || !INDEXER_API_KEY)
  throw new Error('INDEXER_API_URL and INDEXER_API_KEY must be set')

const registryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/registry/vaults.json')

const response = await fetch(`${INDEXER_API_URL.replace(/\/+$/, '')}/v2/vaults`, {
  headers: { 'x-api-key': INDEXER_API_KEY },
})
if (!response.ok)
  throw new Error(`GET /v2/vaults failed: ${response.status} ${response.statusText}`)

const rows = parseIndexerVaults(await response.json())
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as VaultRegistryEntry[]
const { registry: result, skipped } = syncVaultRegistry(rows, registry)
for (const row of skipped)
  console.warn(`⚠ Skipped vault ${row.legacyVaultId} (${row.bundleKey}): ${row.reason}`)
const synced = VaultRegistryArraySchema.parse(result)

fs.writeFileSync(registryPath, `${JSON.stringify(synced, null, 2)}\n`, 'utf-8')
console.log(`✓ Synced ${rows.length} indexer vaults into src/registry/vaults.json (${synced.length} entries)`)
