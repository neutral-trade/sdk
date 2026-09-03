import {
  AccountRole,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type Instruction,
  type ProgramDerivedAddress,
} from "@solana/kit";

const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");

/**
 * SPL Associated Token Account program. Codama cannot derive PDAs owned by an
 * external program, so this helper is hand-written. It mirrors the hardcoded
 * derivation the generated `requestDeposit` builder performs internally for
 * the pending-deposit token account.
 */
export const ASSOCIATED_TOKEN_PROGRAM_ADDRESS =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" as Address<"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL">;

export const TOKEN_PROGRAM_ADDRESS =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address<"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA">;

/**
 * Builds a Classic Token Program ATA create that succeeds when the account
 * already exists. `payer` must sign the transaction assembled by the caller.
 */
export function createAssociatedTokenAccountIdempotentInstruction(input: {
  ata: Address;
  mint: Address;
  owner: Address;
  payer: Address;
}): Instruction {
  return {
    accounts: [
      { address: input.payer, role: AccountRole.WRITABLE_SIGNER },
      { address: input.ata, role: AccountRole.WRITABLE },
      { address: input.owner, role: AccountRole.READONLY },
      { address: input.mint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data: new Uint8Array([1]),
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  };
}

/**
 * Derives the associated token account for `owner` and `mint`.
 * Works for PDA owners as well (the derivation is curve-agnostic).
 */
export async function findAssociatedTokenPda(seeds: {
  owner: Address;
  mint: Address;
  tokenProgram?: Address;
}): Promise<ProgramDerivedAddress> {
  const addressEncoder = getAddressEncoder();
  return await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [
      addressEncoder.encode(seeds.owner),
      addressEncoder.encode(seeds.tokenProgram ?? TOKEN_PROGRAM_ADDRESS),
      addressEncoder.encode(seeds.mint),
    ],
  });
}

/** Uses the Classic Token Program for both derivation and account creation. */
export async function buildEnsureAssociatedTokenAccountInstruction(input: {
  owner: Address;
  mint: Address;
  payer: Address;
}): Promise<Instruction> {
  const [ata] = await findAssociatedTokenPda({
    owner: input.owner,
    mint: input.mint,
  });
  return createAssociatedTokenAccountIdempotentInstruction({ ...input, ata });
}
