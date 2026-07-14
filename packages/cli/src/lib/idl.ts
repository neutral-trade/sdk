import ntbundleIdl from '@neutral-trade/sdk/idl'

export type IdlType
  = | string
    | { array: [IdlType, number] }
    | { option: IdlType }
    | { vec: IdlType }
    | { defined: unknown }

export interface IdlArg {
  name: string
  type: IdlType
}

export interface IdlAccount {
  name: string
  writable?: boolean
  signer?: boolean
  optional?: boolean
  address?: string
  pda?: IdlPda
  accounts?: IdlAccount[]
}

export interface IdlPdaSeed {
  kind: 'const' | 'account' | 'arg'
  value?: number[]
  path?: string
}

export interface IdlPda {
  seeds: IdlPdaSeed[]
  program?: IdlPdaSeed
}

export interface IdlInstruction {
  name: string
  docs?: string[]
  accounts: IdlAccount[]
  args: IdlArg[]
}

export interface Idl {
  address?: string
  instructions: IdlInstruction[]
}

export function loadIdl(): Idl {
  return ntbundleIdl as unknown as Idl
}

export function flattenAccounts(accounts: readonly IdlAccount[]): IdlAccount[] {
  const out: IdlAccount[] = []
  for (const account of accounts) {
    if (account.accounts) {
      out.push(...flattenAccounts(account.accounts))
    }
    else {
      out.push(account)
    }
  }
  return out
}

export function describeIdlType(type: IdlType): string {
  if (typeof type === 'string')
    return type
  if ('array' in type)
    return `[${describeIdlType(type.array[0])}; ${type.array[1]}]`
  if ('option' in type)
    return `option<${describeIdlType(type.option)}>`
  if ('vec' in type)
    return `vec<${describeIdlType(type.vec)}>`
  return 'defined'
}
