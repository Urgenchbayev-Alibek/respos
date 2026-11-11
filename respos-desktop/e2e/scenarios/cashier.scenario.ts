import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  ACCOUNTS,
  DEMO_PASSWORD,
  SCENARIO_DIR,
  SERVER_URL,
  api,
  loginWithPassword,
  startApp,
  waitFor,
  waitForApi,
  type StartedApp,
} from './helpers/scenario';

/**
 * Cashier day on the desktop shell: shift, cash payment with a tip, receipt print through the bridge,
 * guest + split bill paid by two methods, shift totals, shift close, Z report.
 * The tests run in order and share one window (one cashier login).
 */

interface OrderDto {
  id: string;
  number: number;
  status: string;
  tableNumber: string | null;
  total: number;
  remainingAmount: number;
  customer?: { name: string; phone: string } | null;
  isSplit?: boolean;
  bills?: { id: string; number: number; status: string; amount?: number; total?: number }[];
  payments: { method: string; amount: number; tipAmount?: number }[];
}
interface ShiftDto {
  id: string;
  status: string;
  openingAmount: number;
  expectedCashAmount: number | null;
  cashPaymentsAmount: number;
  tipsAmount?: number;
  cashTipsAmount?: number;
  totalsByMethod: { method: string; amount: number }[];
}
interface PrintJob {
  paper: string;
  silent: boolean;
  deviceName: string | null;
  pageSize: unknown;
  page: string;
}

const CAPTURE_FILE = path.join(SCENARIO_DIR, 'print-capture.jsonl');
const OPENING = 100_000;
const TIP = 5_000;
const WAIT = 60_000;

async function printJobs(): Promise<PrintJob[]> {
  if (!existsSync(CAPTURE_FILE)) return [];
  const text = await readFile(CAPTURE_FILE, 'utf8');
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as PrintJob);
}

/** Counts `window.print()` calls instead of opening Chromium's dialog: any call means the bridge was bypassed. */
const PRINT_SPY = `(() => { const w = window; if (w.__printSpy) return; w.__printSpy = true; w.__browserPrintCalls = 0; w.print = () => { w.__browserPrintCalls += 1; }; })()`;
const browserPrintCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __browserPrintCalls?: number }).__browserPrintCalls ?? -1);

/** The waiter's side, straight against the scenario backend (no window): two submitted dine-in orders. */
async function prepareOrders(): Promise<OrderDto[]> {
  const call = async <T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> => {
    const response = await fetch(`${SERVER_URL}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${url} → ${response.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as T;
  };
  const login = await call<{ accessToken: string }>('POST', '/api/v1/auth/login', { email: ACCOUNTS.waiter, password: DEMO_PASSWORD });
  const auth: Record<string, string> = { Authorization: `Bearer ${login.accessToken}` };
  const me = await call<{ branches?: { id: string }[] }>('GET', '/api/v1/auth/me', undefined, auth);
  const branchId = me.branches?.[0]?.id;
  if (!branchId) throw new Error('waiter has no branch in /auth/me');
  auth['X-Branch-Id'] = branchId;
  const tables = await call<{ id: string; status: string }[]>('GET', '/api/v1/tables', undefined, auth);
  const free = tables.filter((table) => table.status === 'available');
  if (free.length < 2) throw new Error(`need two available tables, found ${free.length}`);
  const menu = await call<{ items: { id: string; variants: { id: string; isDefault: boolean }[]; modifierGroups: { isRequired: boolean }[] }[] }[]>(
    'GET',
    '/api/v1/menu/pos',
    undefined,
    auth,
  );
  const item = menu.flatMap((category) => category.items).find((candidate) => !candidate.modifierGroups.some((group) => group.isRequired));
  if (!item) throw new Error('no menu item without required modifiers');
  const orders: OrderDto[] = [];
  for (const table of free.slice(0, 2)) {
    const created = await call<OrderDto>(
      'POST',
      '/api/v1/orders',
      {
        type: 'dine_in',
        tableId: table.id,
        guestCount: 2,
        items: [{ menuItemId: item.id, variantId: item.variants.find((variant) => variant.isDefault)?.id, quantity: 2, modifierOptionIds: [] }],
      },
      auth,
    );
    orders.push(await call<OrderDto>('POST', `/api/v1/orders/${created.id}/send-to-kitchen`, {}, { ...auth, 'Idempotency-Key': randomUUID() }));
  }
  return orders;
}

describe('cashier: shift, payment, split bill, tips, loyalty guest, receipt printing', () => {
  let cashier: StartedApp;
  let page: Page;
  let first: OrderDto;
  let second: OrderDto;
  let shotIndex = 0;

  const selectOrder = async (order: OrderDto): Promise<void> => {
    const list = page.getByRole('region', { name: 'К оплате' });
    await list.getByRole('button', { name: new RegExp(`Стол ${order.tableNumber}(?!\\d)`) }).click({ timeout: WAIT });
    await page.getByRole('button', { name: 'Пречек' }).waitFor({ state: 'visible', timeout: WAIT });
  };
  const getOrder = (id: string) => api<OrderDto>(page, 'GET', `/api/v1/orders/${id}`);

  beforeAll(async () => {
    await rm(CAPTURE_FILE, { force: true });
    [first, second] = (await prepareOrders()) as [OrderDto, OrderDto];
    cashier = await startApp({ printCaptureFile: CAPTURE_FILE });
    page = cashier.page;
    await page.addInitScript(PRINT_SPY);
    await page.evaluate(PRINT_SPY);
    await page.getByRole('form', { name: 'Вход в RestaurantOS' }).waitFor({ state: 'visible', timeout: WAIT });
    cashier.monitor.reset();
    await loginWithPassword(page, ACCOUNTS.cashier);
    await page.getByRole('region', { name: 'Кассовая смена' }).waitFor({ state: 'visible', timeout: WAIT });
  });

  afterEach(async () => {
    shotIndex += 1;
    await page?.screenshot({ path: path.join(SCENARIO_DIR, `step-${String(shotIndex).padStart(2, '0')}.png`) }).catch(() => undefined);
  });

  afterAll(async () => {
    await cashier?.close();
  });

  it('opens the cash shift', async () => {
    const banner = page.getByRole('region', { name: 'Кассовая смена' });
    await banner.getByRole('button', { name: 'Открыть смену' }).click({ timeout: WAIT });
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Сумма открытия/).fill(String(OPENING));
    await dialog.getByRole('button', { name: 'Открыть смену' }).click();
    const shift = await waitForApi<ShiftDto>(page, '/api/v1/cash-shifts/current', (result) => result.status === 200, WAIT);
    expect(shift.body.status).toBe('open');
    expect(shift.body.openingAmount).toBe(OPENING);
    await banner.getByRole('button', { name: 'Закрыть смену' }).waitFor({ state: 'visible', timeout: WAIT });
  });

  it('pays the first order in cash with a tip', async () => {
    await selectOrder(first);
    await page.getByRole('group', { name: 'Способ оплаты' }).getByRole('button', { name: 'Наличные' }).click();
    await page.getByLabel(/^Чаевые/).fill(String(TIP));
    await page.getByRole('button', { name: /^Принять оплату/ }).click();
    await page.getByText('Заказ полностью оплачен').waitFor({ state: 'visible', timeout: WAIT });
    const paid = await getOrder(first.id);
    expect(paid.body.status).toBe('paid');
    expect(paid.body.payments.map((payment) => [payment.method, payment.amount])).toEqual([['cash', first.total]]);
  });

  it('prints the receipt of the paid order through the shell as receipt-80mm, without a browser print dialog', async () => {
    await page.getByRole('button', { name: 'Пречек' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Печать (80 мм)' }).click({ timeout: WAIT });
    const jobs = await waitFor('a captured print job', async () => ((await printJobs()).length > 0 ? printJobs() : null), WAIT);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.paper).toBe('receipt-80mm');
    expect(jobs[0]?.page.startsWith('/cashier')).toBe(true);
    expect(await browserPrintCalls(page)).toBe(0);
    await dialog.getByRole('button', { name: 'Закрыть' }).last().click();
    await dialog.waitFor({ state: 'hidden', timeout: WAIT });
  });

  it('attaches a newly created guest to the second order', async () => {
    const phone = `+99890${String(Date.now()).slice(-7)}`;
    await selectOrder(second);
    await page.getByRole('button', { name: 'Привязать гостя' }).click();
    await page.getByPlaceholder('Телефон или имя').fill(phone);
    await page.getByRole('button', { name: 'Новый гость' }).click({ timeout: WAIT });
    const form = page.getByRole('dialog');
    await form.getByLabel(/^Имя/).fill('Гость Сценарий');
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByRole('group', { name: 'Гость' }).getByText('Гость Сценарий').waitFor({ state: 'visible', timeout: WAIT });
    const order = await getOrder(second.id);
    expect(order.body.customer?.name).toBe('Гость Сценарий');
    expect(order.body.customer?.phone).toBe(phone);
  });

  it('splits the second order in two bills and pays them by card and in cash', async () => {
    await page.getByRole('button', { name: 'Разделить счёт' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Количество частей/).fill('2');
    await dialog.getByRole('button', { name: 'Разделить', exact: true }).click();
    const bills = page.getByRole('group', { name: 'Выберите счёт для оплаты' });
    await bills.getByRole('button').nth(1).waitFor({ state: 'visible', timeout: WAIT });
    expect(await bills.getByRole('button').count()).toBe(2);

    const methods = page.getByRole('group', { name: 'Способ оплаты' });
    await page.getByText(/Оплата счёта 1 ·/).waitFor({ state: 'visible', timeout: WAIT });
    await methods.getByRole('button', { name: 'Карта' }).click();
    await page.getByRole('button', { name: /^Принять оплату/ }).click();
    await page.getByText(/Оплата счёта 2 ·/).waitFor({ state: 'visible', timeout: WAIT });
    await methods.getByRole('button', { name: 'Наличные' }).click();
    await page.getByRole('button', { name: /^Принять оплату/ }).click();
    await page.getByText('Заказ полностью оплачен').waitFor({ state: 'visible', timeout: WAIT });

    const paid = await getOrder(second.id);
    expect(paid.body.status).toBe('paid');
    expect(paid.body.remainingAmount).toBe(0);
    expect(paid.body.payments.map((payment) => payment.method).sort()).toEqual(['card', 'cash']);
    expect(paid.body.payments.reduce((sum, payment) => sum + payment.amount, 0)).toBe(second.total);
  });

  it('shows shift totals with all three payments and the tip', async () => {
    const order = await getOrder(second.id);
    const cashPart = order.body.payments.find((payment) => payment.method === 'cash')?.amount ?? 0;
    const cardPart = order.body.payments.find((payment) => payment.method === 'card')?.amount ?? 0;
    const shift = await api<ShiftDto>(page, 'GET', '/api/v1/cash-shifts/current');
    expect(shift.status).toBe(200);
    const byMethod = Object.fromEntries(shift.body.totalsByMethod.map((row) => [row.method, row.amount]));
    expect(byMethod.cash).toBe(first.total + cashPart);
    expect(byMethod.card).toBe(cardPart);
    expect(shift.body.tipsAmount).toBe(TIP);
    expect(shift.body.cashTipsAmount).toBe(TIP);

    await page.getByRole('link', { name: 'Смена' }).click();
    await page.getByRole('heading', { name: 'Итоги смены' }).waitFor({ state: 'visible', timeout: WAIT });
    await page.getByText('Чаевые (все способы)').waitFor({ state: 'visible', timeout: WAIT });
  });

  it('closes the shift', async () => {
    const current = await api<ShiftDto>(page, 'GET', '/api/v1/cash-shifts/current');
    const expected = current.body.expectedCashAmount ?? 0;
    expect(expected).toBeGreaterThanOrEqual(OPENING + first.total);
    await page.getByRole('region', { name: 'Кассовая смена' }).getByRole('button', { name: 'Закрыть смену' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Фактически наличных в кассе/).fill(String(expected));
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.getByRole('button', { name: 'Закрыть смену' }).click({ timeout: WAIT });
    const after = await waitForApi(page, '/api/v1/cash-shifts/current', (result) => result.status === 204, WAIT);
    expect(after.status).toBe(204);
  });

  it('shows the "Смена закрыта" result step with «Готово» after closing', async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Готово' }).waitFor({ state: 'visible', timeout: WAIT });
  });

  it('lets the cashier print the Z report of the shift they closed, through the shell', async () => {
    const dialog = page.getByRole('dialog');
    const before = (await printJobs()).length;
    await dialog.getByRole('button', { name: 'Печать Z-отчёта' }).click({ timeout: WAIT });
    const jobs = await waitFor('the Z-report print job', async () => ((await printJobs()).length > before ? printJobs() : null), WAIT);
    expect(jobs.at(-1)?.paper).toBe('receipt-80mm');
    expect(jobs.at(-1)?.page.startsWith('/cashier')).toBe(true);
    expect(await browserPrintCalls(page)).toBe(0);
    await dialog.getByRole('button', { name: 'Готово' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: WAIT });
  });

  // The admin journal of shifts belongs to the admin workspace: the cashier gets the 403 page there by design.
  it('keeps the admin shift journal closed to the cashier (403 page)', async () => {
    await page.goto(new URL('/admin/cash-shifts', page.url()).toString());
    await page.getByRole('button', { name: 'Войти под другим пользователем' }).waitFor({ state: 'visible', timeout: WAIT });
  });

  it('leaves no console errors or failed requests behind in the cashier session', () => {
    expect(cashier.monitor.errors).toEqual([]);
    expect(cashier.monitor.failedRequests).toEqual([]);
  });

  it('prints the Z report of the closed shift through the shell (as the admin, from the admin drawer)', async () => {
    await page.getByRole('button', { name: 'Войти под другим пользователем' }).click({ timeout: WAIT });
    await loginWithPassword(page, ACCOUNTS.admin);
    await page.getByRole('link', { name: 'Кассовые смены' }).click({ timeout: WAIT });
    await page.getByRole('heading', { level: 1, name: 'Кассовые смены' }).waitFor({ state: 'visible', timeout: WAIT });
    await page.getByRole('row').nth(1).click({ timeout: WAIT });
    const print = page.getByRole('button', { name: 'Печать Z-отчёта' });
    await print.waitFor({ state: 'visible', timeout: WAIT });
    const before = (await printJobs()).length;
    await print.click();
    const jobs = await waitFor('the Z-report print job', async () => ((await printJobs()).length > before ? printJobs() : null), WAIT);
    expect(jobs.at(-1)?.paper).toBe('receipt-80mm');
    expect(jobs.at(-1)?.page.startsWith('/admin/cash-shifts')).toBe(true);
    expect(await browserPrintCalls(page)).toBe(0);
  });
});
