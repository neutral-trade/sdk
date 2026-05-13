import fs from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Keypair } from '@solana/web3.js'

/** Expand `~` / `~/...` in paths (shell usually does this; `.env` does not). */
function expandUserPath(input: string): string {
  if (input === '~')
    return homedir()
  if (input.startsWith('~/'))
    return join(homedir(), input.slice(2))
  return input
}

/**
 * Load a local signer for examples.
 *
 * Prefer `SOLANA_KEYPAIR_PATH` (path to Solana CLI `id.json`).
 * Or `SOLANA_WALLET_SECRET_KEY` as a JSON array string, e.g. `[1,2,...]` from `cat ~/.config/solana/id.json`.
 */
export function loadSignerKeypair(): Keypair {
  const path = process.env.SOLANA_KEYPAIR_PATH
  if (path) {
    const resolved = expandUserPath(path)
    const raw = fs.readFileSync(resolved, 'utf8')
    const secret = JSON.parse(raw) as number[]
    if (!Array.isArray(secret))
      throw new Error(`SOLANA_KEYPAIR_PATH file must contain a JSON number array: ${resolved}`)
    return Keypair.fromSecretKey(Uint8Array.from(secret))
  }

  const inline = process.env.SOLANA_WALLET_SECRET_KEY
  if (inline) {
    const secret = JSON.parse(inline) as number[]
    if (!Array.isArray(secret))
      throw new Error('SOLANA_WALLET_SECRET_KEY must be a JSON array of numbers (same format as id.json)')
    return Keypair.fromSecretKey(Uint8Array.from(secret))
  }

  throw new Error(
    'Set SOLANA_KEYPAIR_PATH (path to id.json) or SOLANA_WALLET_SECRET_KEY (JSON array string from id.json)',
  )
}
