import type { TransactionSigner } from '@solana/kit'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createNoopSigner,

} from '@solana/kit'
import { CliError } from './errors'
import { parseAddress } from './parse'

const signerByPath = new Map<string, Promise<TransactionSigner>>()
const signerByAddress = new Map<string, TransactionSigner>()

function readKeypairBytes(path: string): Uint8Array {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  }
  catch (error) {
    throw new CliError(`Failed to read keypair "${path}": ${(error as Error).message}`)
  }

  if (!Array.isArray(parsed) || !parsed.every(item => Number.isInteger(item) && item >= 0 && item <= 255)) {
    throw new CliError(`Keypair file must be a JSON byte array: ${path}`)
  }
  return Uint8Array.from(parsed)
}

async function loadUncachedKeypairSigner(path: string): Promise<TransactionSigner> {
  const bytes = readKeypairBytes(path)
  const signer
    = bytes.length === 64
      ? await createKeyPairSignerFromBytes(bytes)
      : bytes.length === 32
        ? await createKeyPairSignerFromPrivateKeyBytes(bytes)
        : null
  if (!signer) {
    throw new CliError(`Keypair must contain 32 or 64 bytes: ${path}`)
  }

  const existing = signerByAddress.get(signer.address)
  if (existing)
    return existing
  signerByAddress.set(signer.address, signer)
  return signer
}

export async function loadKeypairSigner(path: string): Promise<TransactionSigner> {
  const normalizedPath = resolve(path)
  const existing = signerByPath.get(normalizedPath)
  if (existing)
    return existing

  const signerPromise = loadUncachedKeypairSigner(normalizedPath).catch((error: unknown) => {
    signerByPath.delete(normalizedPath)
    throw error
  })
  signerByPath.set(normalizedPath, signerPromise)
  return signerPromise
}

export async function resolveInstructionSigner({
  name,
  addressValue,
  keypairPath,
  requireKeypair,
}: {
  name: string
  addressValue?: string
  keypairPath?: string
  requireKeypair: boolean
}): Promise<TransactionSigner> {
  if (keypairPath)
    return loadKeypairSigner(keypairPath)
  if (requireKeypair) {
    throw new CliError(`--${name}-keypair <path> is required for simulate / execute mode`)
  }
  if (!addressValue) {
    throw new CliError(`--${name} <address> or --${name}-keypair <path> is required`)
  }
  return createNoopSigner(parseAddress(addressValue, `--${name}`))
}
