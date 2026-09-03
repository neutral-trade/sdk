import { AccountRole } from "@solana/kit";
import { expect } from "chai";

import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  buildEnsureAssociatedTokenAccountInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from "../../src/extensions/ata";
import { fakeAddress } from "./testHelpers";

const SYSTEM_PROGRAM_ADDRESS = fakeAddress(0);

describe("associated token account extensions", () => {
  it("builds the idempotent create instruction", () => {
    const payer = fakeAddress(20);
    const ata = fakeAddress(21);
    const owner = fakeAddress(22);
    const mint = fakeAddress(23);

    const instruction = createAssociatedTokenAccountIdempotentInstruction({
      ata,
      mint,
      owner,
      payer,
    });

    expect(instruction.programAddress).to.equal(
      ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    );
    expect(instruction.accounts).to.deep.equal([
      { address: payer, role: AccountRole.WRITABLE_SIGNER },
      { address: ata, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.READONLY },
      { address: mint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ]);
    expect(instruction.data).to.deep.equal(new Uint8Array([1]));
  });

  it("derives the associated token account for the convenience builder", async () => {
    const payer = fakeAddress(24);
    const owner = fakeAddress(25);
    const mint = fakeAddress(26);
    const [ata] = await findAssociatedTokenPda({ owner, mint });

    const instruction = await buildEnsureAssociatedTokenAccountInstruction({
      mint,
      owner,
      payer,
    });

    expect(instruction).to.deep.equal(
      createAssociatedTokenAccountIdempotentInstruction({
        ata,
        mint,
        owner,
        payer,
      }),
    );
  });
});
