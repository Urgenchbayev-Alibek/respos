import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test';
import { DEMO_PASSWORD, HOME, homeUrl, USERS, type Role } from './env';
import { PageMonitor } from './monitor';

const AUTH_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.auth');

export const statePath = (role: Role) => resolve(AUTH_DIR, `${role}.json`);

export interface RoleSession {
  role: Role;
  context: BrowserContext;
  page: Page;
  monitor: PageMonitor;
  /** Saves the (rotated) refresh cookie for the next test, then closes the context. */
  close(): Promise<void>;
}

/** Fills the login form and waits until the role's workspace is shown. */
export async function loginViaUi(page: Page, role: Role): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/Email/).fill(USERS[role]);
  await page.getByLabel(/Пароль|Parol|Password/).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /Войти|Kirish|Sign in/ }).click();
  await expect(page).toHaveURL(homeUrl(role), { timeout: 20_000 });
}

/**
 * Opens a browser context signed in as `role`. Sessions are chained through `.auth/<role>.json`: refresh tokens
 * rotate on every page load (reuse of an old one revokes the family), so the latest cookie is written back on close.
 * Falls back to a UI login when no saved state exists (login is rate limited: 5/min per IP+e-mail).
 */
export async function openAs(browser: Browser, role: Role, options: BrowserContextOptions = {}): Promise<RoleSession> {
  mkdirSync(AUTH_DIR, { recursive: true });
  const file = statePath(role);
  const hasState = existsSync(file);
  const context = await browser.newContext({ ...options, ...(hasState ? { storageState: file } : {}) });
  const page = await context.newPage();
  const monitor = new PageMonitor(page, role);
  // A missing/expired saved session answers 401 on refresh → we fall back to the login form.
  monitor.allow({ url: '/auth/refresh', status: 401 });
  let restored = false;
  if (hasState) {
    const refresh = page.waitForResponse((r) => r.url().includes('/auth/refresh'), { timeout: 15_000 });
    await page.goto(HOME[role]);
    restored = (await refresh.catch(() => null))?.ok() ?? false;
  }
  if (restored) {
    await expect(page).toHaveURL(homeUrl(role));
  } else {
    await loginViaUi(page, role);
  }
  await context.storageState({ path: file });
  return {
    role,
    context,
    page,
    monitor,
    async close() {
      await context.storageState({ path: file }).catch(() => undefined);
      await context.close();
    },
  };
}

/**
 * Client-side navigation (React Router listens to popstate). A full `page.goto` reloads the SPA, which costs one
 * `POST /auth/refresh` (rate limited per IP) — real users click links, so the smoke does the same.
 */
export async function navigate(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  const pathname = path.split('?')[0];
  await page.waitForURL((url) => url.pathname === pathname);
}

/** Waits until loading tables / skeletons are gone — a screen stuck in loading fails the test. */
export async function settle(page: Page): Promise<void> {
  const loading = page.locator('table[aria-busy="true"], [class*="_skeleton_"], [class*="_spinner_"]');
  // Twice with a pause: a lazy route first shows its Suspense loader, then the page's own skeletons.
  for (let pass = 0; pass < 2; pass += 1) {
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expect(loading, 'screen still loading').toHaveCount(0, { timeout: 15_000 });
    await page.waitForTimeout(250);
  }
}
