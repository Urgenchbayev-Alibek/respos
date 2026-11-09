import { rmSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoRawI18nKeys } from '../support/monitor';
import { navigate, openAs, settle, statePath } from '../support/session';
import { shot } from '../support/screenshots';

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

test('waiter workspace on a phone (390×844): no horizontal scroll', async ({ browser }) => {
  const session = await openAs(browser, 'waiter', PHONE);
  const { page, monitor } = session;
  try {
    for (const path of ['/waiter', '/waiter/orders', '/waiter/reservations']) {
      await navigate(page, path);
      await settle(page);
      await expect(page.locator('main')).toBeVisible();
      await expectNoHorizontalScroll(page, path);
      await expectNoRawI18nKeys(page, `${path} (phone)`);
    }
    // Order screen: menu + cart stacked on a phone.
    await navigate(page, '/waiter');
    await settle(page);
    await shot(page, 'waiter-floor-phone');
    await page.locator('[data-testid^="table-tile-"][data-status="available"]').first().getByRole('button').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Открыть заказ' }).click();
    await settle(page);
    await expectNoHorizontalScroll(page, 'new order (phone)');
    monitor.expectClean('phone');
  } finally {
    await session.close();
  }
});

test('logout clears the session; reload stays on login', async ({ browser }) => {
  const session = await openAs(browser, 'manager');
  const { page, monitor } = session;
  try {
    await page.getByRole('banner').getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitem', { name: /Выйти/ }).click();
    await expect(page).toHaveURL(/\/login/);
    monitor.allow({ url: '/auth/refresh', status: 401 });
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
    monitor.expectClean('logout');
  } finally {
    await session.context.close();
    // The family is revoked: the next run logs the manager in again.
    rmSync(statePath('manager'), { force: true });
  }
});
