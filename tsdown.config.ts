import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
  ],
  dts: true,
  exports: true,
  publint: true,
  external: [
    '@solana/web3.js',
    '@coral-xyz/anchor-29',
    '@coral-xyz/anchor-32',
    '@drift-labs/sdk',
    '@drift-labs/vaults-sdk',
  ],
})
