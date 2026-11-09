import { expect, test } from '@playwright/test';
import { LANDING_URL } from '../support/env';
import { expectNoHorizontalScroll, expectNoRawI18nKeys, PageMonitor } from '../support/monitor';
import { openAs, settle } from '../support/session';
import { shot } from '../support/screenshots';

test('platform admin: organizations list and system page', async ({ browser }) => {
  const session = await openAs(browser, 'superadmin');
  const { page, monitor } = session;
  try {
    await settle(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: /demo|Демо/i }).first()).toBeVisible();
    await expectNoRawI18nKeys(page, 'organizations');
    monitor.expectClean('organizations');

    await page.getByRole('link', { name: 'Система' }).click();
    await settle(page);
    await expect(page.getByRole('heading', { name: 'Состояние системы' })).toBeVisible();
    await expect(page.getByText('Работает')).toBeVisible();
    await expectNoRawI18nKeys(page, 'system');
    monitor.expectClean('system');
  } finally {
    await session.close();
  }
});

test.describe('landing', () => {
  test.use({ baseURL: LANDING_URL });

  test('home renders and demo form submits (202 → success state)', async ({ page }) => {
    const monitor = new PageMonitor(page, 'landing');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoRawI18nKeys(page, 'landing home');
    await shot(page, 'landing-home');
    monitor.expectClean('home');

    await page.goto('/demo');
    await page.getByLabel(/Ваше имя/).fill('UI Smoke');
    await page.getByLabel(/^Телефон/).fill('+998 90 123-45-67');
    await page.getByLabel(/Название заведения/).fill(`Smoke Cafe ${Date.now().toString(36)}`);
    const response = page.waitForResponse((r) => r.url().includes('/public/demo-requests'));
    await page.getByRole('button', { name: 'Отправить заявку' }).click();
    expect((await response).status(), 'POST /public/demo-requests (429 = run more than 5×/hour per IP)').toBe(202);
    await expect(page.getByRole('heading', { name: 'Заявка отправлена' })).toBeVisible();
    monitor.expectClean('demo form');
  });

  test('landing on a phone: no horizontal scroll', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: LANDING_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const monitor = new PageMonitor(page, 'landing mobile');
    for (const path of ['/', '/pricing', '/demo']) {
      await page.goto(path);
      await expectNoHorizontalScroll(page, `landing ${path}`);
    }
    monitor.expectClean('landing mobile');
    await context.close();
  });
});
