#!/usr/bin/env tsx
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read vaults.json
const vaultsJsonPath = path.join(__dirname, '../src/registry/vaults.json')
const vaultsJson = JSON.parse(fs.readFileSync(vaultsJsonPath, 'utf-8'))

// Generate key names (handle duplicates by appending subname or id)
const keyMap = new Map<string, number>()
const entries: string[] = []

for (const vault of vaultsJson) {
  // Combine name, subname, and vaultId; replace non-English and non-number chars with underline
  const parts = [vault.name]
  if (vault.subname) {
    parts.push(vault.subname)
  }
  parts.push(String(vault.vaultId))
  const finalKey = parts
    .join('_')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^(\d)/, '_$1') // Prefix leading number with underline
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_+|_+$/g, '') // Trim leading/trailing underscores

  keyMap.set(finalKey, vault.vaultId)
  entries.push(`  /** ${vault.name}${vault.subname ? ` - ${vault.subname}` : ''} */\n  ${finalKey} = ${vault.vaultId},`)
}

const content = `// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from src/registry/vaults.json
// Run 'pnpm generate' to regenerate

/**
 * Vault ID constants for backward compatibility
 * These are auto-generated from the vault registry
 */
export enum VaultId {
${entries.join('\n')}
}
`

const outputPath = path.join(__dirname, '../src/constants/vault-ids.ts')
fs.writeFileSync(outputPath, content, 'utf-8')
console.log(`✓ Generated ${path.relative(path.dirname(import.meta.url), outputPath)}`)
console.log(`  ${entries.length} vault IDs generated`)
