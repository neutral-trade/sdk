import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Workspace packages own their test runners; this config covers the root SDK only.
    include: ['test/**/*.test.ts'],
    globals: true,
    server: {
      deps: {
        inline: ['vitest-package-exports'],
      },
    },
  },
})
