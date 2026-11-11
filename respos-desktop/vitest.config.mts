import { defineConfig } from 'vitest/config';

/** Unit tests: gateway (against a fake upstream server), settings store, pure validators. Plain Node, no Electron. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
