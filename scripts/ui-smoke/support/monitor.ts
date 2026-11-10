import { expect, type Page } from '@playwright/test';

/** A 4xx/5xx or console error the test explicitly expects (matched by URL substring / regex and status). */
export interface Allowed {
  url: string | RegExp;
  status?: number;
}

interface Problem {
  kind: 'console' | 'pageerror' | 'http' | 'requestfailed';
  text: string;
}

const matches = (pattern: string | RegExp, value: string) =>
  typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value);

/** Benign by nature: cancelled fetches on navigation, SignalR long-poll/ws teardown, Vite HMR. */
const IGNORED_FAILURES = [/net::ERR_ABORTED/, /NS_BINDING_ABORTED/];
const IGNORED_CONSOLE = [
  /Download the React DevTools/,
  /\[vite\]/,
  // SignalR logs a stopped connection when a test closes the page / navigates away.
  /Failed to start the transport|connection was stopped during negotiation|WebSocket closed with status code: 1006/,
];

/**
 * Collects console errors, uncaught page errors, failed requests and unexpected HTTP >= 400 for one page.
 * Call `expectClean()` at the end of a step; `allow()` whitelists responses the step provokes on purpose.
 */
export class PageMonitor {
  private problems: Problem[] = [];
  private allowed: Allowed[] = [];

  constructor(
    readonly page: Page,
    readonly label: string,
  ) {
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
      // Browser echoes every failed fetch as a console error; HTTP failures are judged separately below.
      if (/Failed to load resource: the server responded with a status of (\d+)/.test(text)) return;
      this.problems.push({ kind: 'console', text });
    });
    page.on('pageerror', (error) => this.problems.push({ kind: 'pageerror', text: error.message }));
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText ?? '';
      if (IGNORED_FAILURES.some((re) => re.test(failure))) return;
      this.problems.push({ kind: 'requestfailed', text: `${request.method()} ${request.url()} ${failure}` });
    });
    page.on('response', (response) => {
      const status = response.status();
      if (status < 400) return;
      const url = response.url();
      if (this.allowed.some((a) => matches(a.url, url) && (a.status === undefined || a.status === status))) return;
      this.problems.push({ kind: 'http', text: `${status} ${response.request().method()} ${url}` });
    });
  }

  allow(...entries: Allowed[]): this {
    this.allowed.push(...entries);
    return this;
  }

  /** Fails the test with every unexpected problem seen so far, then resets the list. */
  expectClean(step = ''): void {
    const found = this.problems;
    this.problems = [];
    expect(found, `[${this.label}] ${step}: unexpected browser errors`).toEqual([]);
  }
}

const PERMISSION_CODE =
  /^[a-z-]+(\.[a-z]+)*\.(read|create|update|deactivate|manage|cancel|apply|transfer|adjust|receive|open|close|refund|split|export|redeem|timeclock)$/;

/** Any i18n key that leaked to the screen (e.g. `orders.status.draft`, `nav:items.menu`). */
export async function expectNoRawI18nKeys(page: Page, where: string): Promise<void> {
  // Codes rendered on purpose (audit action, permission code) use a monospace font — skip those.
  const text = await page.evaluate(() => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim() || parent.closest('script, style')) continue;
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || /mono/i.test(style.fontFamily)) continue;
      parts.push(node.textContent);
    }
    return parts.join('\n');
  });
  const candidates = text.match(/(?<![\w@/.-])[a-z][a-zA-Z0-9]*[.:](?:[a-zA-Z0-9_]+\.)*[a-z][a-zA-Z0-9_]*(?![\w@.-])/g) ?? [];
  const leaked = candidates.filter(
    (token) =>
      /^[a-z][a-zA-Z]+(:[a-zA-Z]+)?(\.[a-zA-Z_]+)+$|^[a-z]+:[a-z][a-zA-Z]+$/.test(token) &&
      !/\.(uz|ru|com|io|png|jpg|svg|ts|tsx|js)$/.test(token) &&
      // Permission codes are shown on purpose under their translated labels (role editor).
      !PERMISSION_CODE.test(token),
  );
  expect([...new Set(leaked)], `raw i18n keys visible on ${where}`).toEqual([]);
}

/** Page has no horizontal scroll (mobile layouts). */
export async function expectNoHorizontalScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow on ${where} (px)`).toBeLessThanOrEqual(1);
}
