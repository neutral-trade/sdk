#!/usr/bin/env node
import { argv } from 'node:process'
import { fileURLToPath } from 'node:url'
import { Command, Option } from 'commander'
import { registerInstructionCommands } from './commands/instructions'
import { reportError } from './lib/errors'

export const TX_MODES = ['print', 'simulate', 'execute'] as const
export type TxMode = (typeof TX_MODES)[number]

export interface GlobalOptions {
  mode: TxMode
  rpcUrl?: string
  feePayerKeypair?: string
  programId?: string
  commitment: 'processed' | 'confirmed' | 'finalized'
  skipPreflight?: boolean
}

export function addGlobalOptions(program: Command): Command {
  return program
    .addOption(
      new Option('--mode <mode>', 'transaction mode')
        .choices([...TX_MODES])
        .default('print'),
    )
    .option('--rpc-url <url>', 'RPC URL for simulate / execute')
    .option('--fee-payer-keypair <path>', 'fee payer keypair JSON path for simulate / execute')
    .option('--program-id <address>', 'override the generated ntbundle program id')
    .addOption(
      new Option('--commitment <commitment>', 'RPC commitment')
        .choices(['processed', 'confirmed', 'finalized'])
        .default('confirmed'),
    )
    .option('--skip-preflight', 'skip preflight checks for execute mode')
}

export function createProgram(): Command {
  const program = new Command()
    .name('ntbundle')
    .description(
      [
        'Neutral Trade ntbundle generated instruction CLI.',
        '',
        'Every command is generated from the ntbundle IDL exported by',
        '@neutral-trade/sdk and dispatches to the matching Codama instruction',
        'builder in @neutral-trade/sdk.',
        '',
        'Modes:',
        '  print     print the instruction JSON without signing or RPC',
        '  simulate  sign and simulate a single-instruction transaction',
        '  execute   sign and submit a single-instruction transaction',
      ].join('\n'),
    )
    .showHelpAfterError('(run with --help for usage)')

  addGlobalOptions(program)
  registerInstructionCommands(program)

  program.addHelpText(
    'after',
    [
      '',
      'Examples:',
      '  $ ntbundle request-deposit --user <pubkey> --user-keypair ~/.config/solana/id.json --user-token-account <pubkey> --treasury-account <pubkey> --asset-address <pubkey> --bundle-account <pubkey> --amount 1000000',
      '  $ ntbundle --mode simulate --rpc-url http://127.0.0.1:8899 --fee-payer-keypair ~/.config/solana/id.json set-fees --manager-keypair ~/.config/solana/id.json --bundle-account <pubkey> --treasury <pubkey> --deposit-fee 0 --withdrawal-fee 0 --performance-fee 0 --management-fee-bps 0',
      '',
      'Run through npm with a leading --:',
      '  $ npm run cli -- request-withdrawal --help',
    ].join('\n'),
  )

  return program
}

const isMain = argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  const userArgv = argv.slice(2)
  const args = userArgv[0] === '--' ? userArgv.slice(1) : userArgv
  createProgram().parseAsync(args, { from: 'user' }).catch(reportError)
}
