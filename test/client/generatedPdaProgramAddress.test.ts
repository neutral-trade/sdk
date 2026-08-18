import { createNoopSigner } from "@solana/kit";
import { expect } from "chai";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

import {
  findCloseUserBundleAccountUserBundleAccountPda,
  findReferrerAccountPda,
  findReferrerUserBundleAccountPda,
  getInitializeBundleDepositorInstructionAsync,
  getRegisterReferrerInstructionAsync,
} from "../../src/generated";
import { fakeAddress } from "./testHelpers";

const CUSTOM_PROGRAM_ADDRESS = fakeAddress(90);

describe("generated PDA program addresses", () => {
  it("forwards the configured program address in registerReferrer", async () => {
    const bundleAccount = fakeAddress(91);
    const referrer = createNoopSigner(fakeAddress(92));
    const seeds = {
      bundleAccount,
      referrer: referrer.address,
    };
    const customInstruction = await getRegisterReferrerInstructionAsync(
      { bundleAccount, referrer },
      { programAddress: CUSTOM_PROGRAM_ADDRESS },
    );
    const defaultInstruction = await getRegisterReferrerInstructionAsync({
      bundleAccount,
      referrer,
    });
    const [customReferrerAccount] = await findReferrerAccountPda(seeds, {
      programAddress: CUSTOM_PROGRAM_ADDRESS,
    });
    const [defaultReferrerAccount] = await findReferrerAccountPda(seeds);
    const [customReferrerUserBundleAccount] =
      await findReferrerUserBundleAccountPda(seeds, {
        programAddress: CUSTOM_PROGRAM_ADDRESS,
      });
    const [defaultReferrerUserBundleAccount] =
      await findReferrerUserBundleAccountPda(seeds);

    expect(customInstruction.accounts[1].address).to.equal(
      customReferrerAccount,
    );
    expect(customInstruction.accounts[3].address).to.equal(
      customReferrerUserBundleAccount,
    );
    expect(customReferrerAccount).not.to.equal(defaultReferrerAccount);
    expect(customReferrerUserBundleAccount).not.to.equal(
      defaultReferrerUserBundleAccount,
    );
    expect(defaultInstruction.accounts[1].address).to.equal(
      defaultReferrerAccount,
    );
    expect(defaultInstruction.accounts[3].address).to.equal(
      defaultReferrerUserBundleAccount,
    );
  });

  it("forwards the configured program address in initializeBundleDepositor", async () => {
    const bundleAccount = fakeAddress(93);
    const payer = createNoopSigner(fakeAddress(94));
    const authority = createNoopSigner(fakeAddress(95));
    const seeds = {
      authority: authority.address,
      bundleAccount,
    };
    const customInstruction =
      await getInitializeBundleDepositorInstructionAsync(
        { authority, bundleAccount, payer },
        { programAddress: CUSTOM_PROGRAM_ADDRESS },
      );
    const defaultInstruction =
      await getInitializeBundleDepositorInstructionAsync({
        authority,
        bundleAccount,
        payer,
      });
    const [customUserBundleAccount] =
      await findCloseUserBundleAccountUserBundleAccountPda(seeds, {
        programAddress: CUSTOM_PROGRAM_ADDRESS,
      });
    const [defaultUserBundleAccount] =
      await findCloseUserBundleAccountUserBundleAccountPda(seeds);

    expect(customInstruction.accounts[4].address).to.equal(
      customUserBundleAccount,
    );
    expect(customUserBundleAccount).not.to.equal(defaultUserBundleAccount);
    expect(defaultInstruction.accounts[4].address).to.equal(
      defaultUserBundleAccount,
    );
  });

  it("keeps every imported PDA helper call wired to programAddress", async () => {
    if (typeof __dirname === "undefined") {
      // Regeneration drift can only be introduced in bundle-sc, where this
      // test always runs under ts-mocha (CJS). Downstream vitest runs may be
      // ESM without __dirname; the behavior tests above still apply there.
      return;
    }
    const instructionsDirectory = resolve(
      __dirname,
      "../../src/generated/instructions",
    );
    const fileNames = (await readdir(instructionsDirectory))
      .filter((fileName) => fileName.endsWith(".ts"))
      .sort();
    let pdaCallSites = 0;

    for (const fileName of fileNames) {
      const filePath = resolve(instructionsDirectory, fileName);
      const source = await readFile(filePath, "utf8");
      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      const importedPdaNames = new Set<string>();

      for (const statement of sourceFile.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          statement.moduleSpecifier.text !== "../pdas"
        ) {
          continue;
        }

        const namedBindings = statement.importClause?.namedBindings;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
          for (const importedName of namedBindings.elements) {
            importedPdaNames.add(importedName.name.text);
          }
        }
      }

      function visit(node: ts.Node): void {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          importedPdaNames.has(node.expression.text)
        ) {
          pdaCallSites += 1;
          const { line } = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
          );
          const hasConfigOnlyArgument =
            node.arguments.length === 1 &&
            ts.isObjectLiteralExpression(node.arguments[0]) &&
            node.arguments[0].properties.some(
              (property) =>
                (ts.isShorthandPropertyAssignment(property) &&
                  property.name.text === "programAddress") ||
                (ts.isPropertyAssignment(property) &&
                  property.name.getText() === "programAddress"),
            );
          expect(
            node.arguments.length >= 2 || hasConfigOnlyArgument,
            `${fileName}:${line + 1} ${node.expression.text}`,
          ).to.equal(true);
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    }

    expect(pdaCallSites).to.be.greaterThan(0);
  });
});
