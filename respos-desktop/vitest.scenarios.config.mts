import { defineConfig } from 'vitest/config';

/**
 * Wide end-to-end scenarios (`npm run scenario <key>`): each file drives the built app against its own backend.
 * The `.scenario.ts` suffix keeps them out of `npm run e2e`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/scenarios/**/*.scenario.ts'],
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
