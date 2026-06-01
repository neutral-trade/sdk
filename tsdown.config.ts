import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/internal.ts',
  ],
  dts: true,
  exports: true,
  publint: true,
  external: [
    '@solana/web3.js',
    '@coral-xyz/anchor',
  ],
})
