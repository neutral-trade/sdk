import {
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type ProgramDerivedAddress,
} from "@solana/kit";

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
