import type { Address, Instruction, ReadonlyUint8Array } from '@solana/kit'
import type { Command } from 'commander'
import type { GlobalOptions } from '../index'
import type { IdlAccount, IdlInstruction, IdlPda, IdlPdaSeed } from '../lib/idl'
import * as generated from '@neutral-trade/sdk'
import {

  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,

} from '@solana/kit'
import { CliError } from '../lib/errors'
import {
  describeIdlType,
  flattenAccounts,

  loadIdl,
} from '../lib/idl'
import { toCamelCase, toKebabCase, toPascalCase } from '../lib/names'
import { instructionToJson, printJson } from '../lib/output'
import { parseAddress, parseValue } from '../lib/parse'
import { loadKeypairSigner, resolveInstructionSigner } from '../lib/signers'
import { executeInstructionTransaction, simulateInstructionTransaction } from '../lib/transactions'

type CliInstruction = Instruction & {
  accounts: readonly unknown[]
  data: Uint8Array
}

type GeneratedModule = Record<string, unknown>

function getBuilder(instruction: IdlInstruction): {
  name: string
  fn: (input: Record<string, unknown>, config?: { programAddress?: string }) => unknown
} {
  const pascal = toPascalCase(instruction.name)
  const module = generated as GeneratedModule
  const asyncName = `get${pascal}InstructionAsync`
  const syncName = `get${pascal}Instruction`
  const fn = module[asyncName] ?? module[syncName]
  const name = module[asyncName] ? asyncName : syncName
  if (typeof fn !== 'function') {
    throw new CliError(`Generated builder not found for ${instruction.name}`)
  }
  return { name, fn: fn as (input: Record<string, unknown>, config?: { programAddress?: string }) => unknown }
}

function accountHelp(account: IdlAccount): string {
  const parts = []
  if (account.signer)
    parts.push('signer')
  if (account.writable)
    parts.push('writable')
  if (account.pda)
    parts.push('PDA default')
  if (account.address)
    parts.push(`default ${account.address}`)
  return parts.length ? parts.join(', ') : 'account address'
}

function addAccountOptions(command: Command, account: IdlAccount): void {
  const flag = toKebabCase(account.name)
  if (account.signer) {
    command.option(`--${flag} <address>`, `${accountHelp(account)}; noop signer in print mode`)
    command.option(`--${flag}-keypair <path>`, `${account.name} signer keypair JSON path`)
  }
  else {
    command.option(`--${flag} <address>`, accountHelp(account))
  }
}

function addArgOptions(command: Command, instruction: IdlInstruction): void {
  for (const arg of instruction.args) {
    command.requiredOption(`--${toKebabCase(arg.name)} <value>`, `${arg.name}: ${describeIdlType(arg.type)}`)
  }
}

function optionValue(options: Record<string, unknown>, snakeName: string): string | undefined {
  const value = options[toCamelCase(snakeName)]
  return typeof value === 'string' ? value : undefined
}

function addressFromValue(value: unknown): Address | null {
  if (typeof value === 'string')
    return value as Address
  if (value && typeof value === 'object' && 'address' in value && typeof value.address === 'string') {
    return value.address as Address
  }
  return null
}

function bytesFromSeed(seed: IdlPdaSeed, input: Record<string, unknown>): ReadonlyUint8Array | null {
  if (seed.kind === 'const') {
    if (!seed.value)
      return null
    return Uint8Array.from(seed.value)
  }

  const path = seed.path?.split('.').pop()
  if (!path)
    return null
  const value = input[toCamelCase(path)]

  if (seed.kind === 'account') {
    const resolvedAddress = addressFromValue(value)
    return resolvedAddress ? getAddressEncoder().encode(resolvedAddress) : null
  }

  if (seed.kind === 'arg') {
    if (value instanceof Uint8Array)
      return value
    if (typeof value === 'string')
      return new TextEncoder().encode(value)
    if (typeof value === 'number')
      return Uint8Array.of(value)
    return null
  }

  return null
}

function programAddressFromPda(pda: IdlPda, fallbackProgramAddress: Address): Address | null {
  if (!pda.program)
    return fallbackProgramAddress
  const bytes = bytesFromSeed(pda.program, {})
  return bytes ? getAddressDecoder().decode(bytes) : null
}

async function tryDerivePda({
  pda,
  input,
  programAddress,
}: {
  pda: IdlPda
  input: Record<string, unknown>
  programAddress: Address
}): Promise<Address | null> {
  const pdaProgramAddress = programAddressFromPda(pda, programAddress)
  if (!pdaProgramAddress)
    return null

  const seeds: ReadonlyUint8Array[] = []
  for (const seed of pda.seeds) {
    const bytes = bytesFromSeed(seed, input)
    if (!bytes)
      return null
    seeds.push(bytes)
  }

  const [derived] = await getProgramDerivedAddress({
    programAddress: pdaProgramAddress,
    seeds,
  })
  return derived
}

async function buildInput(
  instruction: IdlInstruction,
  options: Record<string, unknown>,
  globals: GlobalOptions,
): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {}
  const accounts = flattenAccounts(instruction.accounts)
  const requireRealSigners = globals.mode !== 'print'
  const programAddress = globals.programId
    ? parseAddress(globals.programId, '--program-id')
    : generated.NTBUNDLE_PROGRAM_ADDRESS

  for (const arg of instruction.args) {
    const raw = optionValue(options, arg.name)
    if (raw == null) {
      throw new CliError(`--${toKebabCase(arg.name)} is required`)
    }
    input[toCamelCase(arg.name)] = parseValue(arg.type, raw, `--${toKebabCase(arg.name)}`)
  }

  for (const account of accounts) {
    const inputName = toCamelCase(account.name)
    const flag = toKebabCase(account.name)
    const rawAddress = optionValue(options, account.name)
    const keypairPath = optionValue(options, `${account.name}_keypair`)

    if (account.signer) {
      if (rawAddress || keypairPath || requireRealSigners) {
        input[inputName] = await resolveInstructionSigner({
          name: flag,
          addressValue: rawAddress,
          keypairPath,
          requireKeypair: requireRealSigners,
        })
      }
      continue
    }

    if (rawAddress) {
      input[inputName] = parseAddress(rawAddress, `--${flag}`)
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const account of accounts) {
      const inputName = toCamelCase(account.name)
      if (!account.pda || input[inputName] != null)
        continue
      const derived = await tryDerivePda({ pda: account.pda, input, programAddress })
      if (derived) {
        input[inputName] = derived
        changed = true
      }
    }
  }

  return input
}

async function runInstruction(
  instruction: IdlInstruction,
  commandOptions: Record<string, unknown>,
  globals: GlobalOptions,
): Promise<void> {
  const { fn } = getBuilder(instruction)
  const input = await buildInput(instruction, commandOptions, globals)
  const config = globals.programId ? { programAddress: parseAddress(globals.programId, '--program-id') } : undefined
  const built = (await fn(input, config)) as CliInstruction

  if (globals.mode === 'print') {
    printJson(instructionToJson(instruction.name, built))
    return
  }

  if (!globals.feePayerKeypair) {
    throw new CliError('--fee-payer-keypair <path> is required for simulate / execute mode')
  }
  const feePayer = await loadKeypairSigner(globals.feePayerKeypair)

  if (globals.mode === 'simulate') {
    printJson(
      await simulateInstructionTransaction({
        instruction: built,
        feePayer,
        options: globals,
      }),
    )
    return
  }

  printJson(
    await executeInstructionTransaction({
      instruction: built,
      feePayer,
      options: globals,
    }),
  )
}

export function registerInstructionCommands(program: Command): void {
  const idl = loadIdl()
  for (const instruction of idl.instructions) {
    const command = program
      .command(toKebabCase(instruction.name))
      .summary(`build ${instruction.name}`)
      .description(
        [
          instruction.docs?.join('\n') ?? `Build and optionally submit ${instruction.name}.`,
          '',
          'Signer accounts accept either --<account> <address> for print mode',
          'or --<account>-keypair <path> for simulate / execute mode.',
          'PDA/default accounts may be omitted when Codama can derive them.',
        ].join('\n'),
      )
      .action(async (options: Record<string, unknown>) => {
        await runInstruction(instruction, options, program.opts<GlobalOptions>())
      })

    for (const account of flattenAccounts(instruction.accounts)) {
      addAccountOptions(command, account)
    }
    addArgOptions(command, instruction)
  }
}
