import { defineConfig } from 'vitest/config';

/** End-to-end runs: the built app is launched through Playwright's Electron driver, one file at a time. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
