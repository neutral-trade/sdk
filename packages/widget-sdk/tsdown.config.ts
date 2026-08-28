import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/protocol.ts',
    'src/react.tsx',
  ],
  dts: true,
  exports: true,
  publint: true,
  // The package executes in partner browsers, including framework-free embeds.
  target: 'es2022',
})
