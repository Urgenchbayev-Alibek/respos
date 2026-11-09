import { expect, test } from '@playwright/test';
import { ADMIN_URL, HOME, homeUrl, type Role } from '../support/env';
import { expectNoRawI18nKeys, PageMonitor } from '../support/monitor';
import { loginViaUi, statePath } from '../support/session';

const ROLES: Role[] = ['owner', 'admin', 'manager', 'waiter', 'cook', 'cashier', 'stock', 'superadmin'];

test.describe('auth: login per role, reload restores session via refresh cookie', () => {
  for (const role of ROLES) {
    test(`${role} lands in ${HOME[role]} and survives reload`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const monitor = new PageMonitor(page, role).allow({ url: '/auth/refresh', status: 401 });

      await loginViaUi(page, role);
      await expect(page.locator('main, [role="main"]').first()).toBeVisible();
      await expectNoRawI18nKeys(page, `${role} home`);

      const cookies = await context.cookies('http://localhost:5080/api/v1/auth/refresh');
      const refreshCookie = cookies.find((c) => c.name === 'refresh_token');
      expect(refreshCookie, 'refresh cookie stored for the API origin').toBeTruthy();
      expect(refreshCookie?.httpOnly).toBe(true);

      // Reload: access token is memory-only, so the app must restore the session from the cross-port cookie.
      const refresh = page.waitForResponse((r) => r.url().includes('/auth/refresh'));
      await page.reload();
      const response = await refresh;
      expect(response.status(), 'POST /auth/refresh after reload').toBe(200);
      const headers = response.headers();
      expect(headers['access-control-allow-origin']).toBe(ADMIN_URL);
      expect(headers['access-control-allow-credentials']).toBe('true');
      await expect(page).toHaveURL(homeUrl(role));
      await expect(page.locator('main, [role="main"]').first()).toBeVisible();

      monitor.expectClean('login + reload');
      await context.storageState({ path: statePath(role) });
      await context.close();
    });
  }

  test('wrong password shows an error and stays on login', async ({ page }) => {
    const monitor = new PageMonitor(page, 'anon').allow({ url: '/auth/refresh', status: 401 }, { url: '/auth/login', status: 401 });
    await page.goto('/login');
    await page.getByLabel(/Email/).fill('nobody@demo.respos.uz');
    await page.getByLabel(/Пароль/).fill('wrong-password');
    await page.getByRole('button', { name: /Войти/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    monitor.expectClean('bad login');
  });

  test('unauthenticated deep link redirects to login', async ({ page }) => {
    const monitor = new PageMonitor(page, 'anon').allow({ url: '/auth/refresh', status: 401 });
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/login/);
    monitor.expectClean('deep link');
  });

  test('cook cannot open the admin panel (403 page)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: statePath('cook') });
    const page = await context.newPage();
    const monitor = new PageMonitor(page, 'cook');
    await page.goto('/admin/users');
    await expect(page.getByText('403', { exact: true })).toBeVisible();
    await expectNoRawI18nKeys(page, 'cook 403');
    monitor.expectClean('403');
    await context.storageState({ path: statePath('cook') });
    await context.close();
  });
});
