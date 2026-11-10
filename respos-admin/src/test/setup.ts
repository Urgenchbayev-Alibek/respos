import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { i18n } from '@/shared/i18n';
import { server } from './msw-server';

// Lazy route modules are imported on first render; with all files running in parallel that import alone can take
// about a second, so RTL's 1000 ms default for findBy*/waitFor made route tests flaky.
configure({ asyncUtilTimeout: 4000 });

beforeAll(() => {
  void i18n.changeLanguage('ru');
  server.listen({ onUnhandledRequest: 'error' });
  // jsdom's AbortSignal is not accepted by Node's fetch/Request (undici). Tests only: drop the signal.
  const interceptedFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => interceptedFetch(input, init ? { ...init, signal: undefined } : init);
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => server.close());

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
