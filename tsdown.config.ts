import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/generated/index.ts',
  ],
  dts: true,
  exports: true,
  publint: true,
})
