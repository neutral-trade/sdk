#!/usr/bin/env tsx
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface VaultRow {
  vaultId: number
  name: string
  subname?: string
}

function buildEnumEntries(vaultsJson: VaultRow[]): string[] {
  const entries: string[] = []
  for (const vault of vaultsJson) {
    const parts = [vault.name]
    if (vault.subname) {
      parts.push(vault.subname)
    }
    parts.push(String(vault.vaultId))
    const finalKey = parts
      .join('_')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^(\d)/, '_$1')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')

    entries.push(`  /** ${vault.name}${vault.subname ? ` - ${vault.subname}` : ''} */\n  ${finalKey} = ${vault.vaultId},`)
  }
  return entries
}

function writeVaultIdsFile(
  vaultsPath: string,
  outputRelative: string,
  enumName: string,
  sourceLabel: string,
): void {
  const vaultsJson = JSON.parse(fs.readFileSync(vaultsPath, 'utf-8')) as VaultRow[]
  const entries = buildEnumEntries(vaultsJson)
  const content = `// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from ${sourceLabel}
// Run 'pnpm generate' to regenerate

/**
 * Vault ID constants (${enumName})
 * Auto-generated from the vault registry JSON.
 */
export enum ${enumName} {
${entries.join('\n')}
}
`
  const outputPath = path.join(__dirname, outputRelative)
  fs.writeFileSync(outputPath, content, 'utf-8')
  console.log(`✓ Generated ${path.relative(path.join(__dirname, '..'), outputPath)}`)
  console.log(`  ${entries.length} vault IDs`)
}

const mainnetPath = path.join(__dirname, '../src/registry/vaults.json')
const devnetPath = path.join(__dirname, '../src/registry/vaults.devnet.json')

writeVaultIdsFile(mainnetPath, '../src/constants/vault-ids.ts', 'VaultId', 'src/registry/vaults.json')
writeVaultIdsFile(devnetPath, '../src/constants/vault-ids.devnet.ts', 'DevnetVaultId', 'src/registry/vaults.devnet.json')
