import type { Address, ReadonlyUint8Array, Transaction } from '@solana/kit'
import type {
  AttributionUnavailableReason,
  WidgetCluster,
  WidgetOperationRequestMessage,
} from './protocol'
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  findReferrerAccountPda,
  findReferrerUserBundleAccountPda,
  findRequestBundleSwitchUserBundleAccountPda,
  getDefaultBundleProgramIdByCluster,
  getInitializeBundleDepositorInstructionDataDecoder,
  getRequestDepositInstructionDataDecoder,
  getRequestWithdrawalInstructionDataDecoder,
  getSetUserReferrerInstructionDataDecoder,
  INITIALIZE_BUNDLE_DEPOSITOR_DISCRIMINATOR,
  REQUEST_DEPOSIT_DISCRIMINATOR,
  REQUEST_WITHDRAWAL_DISCRIMINATOR,
  SET_USER_REFERRER_DISCRIMINATOR,
  TOKEN_PROGRAM_ADDRESS,
} from '@neutral-trade/sdk'
import {
  address,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  getTransactionEncoder,
} from '@solana/kit'

const COMPUTE_BUDGET_PROGRAM_ADDRESS = address(
  'ComputeBudget111111111111111111111111111111',
)
const SYSTEM_PROGRAM_ADDRESS = address('11111111111111111111111111111111')
const RENT_SYSVAR_ADDRESS = address('SysvarRent111111111111111111111111111111111')
const MAX_TRANSACTION_BYTES = 1_232
const SET_COMPUTE_UNIT_LIMIT_DISCRIMINATOR = 2
const SET_COMPUTE_UNIT_PRICE_DISCRIMINATOR = 3

export const DEFAULT_WIDGET_VERIFIER_LIMITS = Object.freeze({
  maxComputeUnitLimit: 1_400_000,
  maxComputeUnitPriceMicroLamports: 1_000_000n,
})

export interface WidgetVerifierLimits {
  maxComputeUnitLimit?: number
  maxComputeUnitPriceMicroLamports?: bigint
}

export type WidgetTransactionVerificationErrorCode
  = | 'address-lookup-table'
    | 'amount-mismatch'
    | 'instruction-not-allowed'
    | 'invalid-associated-token-account'
    | 'invalid-fee-payer'
    | 'invalid-instruction'
    | 'invalid-referrer'
    | 'invalid-signature-slot'
    | 'invalid-signer'
    | 'invalid-transaction'
    | 'operation-mismatch'
    | 'priority-fee-too-high'
    | 'stale-blockhash'
    | 'unsupported-transaction-version'
    | 'vault-mismatch'
    | 'vault-not-allowed'
    | 'wallet-mismatch'

export class WidgetTransactionVerificationError extends Error {
  readonly code: WidgetTransactionVerificationErrorCode

  constructor(code: WidgetTransactionVerificationErrorCode, message: string) {
    super(message)
    this.name = 'WidgetTransactionVerificationError'
    this.code = code
  }
}

interface DecodedInstruction {
  accounts: Array<Address>
  data: ReadonlyUint8Array
  programAddress: Address
}

export interface VerifiedWidgetTransactionBase {
  blockhash: string
  messageBytes: ReadonlyUint8Array
  transaction: Transaction
  transactionVersion: 'legacy' | 0
  user: Address
  vault: Address
  wireTransaction: Uint8Array
}

export interface VerifiedDepositTransaction extends VerifiedWidgetTransactionBase {
  amount: bigint
  attribution:
    | {
      status: 'applied'
      referrer: Address
    }
    | {
      status: 'unavailable'
      reason: AttributionUnavailableReason
    }
  operation: 'deposit'
}

export interface VerifiedWithdrawTransaction extends VerifiedWidgetTransactionBase {
  operation: 'withdraw'
  sharesAmount: bigint
}

export type VerifiedWidgetTransaction
  = | VerifiedDepositTransaction
    | VerifiedWithdrawTransaction

export interface VerifyWidgetTransactionInput {
  allowedVaults: ReadonlyArray<string>
  cluster: WidgetCluster
  expectedReferrer?: string
  isBlockhashValid: (blockhash: string) => Promise<boolean>
  request: WidgetOperationRequestMessage
  verifierLimits?: WidgetVerifierLimits
  walletAddress: string
  wireTransaction: Uint8Array
}

function fail(
  code: WidgetTransactionVerificationErrorCode,
  message: string,
): never {
  throw new WidgetTransactionVerificationError(code, message)
}

function bytesEqual(
  first: ReadonlyUint8Array,
  second: ReadonlyUint8Array,
): boolean {
  return first.length === second.length
    && first.every((value, index) => value === second[index])
}

function assertAddress(
  actual: Address | undefined,
  expected: Address,
  code: WidgetTransactionVerificationErrorCode,
  label: string,
): void {
  if (actual !== expected)
    fail(code, `${label} must be ${expected}; received ${actual ?? 'missing'}`)
}

function assertInstructionShape(
  instruction: DecodedInstruction,
  expectedAccountCount: number,
  expectedDataLength: number,
  discriminator: ReadonlyUint8Array,
  name: string,
): void {
  if (instruction.accounts.length !== expectedAccountCount) {
    fail(
      'invalid-instruction',
      `${name} must have ${expectedAccountCount} accounts; received ${instruction.accounts.length}`,
    )
  }
  if (
    instruction.data.length !== expectedDataLength
    || !bytesEqual(instruction.data.subarray(0, discriminator.length), discriminator)
  ) {
    fail('invalid-instruction', `${name} instruction data is invalid`)
  }
}

function readU32LittleEndian(data: ReadonlyUint8Array): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true)
}

function readU64LittleEndian(data: ReadonlyUint8Array): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(0, true)
}

function verifyComputeBudgetInstruction(
  instruction: DecodedInstruction,
  limits: Required<WidgetVerifierLimits>,
  observedKinds: Set<number>,
): void {
  if (instruction.accounts.length !== 0)
    fail('invalid-instruction', 'Compute budget instructions cannot have accounts')
  const discriminator = instruction.data[0]
  if (discriminator === undefined || observedKinds.has(discriminator)) {
    fail('invalid-instruction', 'Compute budget instructions must be unique and nonempty')
  }
  observedKinds.add(discriminator)

  if (
    discriminator === SET_COMPUTE_UNIT_LIMIT_DISCRIMINATOR
    && instruction.data.length === 5
  ) {
    const computeUnitLimit = readU32LittleEndian(instruction.data.subarray(1))
    if (computeUnitLimit === 0 || computeUnitLimit > limits.maxComputeUnitLimit) {
      fail(
        'priority-fee-too-high',
        `Compute unit limit ${computeUnitLimit} exceeds the host limit`,
      )
    }
    return
  }

  if (
    discriminator === SET_COMPUTE_UNIT_PRICE_DISCRIMINATOR
    && instruction.data.length === 9
  ) {
    const computeUnitPrice = readU64LittleEndian(instruction.data.subarray(1))
    if (computeUnitPrice > limits.maxComputeUnitPriceMicroLamports) {
      fail(
        'priority-fee-too-high',
        `Compute unit price ${computeUnitPrice} exceeds the host limit`,
      )
    }
    return
  }

  fail('instruction-not-allowed', 'Only compute unit limit and price instructions are allowed')
}

async function verifyAssociatedTokenInstruction(
  instruction: DecodedInstruction,
  user: Address,
): Promise<void> {
  assertInstructionShape(instruction, 6, 1, new Uint8Array([1]), 'createIdempotent')
  assertAddress(instruction.accounts[0], user, 'wallet-mismatch', 'ATA payer')
  assertAddress(instruction.accounts[2], user, 'wallet-mismatch', 'ATA owner')
  assertAddress(instruction.accounts[4], SYSTEM_PROGRAM_ADDRESS, 'invalid-instruction', 'ATA system program')
  assertAddress(instruction.accounts[5], TOKEN_PROGRAM_ADDRESS, 'invalid-instruction', 'ATA token program')

  const associatedTokenAddress = instruction.accounts[1]
  const mint = instruction.accounts[3]
  if (!associatedTokenAddress || !mint)
    fail('invalid-instruction', 'createIdempotent is missing required accounts')
  const [expectedAssociatedTokenAddress] = await findAssociatedTokenPda({
    owner: user,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  })
  assertAddress(
    associatedTokenAddress,
    expectedAssociatedTokenAddress,
    'invalid-associated-token-account',
    'Associated token account',
  )
}

function decodeTransactionOrThrow(wireTransaction: Uint8Array): {
  message: ReturnType<ReturnType<typeof getCompiledTransactionMessageDecoder>['decode']>
  transaction: Transaction
} {
  if (wireTransaction.length === 0 || wireTransaction.length > MAX_TRANSACTION_BYTES) {
    fail(
      'invalid-transaction',
      `Transaction must contain between 1 and ${MAX_TRANSACTION_BYTES} bytes`,
    )
  }

  try {
    const transaction = getTransactionDecoder().decode(wireTransaction)
    const canonicalBytes = getTransactionEncoder().encode(transaction)
    if (!bytesEqual(wireTransaction, canonicalBytes))
      fail('invalid-transaction', 'Transaction wire encoding is not canonical')
    const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes)
    return { message, transaction }
  }
  catch (thrownObject) {
    if (thrownObject instanceof WidgetTransactionVerificationError)
      throw thrownObject
    fail('invalid-transaction', 'Transaction wire bytes could not be decoded')
  }
}

function decodeInstructions(
  staticAccounts: Array<Address>,
  compiledInstructions: ReadonlyArray<{
    accountIndices?: Array<number>
    data?: ReadonlyUint8Array
    programAddressIndex: number
  }>,
): {
  instructions: Array<DecodedInstruction>
  referencedAccountIndexes: Set<number>
} {
  const referencedAccountIndexes = new Set<number>([0])
  const instructions = compiledInstructions.map((compiledInstruction) => {
    const programAddress = staticAccounts[compiledInstruction.programAddressIndex]
    if (!programAddress)
      fail('invalid-instruction', 'Instruction program address index is out of bounds')
    referencedAccountIndexes.add(compiledInstruction.programAddressIndex)

    const accounts = (compiledInstruction.accountIndices ?? []).map((accountIndex) => {
      const accountAddress = staticAccounts[accountIndex]
      if (!accountAddress)
        fail('invalid-instruction', 'Instruction account index is out of bounds')
      referencedAccountIndexes.add(accountIndex)
      return accountAddress
    })
    return {
      accounts,
      data: compiledInstruction.data ?? new Uint8Array(),
      programAddress,
    }
  })
  return { instructions, referencedAccountIndexes }
}

function addWritableAccounts(
  writableAccounts: Set<Address>,
  instruction: DecodedInstruction,
  accountIndexes: ReadonlyArray<number>,
): void {
  for (const accountIndex of accountIndexes) {
    const account = instruction.accounts[accountIndex]
    if (!account)
      fail('invalid-instruction', 'Writable instruction account is missing')
    writableAccounts.add(account)
  }
}

function getWritableStaticAccounts(
  staticAccounts: Array<Address>,
  header: {
    numReadonlyNonSignerAccounts: number
    numReadonlySignerAccounts: number
    numSignerAccounts: number
  },
): Set<Address> {
  const firstReadonlySignerIndex
    = header.numSignerAccounts - header.numReadonlySignerAccounts
  const firstReadonlyNonSignerIndex
    = staticAccounts.length - header.numReadonlyNonSignerAccounts
  return new Set(staticAccounts.filter((_account, index) => (
    index < firstReadonlySignerIndex
    || (
      index >= header.numSignerAccounts
      && index < firstReadonlyNonSignerIndex
    )
  )))
}

export async function verifyWidgetTransaction({
  allowedVaults,
  cluster,
  expectedReferrer,
  isBlockhashValid,
  request,
  verifierLimits,
  walletAddress,
  wireTransaction,
}: VerifyWidgetTransactionInput): Promise<VerifiedWidgetTransaction> {
  const user = address(request.user)
  const connectedWallet = address(walletAddress)
  const vault = address(request.vault)
  const configuredReferrer = expectedReferrer === undefined
    ? undefined
    : address(expectedReferrer)
  if (user !== connectedWallet) {
    fail(
      'wallet-mismatch',
      `Operation user ${user} does not match connected wallet ${connectedWallet}`,
    )
  }
  if (!allowedVaults.includes(vault))
    fail('vault-not-allowed', `Vault ${vault} is not enabled for this widget`)
  if (
    request.operation === 'deposit'
    && request.attribution.status === 'applied'
    && configuredReferrer !== undefined
  ) {
    const requestedReferrer = address(request.attribution.referrer)
    if (requestedReferrer !== configuredReferrer) {
      fail(
        'invalid-referrer',
        `Deposit referrer ${requestedReferrer} does not match configured builderAddress ${configuredReferrer}`,
      )
    }
  }

  const { message, transaction } = decodeTransactionOrThrow(wireTransaction)
  if (message.version !== 'legacy' && message.version !== 0) {
    fail(
      'unsupported-transaction-version',
      `Transaction version ${message.version} is not supported`,
    )
  }
  if (
    'addressTableLookups' in message
    && message.addressTableLookups
    && message.addressTableLookups.length > 0
  ) {
    fail('address-lookup-table', 'Address lookup tables are not allowed')
  }

  if (message.header.numSignerAccounts !== 1 || message.header.numReadonlySignerAccounts !== 0)
    fail('invalid-signer', 'The connected wallet must be the only required signer')
  assertAddress(message.staticAccounts[0], connectedWallet, 'invalid-fee-payer', 'Fee payer')

  const signatureEntries = Object.entries(transaction.signatures)
  if (signatureEntries.length !== 1 || signatureEntries[0]?.[0] !== connectedWallet)
    fail('invalid-signer', 'The connected wallet must own the only signature slot')
  if (signatureEntries[0]?.[1] !== null)
    fail('invalid-signature-slot', 'Every signature slot must be zero-filled before verification')

  const uniqueAccounts = new Set(message.staticAccounts)
  if (uniqueAccounts.size !== message.staticAccounts.length)
    fail('invalid-transaction', 'Static transaction accounts must be unique')
  if (
    message.header.numReadonlyNonSignerAccounts
    > message.staticAccounts.length - message.header.numSignerAccounts
  ) {
    fail('invalid-transaction', 'Transaction header account counts are inconsistent')
  }

  const { instructions, referencedAccountIndexes } = decodeInstructions(
    message.staticAccounts,
    message.instructions,
  )
  if (referencedAccountIndexes.size !== message.staticAccounts.length)
    fail('invalid-transaction', 'Transaction contains unreferenced static accounts')

  const bundleProgramAddress = address(getDefaultBundleProgramIdByCluster(cluster))
  const [userBundleAccount] = await findRequestBundleSwitchUserBundleAccountPda(
    { user, bundleAccount: vault },
    { programAddress: bundleProgramAddress },
  )
  const limits: Required<WidgetVerifierLimits> = {
    maxComputeUnitLimit:
      verifierLimits?.maxComputeUnitLimit
      ?? DEFAULT_WIDGET_VERIFIER_LIMITS.maxComputeUnitLimit,
    maxComputeUnitPriceMicroLamports:
      verifierLimits?.maxComputeUnitPriceMicroLamports
      ?? DEFAULT_WIDGET_VERIFIER_LIMITS.maxComputeUnitPriceMicroLamports,
  }
  const computeBudgetInstructionKinds = new Set<number>()
  const expectedWritableAccounts = new Set<Address>([user])
  const operationInstructions: Array<string> = []
  let observedAmount: bigint | undefined
  let observedSharesAmount: bigint | undefined
  let observedAttribution = false
  let operationInstructionObserved = false

  for (const instruction of instructions) {
    if (instruction.programAddress === COMPUTE_BUDGET_PROGRAM_ADDRESS) {
      if (operationInstructionObserved) {
        fail('invalid-instruction', 'Compute budget instructions must precede operation instructions')
      }
      verifyComputeBudgetInstruction(instruction, limits, computeBudgetInstructionKinds)
      continue
    }
    operationInstructionObserved = true

    if (instruction.programAddress === ASSOCIATED_TOKEN_PROGRAM_ADDRESS) {
      if (request.operation !== 'withdraw') {
        fail('instruction-not-allowed', 'Associated token creation is allowed only for withdrawals')
      }
      await verifyAssociatedTokenInstruction(instruction, user)
      addWritableAccounts(expectedWritableAccounts, instruction, [0, 1])
      operationInstructions.push('createIdempotent')
      continue
    }
    if (instruction.programAddress !== bundleProgramAddress) {
      fail(
        'instruction-not-allowed',
        `Program ${instruction.programAddress} is not allowed`,
      )
    }

    const discriminator = instruction.data.subarray(0, 8)
    if (bytesEqual(discriminator, INITIALIZE_BUNDLE_DEPOSITOR_DISCRIMINATOR)) {
      assertInstructionShape(
        instruction,
        5,
        8,
        INITIALIZE_BUNDLE_DEPOSITOR_DISCRIMINATOR,
        'initializeBundleDepositor',
      )
      getInitializeBundleDepositorInstructionDataDecoder().decode(instruction.data)
      assertAddress(instruction.accounts[0], user, 'wallet-mismatch', 'Depositor payer')
      assertAddress(instruction.accounts[1], user, 'wallet-mismatch', 'Depositor authority')
      assertAddress(instruction.accounts[2], SYSTEM_PROGRAM_ADDRESS, 'invalid-instruction', 'System program')
      assertAddress(instruction.accounts[3], vault, 'vault-mismatch', 'Depositor vault')
      assertAddress(instruction.accounts[4], userBundleAccount, 'invalid-instruction', 'User bundle account')
      addWritableAccounts(expectedWritableAccounts, instruction, [0, 1, 3, 4])
      operationInstructions.push('initializeBundleDepositor')
      continue
    }

    if (bytesEqual(discriminator, SET_USER_REFERRER_DISCRIMINATOR)) {
      if (request.operation !== 'deposit' || request.attribution.status !== 'applied') {
        fail('invalid-referrer', 'setUserReferrer was not requested')
      }
      assertInstructionShape(
        instruction,
        5,
        8,
        SET_USER_REFERRER_DISCRIMINATOR,
        'setUserReferrer',
      )
      getSetUserReferrerInstructionDataDecoder().decode(instruction.data)
      const referrer = configuredReferrer ?? address(request.attribution.referrer)
      if (referrer === user)
        fail('invalid-referrer', 'A user cannot refer their own account')
      const [[referrerAccount], [referrerUserBundleAccount]] = await Promise.all([
        findReferrerAccountPda(
          { bundleAccount: vault, referrer },
          { programAddress: bundleProgramAddress },
        ),
        findReferrerUserBundleAccountPda(
          { bundleAccount: vault, referrer },
          { programAddress: bundleProgramAddress },
        ),
      ])
      assertAddress(instruction.accounts[0], user, 'wallet-mismatch', 'Referral user')
      assertAddress(instruction.accounts[1], vault, 'vault-mismatch', 'Referral vault')
      assertAddress(instruction.accounts[2], userBundleAccount, 'invalid-instruction', 'User bundle account')
      assertAddress(instruction.accounts[3], referrerAccount, 'invalid-referrer', 'Referrer account')
      assertAddress(
        instruction.accounts[4],
        referrerUserBundleAccount,
        'invalid-referrer',
        'Referrer user bundle account',
      )
      addWritableAccounts(expectedWritableAccounts, instruction, [2])
      observedAttribution = true
      operationInstructions.push('setUserReferrer')
      continue
    }

    if (bytesEqual(discriminator, REQUEST_DEPOSIT_DISCRIMINATOR)) {
      assertInstructionShape(
        instruction,
        12,
        16,
        REQUEST_DEPOSIT_DISCRIMINATOR,
        'requestDeposit',
      )
      const decoded = getRequestDepositInstructionDataDecoder().decode(instruction.data)
      assertAddress(instruction.accounts[0], user, 'wallet-mismatch', 'Deposit user')
      assertAddress(instruction.accounts[8], vault, 'vault-mismatch', 'Deposit vault')
      assertAddress(instruction.accounts[4], userBundleAccount, 'invalid-instruction', 'User bundle account')
      assertAddress(instruction.accounts[10], TOKEN_PROGRAM_ADDRESS, 'invalid-instruction', 'Token program')
      assertAddress(instruction.accounts[11], SYSTEM_PROGRAM_ADDRESS, 'invalid-instruction', 'System program')
      addWritableAccounts(expectedWritableAccounts, instruction, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      observedAmount = decoded.amount
      operationInstructions.push('requestDeposit')
      continue
    }

    if (bytesEqual(discriminator, REQUEST_WITHDRAWAL_DISCRIMINATOR)) {
      assertInstructionShape(
        instruction,
        8,
        24,
        REQUEST_WITHDRAWAL_DISCRIMINATOR,
        'requestWithdrawal',
      )
      const decoded = getRequestWithdrawalInstructionDataDecoder().decode(instruction.data)
      assertAddress(instruction.accounts[0], user, 'wallet-mismatch', 'Withdrawal user')
      assertAddress(instruction.accounts[2], vault, 'vault-mismatch', 'Withdrawal vault')
      assertAddress(instruction.accounts[1], userBundleAccount, 'invalid-instruction', 'User bundle account')
      assertAddress(instruction.accounts[5], TOKEN_PROGRAM_ADDRESS, 'invalid-instruction', 'Token program')
      assertAddress(instruction.accounts[6], SYSTEM_PROGRAM_ADDRESS, 'invalid-instruction', 'System program')
      assertAddress(instruction.accounts[7], RENT_SYSVAR_ADDRESS, 'invalid-instruction', 'Rent sysvar')
      addWritableAccounts(expectedWritableAccounts, instruction, [0, 1, 2, 3, 4])
      observedSharesAmount = decoded.sharesAmount
      operationInstructions.push('requestWithdrawal')
      continue
    }

    fail('instruction-not-allowed', 'ntbundle instruction discriminator is not allowed')
  }

  const writableStaticAccounts = getWritableStaticAccounts(
    message.staticAccounts,
    message.header,
  )
  if (
    writableStaticAccounts.size !== expectedWritableAccounts.size
    || [...writableStaticAccounts].some(account => !expectedWritableAccounts.has(account))
  ) {
    fail(
      'invalid-instruction',
      'Transaction writable account privileges do not match the allowed instructions',
    )
  }

  if (!(await isBlockhashValid(message.lifetimeToken))) {
    fail(
      'stale-blockhash',
      'Transaction blockhash is stale; request a fresh transaction build',
    )
  }

  if (request.operation === 'deposit') {
    const expectedAmount = BigInt(request.amount)
    const expectedOperationInstructions = [
      ...(operationInstructions[0] === 'initializeBundleDepositor'
        ? ['initializeBundleDepositor']
        : []),
      ...(request.attribution.status === 'applied' ? ['setUserReferrer'] : []),
      'requestDeposit',
    ]
    if (
      operationInstructions.length !== expectedOperationInstructions.length
      || operationInstructions.some(
        (instructionName, index) => instructionName !== expectedOperationInstructions[index],
      )
      || observedSharesAmount !== undefined
    ) {
      fail('operation-mismatch', 'Transaction instruction sequence does not match a deposit')
    }
    if (observedAmount !== expectedAmount) {
      fail(
        'amount-mismatch',
        `Deposit amount must be ${expectedAmount}; received ${observedAmount ?? 'missing'}`,
      )
    }
    if (observedAttribution !== (request.attribution.status === 'applied'))
      fail('invalid-referrer', 'Transaction attribution does not match the deposit request')

    return {
      amount: observedAmount,
      attribution: request.attribution.status === 'applied'
        ? { status: 'applied', referrer: address(request.attribution.referrer) }
        : request.attribution,
      blockhash: message.lifetimeToken,
      messageBytes: transaction.messageBytes,
      operation: 'deposit',
      transaction,
      transactionVersion: message.version,
      user,
      vault,
      wireTransaction: wireTransaction.slice(),
    }
  }

  const expectedWithdrawalInstructions = [
    ...(operationInstructions[0] === 'createIdempotent' ? ['createIdempotent'] : []),
    'requestWithdrawal',
  ]
  if (
    operationInstructions.length !== expectedWithdrawalInstructions.length
    || operationInstructions.some(
      (instructionName, index) => instructionName !== expectedWithdrawalInstructions[index],
    )
    || observedAmount !== undefined
  ) {
    fail('operation-mismatch', 'Transaction instruction sequence does not match a withdrawal')
  }
  const expectedSharesAmount = BigInt(request.sharesAmount)
  if (observedSharesAmount !== expectedSharesAmount) {
    fail(
      'amount-mismatch',
      `Withdrawal shares amount must be ${expectedSharesAmount}; received ${observedSharesAmount ?? 'missing'}`,
    )
  }

  return {
    blockhash: message.lifetimeToken,
    messageBytes: transaction.messageBytes,
    operation: 'withdraw',
    sharesAmount: observedSharesAmount,
    transaction,
    transactionVersion: message.version,
    user,
    vault,
    wireTransaction: wireTransaction.slice(),
  }
}
