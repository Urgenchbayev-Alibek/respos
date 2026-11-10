import { randomUUID } from 'node:crypto';
import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, DEMO_PASSWORD, LANDING_URL, USERS } from '../support/env';
import { expectNoHorizontalScroll, expectNoRawI18nKeys, PageMonitor } from '../support/monitor';
import { shot } from '../support/screenshots';
import { loginViaUi, navigate, openAs, settle } from '../support/session';

/** v2 screens (F1–F8) in a real browser against the real API. Test data is prepared through the REST API. */

interface Api {
  ctx: APIRequestContext;
  branchId: string;
  call<T = Record<string, unknown>>(method: string, path: string, data?: unknown, expected?: number): Promise<T>;
}

async function apiAs(email: string): Promise<Api> {
  const ctx = await request.newContext({ baseURL: `${API_URL}/` });
  const login = await ctx.post('auth/login', { data: { email, password: DEMO_PASSWORD } });
  expect(login.status(), `API login ${email} (5/min per e-mail)`).toBe(200);
  const body = await login.json();
  const branchId = body.user.branches[0].id as string;
  const headers = { Authorization: `Bearer ${body.accessToken}`, 'X-Branch-Id': branchId };
  return {
    ctx,
    branchId,
    async call(method, path, data, expected = 200) {
      const res = await ctx.fetch(path.replace(/^\//, ''), { method, data, headers: { ...headers, 'Idempotency-Key': randomUUID() } });
      expect(res.status(), `${method} ${path}: ${await res.text()}`).toBe(expected);
      return (res.status() === 204 ? {} : await res.json()) as never;
    },
  };
}

async function clean(page: Page, monitor: PageMonitor, where: string): Promise<void> {
  await settle(page);
  await expectNoRawI18nKeys(page, where);
  await expectNoHorizontalScroll(page, where);
  monitor.expectClean(where);
}

test('guests: list → guest card with orders and points ledger', async ({ browser }) => {
  const session = await openAs(browser, 'owner');
  const { page, monitor } = session;
  try {
    await navigate(page, '/admin/customers');
    await settle(page);
    const firstGuest = page.getByRole('table').getByRole('link').first();
    await expect(firstGuest, 'run scripts/e2e first: it creates guests').toBeVisible();
    await shot(page, 'admin-guests');
    await firstGuest.click();
    await expect(page).toHaveURL(/\/admin\/customers\/[0-9a-f-]{36}/);
    await clean(page, monitor, 'guest card');
    await shot(page, 'admin-guest-card');
  } finally {
    await session.close();
  }
});

test('cashier: guest loyalty panel + split equally into 2 bills', async ({ browser }) => {
  const api = await apiAs(USERS.owner);
  const pos = await api.call<{ items: { id: string; modifierGroups: unknown[]; variants: unknown[] }[] }[]>('GET', '/menu/pos');
  const item = pos.flatMap((c) => c.items).find((i) => i.modifierGroups.length === 0 && i.variants.length === 0)!;
  const order = await api.call<{ id: string; number: number }>('POST', '/orders',
    { type: 'takeaway', guestCount: 2, items: [{ menuItemId: item.id, variantId: null, quantity: 4, modifierOptionIds: [] }] }, 201);
  const digits = String(Date.now()).slice(-7);
  const guest = await api.call<{ id: string }>('POST', '/customers', { phone: `91${digits}`, name: `UI Гость ${digits}`, marketingConsent: false }, 201);
  await api.call('POST', `/orders/${order.id}/customer`, { customerId: guest.id });

  const session = await openAs(browser, 'cashier');
  const { page, monitor } = session;
  try {
    await settle(page);
    const openShift = page.getByRole('button', { name: 'Открыть смену' }).first();
    if (await openShift.isVisible()) {
      await openShift.click();
      await page.getByRole('dialog').getByLabel(/Сумма открытия/).fill('100000');
      await page.getByRole('dialog').getByRole('button', { name: 'Открыть смену' }).click();
      await expect(page.getByText('Смена открыта').first()).toBeVisible();
    }
    await page.getByRole('button', { name: new RegExp(`#${String(order.number).padStart(4, '0')}\\b`) }).first().click();
    await expect(page.getByRole('region', { name: 'Бонусы гостя' })).toBeVisible();
    await page.getByRole('button', { name: 'Разделить счёт' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Разделить', exact: true }).click();
    await expect(page.getByText('Счёт разделён').first()).toBeVisible();
    await expect(page.getByText('Счёт 2').first()).toBeVisible();
    await clean(page, monitor, 'cashier split + loyalty');
    await shot(page, 'cashier-split-loyalty');
  } finally {
    await session.close();
    await api.call('DELETE', `/orders/${order.id}/split`);
    await api.call('POST', `/orders/${order.id}/cancel`, { reason: 'ui smoke' });
    await api.ctx.dispose();
  }
});

test('delivery board, QR codes sheet, integrations, staff and analytics tabs', async ({ browser }) => {
  const session = await openAs(browser, 'owner');
  const { page, monitor } = session;
  try {
    await navigate(page, '/admin/delivery');
    await clean(page, monitor, 'delivery board');
    await shot(page, 'admin-delivery-board');

    await navigate(page, '/admin/tables/qr');
    await settle(page);
    await expect(page.getByTestId('table-qr-card').first()).toBeVisible();
    await clean(page, monitor, 'table QR sheet');
    await shot(page, 'admin-table-qr');

    await navigate(page, '/admin/integrations');
    await expect(page.getByText('Telegram-бот').first()).toBeVisible();
    await clean(page, monitor, 'integrations');
    await shot(page, 'admin-integrations');

    await navigate(page, '/admin/staff/timesheet');
    await clean(page, monitor, 'staff timesheet');
    await shot(page, 'admin-staff-timesheet');

    await navigate(page, '/admin/reports');
    await settle(page);
    for (const tab of ['ABC-анализ', 'Фудкост', 'Официанты', 'Тепловая карта', 'Скидки и отмены']) {
      await page.getByRole('tab', { name: tab }).click();
      await clean(page, monitor, `reports → ${tab}`);
      if (tab === 'ABC-анализ') await shot(page, 'admin-analytics-abc');
    }
  } finally {
    await session.close();
  }
});

test('dark theme toggle (per device) is applied and kept after reload', async ({ browser }) => {
  const session = await openAs(browser, 'owner');
  const { page, monitor } = session;
  try {
    await settle(page);
    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitem', { name: 'Тема: тёмная' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await settle(page);
    await shot(page, 'admin-dashboard-dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await settle(page);
    monitor.expectClean('dark theme');
    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitem', { name: 'Тема: как в системе' }).click();
  } finally {
    await session.close();
  }
});

test('shared device: manager registers the tablet, waiter signs in with PIN 2580 on the lock screen', async ({ browser }) => {
  // Own context: registering logs the manager out, so the chained .auth/manager.json session must not be used.
  const context = await browser.newContext();
  const page = await context.newPage();
  const monitor = new PageMonitor(page, 'device').allow({ url: '/auth/refresh', status: 401 });
  try {
    await loginViaUi(page, 'manager');
    await navigate(page, '/admin/staff/devices');
    await settle(page);
    await page.getByRole('button', { name: 'Сделать это устройство общим' }).click();
    await page.getByRole('dialog').getByLabel(/Название/).fill(`UI smoke tablet ${Date.now().toString(36)}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Подключить' }).click();
    await expect(page).toHaveURL(/\/device/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Кто работает?' })).toBeVisible();
    await clean(page, monitor, 'lock screen');
    await shot(page, 'device-lock-screen');
    await page.getByRole('button', { name: /Азиз Хасанов/ }).click();
    for (const digit of '2580') await page.getByRole('button', { name: digit, exact: true }).click();
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(/\/waiter/, { timeout: 20_000 });
    await clean(page, monitor, 'waiter after PIN login');
  } finally {
    await context.close();
  }
  const api = await apiAs(USERS.manager);
  const devices = await api.call<{ id: string; name: string; isActive: boolean }[]>('GET', '/staff/devices');
  for (const device of devices.filter((d) => d.isActive && d.name.startsWith('UI smoke tablet'))) {
    await api.call('POST', `/staff/devices/${device.id}/revoke`, {});
  }
  await api.ctx.dispose();
});

test.describe('landing v2', () => {
  test.use({ baseURL: LANDING_URL });

  test('QR menu /menu/demo on a phone: categories, call waiter; booking page loads slots by slug', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: LANDING_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const monitor = new PageMonitor(page, 'landing v2');
    try {
      await page.goto('/menu/demo?table=2');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText(/UZS/).first()).toBeVisible();
      await expectNoHorizontalScroll(page, 'qr menu');
      await expectNoRawI18nKeys(page, 'qr menu');
      await shot(page, 'landing-qr-menu');
      // Both actions of the fixed bottom bar must be fully on screen (a clipped button does not cause page scroll).
      for (const name of ['Позвать официанта', 'Попросить счёт']) {
        await expect(page.getByRole('button', { name }), `"${name}" clipped at 390 px`).toBeInViewport({ ratio: 1 });
      }
      const call = page.waitForResponse((r) => r.url().includes('/call-waiter'));
      await page.getByRole('button', { name: 'Позвать официанта' }).click();
      expect((await call).status(), 'call-waiter (429 = more than 3 runs/min)').toBe(202);
      await expect(page.getByText('Официант скоро подойдёт')).toBeVisible();
      monitor.expectClean('qr menu');

      const availability = page.waitForResponse((r) => r.url().includes('/public/branches/demo/availability'));
      await page.goto('/booking');
      expect((await availability).status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Забронировать стол' })).toBeVisible();
      await expect(page.getByRole('radio').first().or(page.getByText(/нет свободного времени/))).toBeVisible();
      await expectNoHorizontalScroll(page, 'booking');
      await expectNoRawI18nKeys(page, 'booking');
      await shot(page, 'landing-booking');
      monitor.expectClean('booking');
    } finally {
      await context.close();
    }
  });
});
