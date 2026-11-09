import { expect, test } from '@playwright/test';
import type { Role } from '../support/env';
import { expectNoHorizontalScroll, expectNoRawI18nKeys } from '../support/monitor';
import { navigate, openAs, settle } from '../support/session';

/** Every screen of every workspace renders without console errors, failed requests or leaked i18n keys. */
const PAGES: Partial<Record<Role, string[]>> = {
  owner: [
    '/admin', '/admin/branches', '/admin/users', '/admin/roles', '/admin/roles/new', '/admin/tables', '/admin/reservations',
    '/admin/menu', '/admin/kitchen-stations', '/admin/orders', '/admin/inventory', '/admin/recipes', '/admin/suppliers',
    '/admin/purchases', '/admin/payments', '/admin/cash-shifts', '/admin/reports', '/admin/notifications',
    '/admin/audit-logs', '/admin/settings', '/profile',
  ],
  manager: ['/admin', '/admin/orders', '/admin/reports'],
  waiter: ['/waiter', '/waiter/orders', '/waiter/reservations', '/profile'],
  cook: ['/kitchen'],
  cashier: ['/cashier', '/cashier/shift', '/cashier/payments'],
  stock: ['/stock', '/stock/purchases', '/stock/counts', '/stock/suppliers', '/stock/recipes'],
  superadmin: ['/platform', '/platform/plans', '/platform/feature-flags', '/platform/system', '/platform/demo-requests'],
};

for (const [role, paths] of Object.entries(PAGES) as [Role, string[]][]) {
  test(`crawl: ${role} — ${paths.length} screens`, async ({ browser }) => {
    const session = await openAs(browser, role);
    const { page, monitor } = session;
    const failures: string[] = [];
    try {
      for (const path of paths) {
        await navigate(page, path);
        await settle(page);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
        const errorShown = await page.getByText(/Что-то пошло не так|Не удалось загрузить|Xatolik/).count();
        if (process.env.UI_CRAWL_SHOTS) {
          await page.screenshot({ path: test.info().outputPath(`${role}${path.replaceAll('/', '_')}.png`), fullPage: true });
        }
        if (errorShown > 0) failures.push(`${path}: error state shown`);
        try {
          await expectNoRawI18nKeys(page, path);
          await expectNoHorizontalScroll(page, path);
          monitor.expectClean(path);
        } catch (error) {
          failures.push(`${path}: ${(error as Error).message.split('\n').slice(0, 12).join(' | ')}`);
        }
      }
    } finally {
      await session.close();
    }
    expect(failures).toEqual([]);
  });
}
