import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Locator, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, SCENARIO_DIR, api, loginWithPassword, startApp, waitFor, type StartedApp } from './helpers/scenario';

/** Stock workspace (receipt, transfer, purchase suggestions), delivery board and table QR codes in the desktop app. */

const SHOTS = path.join(SCENARIO_DIR, 'shots');
const STAMP = Date.now().toString(36);
const REASON = `E2E поступление ${STAMP}`;
const CUSTOMER = `E2E клиент ${STAMP}`;
const RECEIPT_QUANTITY = 3;
/** Development default of the web app: a build that embeds it prints QR codes guests cannot open. */
const DEV_LANDING = 'http://localhost:5174';
const LANDING_CANDIDATES = ['https://respos-landing.vercel.app', DEV_LANDING];
const INGREDIENTS = '/api/v1/ingredients?page=1&pageSize=50&sort=name';

interface Ingredient { id: string; name: string; quantity: number; isArchived?: boolean }
interface Paged<T> { items: T[] }
interface Branch { id: string; name: string; slug: string | null }
interface PosItem { id: string; name: string; isAvailable: boolean; isArchived: boolean; variants: unknown[]; modifierGroups: unknown[] }
interface PosCategory { name: string; items: PosItem[] }
interface Delivery { orderId: string; displayNumber: string; status: string; customerName: string }
interface QrCode { toString(text: string, options: Record<string, unknown>): Promise<string> }

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => undefined);
}

/** In-app navigation by the sidebar link; a full load through the gateway when the page has no such link. */
async function go(page: Page, target: string, heading: string): Promise<void> {
  const link = page.locator(`a[href="${target}"]`).first();
  const overlaid = (await page.getByRole('dialog').count()) > 0;
  if (!overlaid && (await link.count()) > 0 && (await link.isVisible())) await link.click();
  else await page.goto(new URL(target, page.url()).toString());
  await page.getByRole('heading', { level: 1, name: heading }).waitFor({ state: 'visible', timeout: 90_000 });
}

async function signIn(started: StartedApp, email: string): Promise<void> {
  const { page, monitor } = started;
  // A fresh profile has no session: the start-up POST /auth/refresh answers 401 before the login form shows.
  await page.getByRole('form', { name: 'Вход в RestaurantOS' }).waitFor({ state: 'visible', timeout: 90_000 });
  monitor.reset();
  await loginWithPassword(page, email);
}

const dialog = (page: Page, name: string): Locator => page.getByRole('dialog', { name });

/** The `d` attributes of an SVG, i.e. the QR modules without markup noise. */
const svgPaths = (svg: string): string => [...svg.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1]).join('|');

describe('stock-delivery: stock workspace', () => {
  let stock: StartedApp;
  let ingredient: Ingredient;

  beforeAll(async () => {
    await mkdir(SHOTS, { recursive: true });
    stock = await startApp({ profile: 'stock' });
    await signIn(stock, ACCOUNTS.stock);
  });

  afterAll(async () => {
    await stock?.close();
  });

  it('renders the stock workspace with ingredient balances', async () => {
    const { page, monitor } = stock;
    await page.getByRole('heading', { level: 1, name: 'Склад' }).waitFor({ state: 'visible', timeout: 90_000 });
    expect(new URL(page.url()).pathname).toBe('/stock');
    const table = page.getByRole('table').first();
    await table.getByRole('row').nth(1).waitFor({ state: 'visible', timeout: 60_000 });
    for (const tab of ['Остатки', 'Движения', 'Перемещения']) {
      await expect(page.getByRole('tab', { name: tab }).isVisible()).resolves.toBe(true);
    }
    const list = await api<Paged<Ingredient>>(page, 'GET', INGREDIENTS);
    expect(list.status).toBe(200);
    const first = list.body.items.find((item) => !item.isArchived);
    expect(first, 'the demo seed has ingredients').toBeDefined();
    ingredient = first as Ingredient;
    await shot(page, '01-stock');
    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);
  });

  it('posts a goods receipt and the balance grows by the received quantity', async () => {
    const { page, monitor } = stock;
    await page.getByRole('button', { name: 'Движение', exact: true }).click();
    // The toolbar action opens the form on "write-off"; the title follows the chosen operation type.
    const form = page.getByRole('dialog');
    await form.waitFor({ state: 'visible', timeout: 30_000 });
    await form.getByLabel('Ингредиент').selectOption(ingredient.id);
    await form.getByLabel('Тип операции').selectOption({ label: 'Поступление' });
    await dialog(page, 'Поступление').waitFor({ state: 'visible', timeout: 15_000 });
    await form.getByLabel('Количество').fill(String(RECEIPT_QUANTITY));
    await form.getByLabel('Причина').fill(REASON);
    await shot(page, '02-receipt-form');
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByText('Движение сохранено').first().waitFor({ state: 'visible', timeout: 60_000 });
    await form.waitFor({ state: 'hidden', timeout: 30_000 });

    const after = await api<Paged<Ingredient>>(page, 'GET', INGREDIENTS);
    expect(after.status).toBe(200);
    expect(Number(after.body.items.find((item) => item.id === ingredient.id)?.quantity)).toBeCloseTo(Number(ingredient.quantity) + RECEIPT_QUANTITY, 3);

    // The journal shows the movement with its reason.
    await page.getByRole('tab', { name: 'Движения' }).click();
    await page.getByRole('cell', { name: REASON }).first().waitFor({ state: 'visible', timeout: 60_000 });
    await shot(page, '03-movements');
    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);
  });

  it('creates a draft transfer to another branch, or explains why it cannot', async () => {
    const { page, monitor } = stock;
    await page.getByRole('tab', { name: 'Перемещения' }).click();
    await page.getByRole('button', { name: 'Новое перемещение' }).click();
    const form = dialog(page, 'Новое перемещение');
    await form.waitFor({ state: 'visible', timeout: 30_000 });
    const destination = form.getByRole('combobox', { name: /^Куда/ }); // a plain label match also hits «Откуда»
    // Branch options arrive with the session; the first <option> is the placeholder.
    const destinations = (await destination.locator('option').count()) - 1;
    await shot(page, '04-transfer-form');
    if (destinations < 1) {
      await form.getByText('Нет других доступных филиалов для перемещения.').waitFor({ state: 'visible', timeout: 15_000 });
      await form.getByRole('button', { name: 'Отмена' }).click();
      console.warn('[stock-delivery] stock@ sees no second branch: the transfer form explains it; nothing created');
    } else {
      await destination.selectOption({ index: 1 });
      const line = form.getByRole('row').nth(1);
      await line.getByRole('combobox').first().selectOption(ingredient.id);
      await line.getByRole('textbox').first().fill('1');
      await form.getByRole('button', { name: 'Сохранить черновик' }).click();
      await page.getByText('Черновик перемещения создан').first().waitFor({ state: 'visible', timeout: 60_000 });
      const transfers = await api<Paged<{ status: string; toBranchName: string }>>(page, 'GET', '/api/v1/stock/transfers?page=1&pageSize=20');
      expect(transfers.status).toBe(200);
      expect(transfers.body.items.some((transfer) => transfer.status === 'draft')).toBe(true);
      // The status filter holds a hidden <option> with the same text: look at visible elements only.
      await page.getByText('Черновик', { exact: true }).and(page.locator(':visible')).first().waitFor({ state: 'visible', timeout: 60_000 });
      await shot(page, '05-transfer-created');
      // Saving opens the transfer's detail drawer: close it before leaving the page.
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
    }
    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);
  });

  it('opens purchase suggestions', async () => {
    const { page, monitor } = stock;
    await go(page, '/stock/purchases', 'Закупки');
    const answered = page.waitForResponse((response) => response.url().includes('/api/v1/purchases/suggestions'), { timeout: 90_000 });
    await page.getByRole('button', { name: 'Предложения' }).click();
    const modal = dialog(page, 'Предложения закупки');
    await modal.waitFor({ state: 'visible', timeout: 30_000 });
    expect((await answered).status()).toBe(200);
    // Either suggested lines (a table) or the "nothing to buy" message — never an endless spinner or an error.
    await waitFor(
      'suggestions table or the empty message',
      async () => (await modal.getByRole('table').count()) > 0 || (await modal.getByText('Все остатки в норме — закупать нечего.').count()) > 0,
      60_000,
    );
    await shot(page, '06-purchase-suggestions');
    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);
  });
});

describe('stock-delivery: delivery board and table QR codes', () => {
  let manager: StartedApp;

  beforeAll(async () => {
    await mkdir(SHOTS, { recursive: true });
    manager = await startApp({ profile: 'manager' });
    await signIn(manager, ACCOUNTS.manager);
  });

  afterAll(async () => {
    await manager?.close();
  });

  it('creates a delivery order and moves it through two statuses', async () => {
    const { page, monitor } = manager;
    await go(page, '/admin/delivery', 'Доставка');
    const menu = await api<PosCategory[]>(page, 'GET', '/api/v1/menu/pos');
    expect(menu.status).toBe(200);
    const simple = (item: PosItem): boolean => item.isAvailable && !item.isArchived && item.variants.length === 0 && item.modifierGroups.length === 0;
    const category = menu.body.find((entry) => entry.items.some(simple));
    expect(category, 'the POS menu has a dish without variants and modifiers').toBeDefined();
    const dish = (category as PosCategory).items.find(simple) as PosItem;

    await page.getByRole('button', { name: 'Новая доставка' }).click();
    const form = dialog(page, 'Новая доставка');
    await form.waitFor({ state: 'visible', timeout: 30_000 });
    await form.getByLabel('Телефон').fill('+998 90 123 45 67');
    await form.getByLabel('Имя клиента').fill(CUSTOMER);
    await form.getByLabel('Адрес').fill('ул. Тестовая, 1');
    const categoryButton = form.getByRole('button', { name: (category as PosCategory).name, exact: true });
    if ((await categoryButton.count()) > 0) await categoryButton.first().click();
    await form.getByRole('button', { name: dish.name }).first().click();
    await form.getByRole('button', { name: 'Больше' }).waitFor({ state: 'visible', timeout: 15_000 });
    await shot(page, '07-delivery-form');
    await form.getByRole('button', { name: 'Создать заказ' }).click();
    await page.getByText(/Заказ .+ создан/).first().waitFor({ state: 'visible', timeout: 60_000 });

    const created = await waitFor('the new delivery on the board API', async () => {
      const board = await api<Delivery[]>(page, 'GET', '/api/v1/delivery/orders');
      return board.status === 200 ? board.body.find((delivery) => delivery.customerName === CUSTOMER) : undefined;
    }, 60_000, 1_000);
    expect(created.status).toBe('new');

    const card = page.getByRole('article', { name: `Доставка ${created.displayNumber}` });
    await card.waitFor({ state: 'visible', timeout: 60_000 });
    const statusOf = async (): Promise<string> => (await api<Delivery>(page, 'GET', `/api/v1/delivery/orders/${created.orderId}`)).body.status;

    await card.getByRole('button', { name: 'Принять', exact: true }).click();
    await waitFor('status "accepted"', async () => (await statusOf()) === 'accepted', 60_000, 1_000);
    await card.getByText('Принят', { exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
    await shot(page, '08-delivery-accepted');

    await card.getByRole('button', { name: 'Готовится', exact: true }).click();
    await waitFor('status "cooking"', async () => (await statusOf()) === 'cooking', 60_000, 1_000);
    await page.getByRole('region', { name: 'Готовятся' }).getByRole('article', { name: `Доставка ${created.displayNumber}` })
      .waitFor({ state: 'visible', timeout: 60_000 });
    await shot(page, '09-delivery-cooking');
    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);
  });

  it('renders table QR codes that encode the public menu on the configured landing site', async () => {
    const { page, monitor } = manager;
    await go(page, '/admin/tables/qr', 'QR-коды столов');
    const codes = page.getByRole('img', { name: /^QR-код стола / });
    await codes.first().waitFor({ state: 'visible', timeout: 90_000 });
    const count = await codes.count();
    expect(count).toBeGreaterThan(0);
    await shot(page, '10-table-qr');

    const label = (await codes.first().getAttribute('aria-label')) ?? '';
    const tableNumber = label.replace('QR-код стола ', '');
    const rendered = svgPaths(await codes.first().innerHTML());
    expect(rendered.length, 'the QR card holds an SVG').toBeGreaterThan(50);

    const branches = await api<Branch[] | Paged<Branch>>(page, 'GET', '/api/v1/branches');
    expect(branches.status).toBe(200);
    const slugs = (Array.isArray(branches.body) ? branches.body : branches.body.items).map((branch) => branch.slug).filter(Boolean) as string[];

    // The page shows the link only as a QR image: rebuild the image for each candidate address with the web app's
    // own generator (`qrcode`, same options as shared/lib/qr.ts) and see which one the desktop build encoded.
    const qrcode = createRequire(path.resolve(process.cwd(), '../respos-admin/package.json'))('qrcode') as QrCode;
    let encoded: string | undefined;
    for (const landing of LANDING_CANDIDATES) {
      for (const slug of slugs) {
        const url = `${landing}/menu/${encodeURIComponent(slug)}?${new URLSearchParams({ table: tableNumber }).toString()}`;
        const svg = await qrcode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        if (svgPaths(svg) === rendered) encoded = url;
      }
    }
    console.warn(`[stock-delivery] table ${tableNumber}: QR encodes ${encoded ?? 'an address outside the known candidates'}; ${count} codes`);
    expect(encoded, 'the QR link is one of the known landing addresses').toBeDefined();
    expect(encoded?.startsWith(DEV_LANDING), 'a desktop build must not embed the dev landing address').toBe(false);
    expect(encoded).toMatch(/^https:\/\/[^/]+\/menu\/[^/?]+\?table=/);
    expect(monitor.errors).toEqual([]);
    expect(monitor.failedRequests).toEqual([]);
  });
});
