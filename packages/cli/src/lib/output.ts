import type { AccountMeta, Instruction } from '@solana/kit'
import { Buffer } from 'node:buffer'

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2))
}

export function instructionToJson(
  name: string,
  instruction: Instruction & { accounts?: readonly AccountMeta[], data?: Uint8Array },
): unknown {
  return {
    name,
    programAddress: instruction.programAddress,
    accounts: (instruction.accounts ?? []).map((account: AccountMeta) => ({
      address: account.address,
      role: account.role,
    })),
    dataBase64: instruction.data ? Buffer.from(instruction.data).toString('base64') : '',
  }
}
