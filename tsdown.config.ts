import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/generated/index.ts',
    'src/idl/index.ts',
  ],
  dts: true,
  exports: true,
  publint: true,
})
