import type { IdlType } from './idl'
import { Buffer } from 'node:buffer'
import { address } from '@solana/kit'
import { CliError } from './errors'

const U64_MAX = 18_446_744_073_709_551_615n
const U128_MAX = 340_282_366_920_938_463_463_374_607_431_768_211_455n
const I64_MIN = -9_223_372_036_854_775_808n
const I64_MAX = 9_223_372_036_854_775_807n

export function parseAddress(value: string, flag: string): ReturnType<typeof address> {
  try {
    return address(value)
  }
  catch {
    throw new CliError(`${flag} must be a valid base58 Solana address: ${value}`)
  }
}

function parseInteger(value: string, flag: string): bigint {
  if (!/^-?\d+$/.test(value)) {
    throw new CliError(`${flag} must be an integer: ${value}`)
  }
  return BigInt(value)
}

function boundedNumber(value: string, flag: string, min: number, max: number): number {
  const parsed = parseInteger(value, flag)
  if (parsed < BigInt(min) || parsed > BigInt(max)) {
    throw new CliError(`${flag} must be between ${min} and ${max}: ${value}`)
  }
  return Number(parsed)
}

function boundedBigint(value: string, flag: string, min: bigint, max: bigint): bigint {
  const parsed = parseInteger(value, flag)
  if (parsed < min || parsed > max) {
    throw new CliError(`${flag} must be between ${min} and ${max}: ${value}`)
  }
  return parsed
}

function parseBoolean(value: string, flag: string): boolean {
  if (['true', '1', 'yes'].includes(value.toLowerCase()))
    return true
  if (['false', '0', 'no'].includes(value.toLowerCase()))
    return false
  throw new CliError(`${flag} must be a boolean (true/false): ${value}`)
}

function parseBytes(value: string, flag: string, length?: number): Uint8Array {
  let bytes: Uint8Array
  if (value.startsWith('0x')) {
    const hex = value.slice(2)
    if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
      throw new CliError(`${flag} must be valid hex bytes: ${value}`)
    }
    bytes = Uint8Array.from(Buffer.from(hex, 'hex'))
  }
  else if (value.includes(',')) {
    const parts = value.split(',').map(part => part.trim())
    bytes = Uint8Array.from(
      parts.map((part) => {
        const byte = boundedNumber(part, flag, 0, 255)
        return byte
      }),
    )
  }
  else {
    bytes = new TextEncoder().encode(value)
  }

  if (length != null) {
    if (bytes.length > length) {
      throw new CliError(`${flag} must fit in ${length} bytes`)
    }
    if (bytes.length < length) {
      const padded = new Uint8Array(length)
      padded.set(bytes)
      return padded
    }
  }
  return bytes
}

export function parseValue(type: IdlType, raw: string, flag: string): unknown {
  if (typeof type === 'string') {
    switch (type) {
      case 'bool':
        return parseBoolean(raw, flag)
      case 'pubkey':
      case 'publicKey':
        return parseAddress(raw, flag)
      case 'u8':
        return boundedNumber(raw, flag, 0, 255)
      case 'u16':
        return boundedNumber(raw, flag, 0, 65_535)
      case 'u32':
        return boundedNumber(raw, flag, 0, 4_294_967_295)
      case 'u64':
        return boundedBigint(raw, flag, 0n, U64_MAX)
      case 'u128':
        return boundedBigint(raw, flag, 0n, U128_MAX)
      case 'i64':
        return boundedBigint(raw, flag, I64_MIN, I64_MAX)
      case 'f32':
      case 'f64': {
        const parsed = Number(raw)
        if (!Number.isFinite(parsed)) {
          throw new CliError(`${flag} must be a finite number: ${raw}`)
        }
        return parsed
      }
      case 'string':
        return raw
      case 'bytes':
        return parseBytes(raw, flag)
      default:
        throw new CliError(`${flag} uses unsupported IDL type ${type}`)
    }
  }

  if ('array' in type) {
    const [inner, length] = type.array
    if (inner === 'u8')
      return parseBytes(raw, flag, length)
    throw new CliError(`${flag} uses unsupported array type`)
  }

  if ('option' in type) {
    if (raw === '' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'none') {
      return null
    }
    return parseValue(type.option, raw, flag)
  }

  throw new CliError(`${flag} uses unsupported complex IDL type`)
}
