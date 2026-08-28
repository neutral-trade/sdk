import type { Address, Instruction, SignatureBytes, Transaction } from '@solana/kit'
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  findReferrerAccountPda,
  findReferrerUserBundleAccountPda,
  findRequestBundleSwitchUserBundleAccountPda,
  getDefaultBundleProgramIdByCluster,
  getInitializeBundleDepositorInstruction,
  getRequestDepositInstruction,
  getRequestWithdrawalInstruction,
  getSetUserReferrerInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@neutral-trade/sdk'
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getAddressDecoder,
  getBase58Decoder,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  getTransactionDecoder,
  getTransactionEncoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit'

const COMPUTE_BUDGET_PROGRAM_ADDRESS = address(
  'ComputeBudget111111111111111111111111111111',
)
const SYSTEM_PROGRAM_ADDRESS = address('11111111111111111111111111111111')

export const FIXTURE_ADDRESSES = Object.freeze({
  alternateFeePayer: testAddress(2),
  alternateUser: testAddress(3),
  alternateVault: testAddress(4),
  asset: testAddress(5),
  bundleTempData: testAddress(6),
  lookupTable: testAddress(7),
  mint: testAddress(8),
  oracleData: testAddress(9),
  pendingBundleAssetAuthority: testAddress(10),
  pendingDepositTokenAccount: testAddress(11),
  referrer: testAddress(12),
  secondReferrer: testAddress(13),
  treasuryAccount: testAddress(14),
  user: testAddress(15),
  userTokenAccount: testAddress(16),
  vault: testAddress(17),
  wrongProgram: testAddress(18),
})

export const FIXTURE_BLOCKHASH = blockhash(
  getBase58Decoder().decode(new Uint8Array(32).fill(19)),
)

function testAddress(seed: number): Address {
  return getAddressDecoder().decode(new Uint8Array(32).fill(seed))
}

function createComputeUnitLimitInstruction(units = 300_000): Instruction {
  const data = new Uint8Array(5)
  data[0] = 2
  new DataView(data.buffer).setUint32(1, units, true)
  return { data, programAddress: COMPUTE_BUDGET_PROGRAM_ADDRESS }
}

function createComputeUnitPriceInstruction(microLamports = 5_000n): Instruction {
  const data = new Uint8Array(9)
  data[0] = 3
  new DataView(data.buffer).setBigUint64(1, microLamports, true)
  return { data, programAddress: COMPUTE_BUDGET_PROGRAM_ADDRESS }
}

export function createExtraInstruction(): Instruction {
  return {
    data: new Uint8Array([9, 9, 9]),
    programAddress: FIXTURE_ADDRESSES.wrongProgram,
  }
}

export function compileFixtureTransaction(
  instructions: ReadonlyArray<Instruction>,
  feePayer: Address = FIXTURE_ADDRESSES.user,
): Uint8Array {
  const transactionMessage = appendTransactionMessageInstructions(
    instructions,
    setTransactionMessageLifetimeUsingBlockhash(
      {
        blockhash: FIXTURE_BLOCKHASH,
        lastValidBlockHeight: 50_000n,
      },
      setTransactionMessageFeePayer(
        feePayer,
        createTransactionMessage({ version: 0 }),
      ),
    ),
  )
  return Uint8Array.from(
    getTransactionEncoder().encode(compileTransaction(transactionMessage)),
  )
}

export interface DepositFixtureOptions {
  amount?: bigint
  extraInstructions?: ReadonlyArray<Instruction>
  feePayer?: Address
  includeAttribution?: boolean
  includeComputeBudget?: boolean
  includeInitialize?: boolean
  makeTokenProgramWritable?: boolean
  programAddress?: Address
  referrer?: Address
  stripUserSignerRole?: boolean
  transactionUser?: Address
  vault?: Address
}

export async function createDepositFixture(
  options: DepositFixtureOptions = {},
): Promise<Uint8Array> {
  const amount = options.amount ?? 8_765_432n
  const programAddress = options.programAddress
    ?? address(getDefaultBundleProgramIdByCluster('devnet'))
  const transactionUser = options.transactionUser ?? FIXTURE_ADDRESSES.user
  const vault = options.vault ?? FIXTURE_ADDRESSES.vault
  const transactionSigner = createNoopSigner(transactionUser)
  const [userBundleAccount] = await findRequestBundleSwitchUserBundleAccountPda(
    { user: transactionUser, bundleAccount: vault },
    { programAddress },
  )
  const instructions: Array<Instruction> = []
  if (options.includeComputeBudget ?? true) {
    instructions.push(
      createComputeUnitLimitInstruction(),
      createComputeUnitPriceInstruction(),
    )
  }
  if (options.includeInitialize) {
    instructions.push(getInitializeBundleDepositorInstruction(
      {
        authority: transactionSigner,
        bundleAccount: vault,
        payer: transactionSigner,
        userBundleAccount,
      },
      { programAddress },
    ))
  }
  if (options.includeAttribution) {
    const referrer = options.referrer ?? FIXTURE_ADDRESSES.referrer
    const [[referrerAccount], [referrerUserBundleAccount]] = await Promise.all([
      findReferrerAccountPda(
        { bundleAccount: vault, referrer },
        { programAddress },
      ),
      findReferrerUserBundleAccountPda(
        { bundleAccount: vault, referrer },
        { programAddress },
      ),
    ])
    instructions.push(getSetUserReferrerInstruction(
      {
        bundleAccount: vault,
        referrerAccount,
        referrerUserBundleAccount,
        user: transactionSigner,
        userBundleAccount,
      },
      { programAddress },
    ))
  }
  const depositInstruction = getRequestDepositInstruction(
    {
      amount,
      assetAddress: FIXTURE_ADDRESSES.asset,
      bundleAccount: vault,
      bundleTempData: FIXTURE_ADDRESSES.bundleTempData,
      oracleData: FIXTURE_ADDRESSES.oracleData,
      pendingBundleAssetAuthority: FIXTURE_ADDRESSES.pendingBundleAssetAuthority,
      pendingDepositTokenAccount: FIXTURE_ADDRESSES.pendingDepositTokenAccount,
      treasuryAccount: FIXTURE_ADDRESSES.treasuryAccount,
      user: transactionSigner,
      userBundleAccount,
      userTokenAccount: FIXTURE_ADDRESSES.userTokenAccount,
    },
    { programAddress },
  )
  instructions.push(...(options.extraInstructions ?? []))
  if (options.stripUserSignerRole || options.makeTokenProgramWritable) {
    instructions.push({
      ...depositInstruction,
      accounts: depositInstruction.accounts.map((account, index) => {
        if (index === 0 && options.stripUserSignerRole)
          return { ...account, role: AccountRole.WRITABLE }
        if (index === 10 && options.makeTokenProgramWritable)
          return { ...account, role: AccountRole.WRITABLE }
        return account
      }),
    })
  }
  else {
    instructions.push(depositInstruction)
  }
  return compileFixtureTransaction(
    instructions,
    options.feePayer ?? FIXTURE_ADDRESSES.user,
  )
}

export interface WithdrawalFixtureOptions {
  includeAssociatedTokenInstruction?: boolean
  sharesAmount?: bigint
  user?: Address
  vault?: Address
}

export async function createWithdrawalFixture(
  options: WithdrawalFixtureOptions = {},
): Promise<Uint8Array> {
  const programAddress = address(getDefaultBundleProgramIdByCluster('devnet'))
  const user = options.user ?? FIXTURE_ADDRESSES.user
  const vault = options.vault ?? FIXTURE_ADDRESSES.vault
  const signer = createNoopSigner(user)
  const [userBundleAccount] = await findRequestBundleSwitchUserBundleAccountPda(
    { user, bundleAccount: vault },
    { programAddress },
  )
  const instructions: Array<Instruction> = [
    createComputeUnitLimitInstruction(240_000),
    createComputeUnitPriceInstruction(3_000n),
  ]
  if (options.includeAssociatedTokenInstruction) {
    const [associatedTokenAddress] = await findAssociatedTokenPda({
      mint: FIXTURE_ADDRESSES.mint,
      owner: user,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    })
    instructions.push({
      accounts: [
        { address: user, role: AccountRole.WRITABLE_SIGNER },
        { address: associatedTokenAddress, role: AccountRole.WRITABLE },
        { address: user, role: AccountRole.READONLY },
        { address: FIXTURE_ADDRESSES.mint, role: AccountRole.READONLY },
        { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      ],
      data: new Uint8Array([1]),
      programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    })
  }
  instructions.push(getRequestWithdrawalInstruction(
    {
      bundleAccount: vault,
      bundleTempData: FIXTURE_ADDRESSES.bundleTempData,
      oracleData: FIXTURE_ADDRESSES.oracleData,
      sharesAmount: options.sharesAmount ?? 987_654_321n,
      user: signer,
      userBundleAccount,
    },
    { programAddress },
  ))
  return compileFixtureTransaction(instructions, user)
}

export function addAddressLookupTable(wireTransaction: Uint8Array): Uint8Array {
  const transaction = getTransactionDecoder().decode(wireTransaction)
  const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes)
  if (message.version !== 0)
    throw new Error('ALT fixture requires a v0 transaction')
  const messageBytes = getCompiledTransactionMessageEncoder().encode({
    ...message,
    addressTableLookups: [
      {
        lookupTableAddress: FIXTURE_ADDRESSES.lookupTable,
        readonlyIndexes: [0],
        writableIndexes: [],
      },
    ],
  }) as Transaction['messageBytes']
  return Uint8Array.from(getTransactionEncoder().encode({
    ...transaction,
    messageBytes,
  }))
}

export function fillSignatureSlot(wireTransaction: Uint8Array): Uint8Array {
  const transaction = getTransactionDecoder().decode(wireTransaction)
  const signatures = Object.fromEntries(
    Object.keys(transaction.signatures).map(signerAddress => [
      signerAddress,
      new Uint8Array(64).fill(1) as SignatureBytes,
    ]),
  ) as Transaction['signatures']
  return Uint8Array.from(getTransactionEncoder().encode({
    ...transaction,
    signatures,
  }))
}
