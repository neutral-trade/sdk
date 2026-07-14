// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    pnpm: true,
    ignores: [
      // The migration README is maintained as release copy, including its examples.
      'README.md',
      'src/generated/**',
      'src/extensions/**',
      'src/idl/**',
      'test/client/**',
    ],
    rules: {
      // Vendored client dependencies intentionally use plain semver outside the workspace catalogs.
      'pnpm/json-enforce-catalog': 'off',
      // Legacy catalog entries remain available for workspace consumers outside this package.
      'pnpm/yaml-no-unused-catalog-item': 'off',
    },
  },
  {
    files: ['src/index.ts'],
    rules: {
      // Keep the explicit registry surface before the generated and extension barrels.
      'perfectionist/sort-exports': 'off',
    },
  },
)
