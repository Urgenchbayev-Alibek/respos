import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, SCENARIO_DIR, SERVER_URL, loginWithPassword, startApp, waitFor, type StartedApp } from './helpers/scenario';

/** Two fixed, different gateway ports: both apps run at the same time on the same backend. */
const WAITER_GATEWAY_PORT = 15093;
const COOK_GATEWAY_PORT = 15094;
const HUB_PATH = '/hubs/restaurant';
const SHOTS_DIR = path.join(SCENARIO_DIR, 'shots');
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

interface HubSocket {
  url: string;
  /** Text frames received from the server (SignalR JSON protocol, records end with 0x1e). */
  frames: string[];
  closed: boolean;
}

interface HubTrace {
  sockets: HubSocket[];
  /** Hub traffic that is NOT a WebSocket and not the negotiate call: long polling / server-sent events. */
  httpTransport: string[];
}

/** Records how the page talks to the hub; attach before signing in (the hub connects after the login). */
function traceHub(page: Page): HubTrace {
  const trace: HubTrace = { sockets: [], httpTransport: [] };
  page.on('websocket', (socket) => {
    if (!socket.url().includes(HUB_PATH)) return;
    const record: HubSocket = { url: socket.url().replace(/access_token=[^&]+/, 'access_token=…'), frames: [], closed: false };
    trace.sockets.push(record);
    socket.on('framereceived', (frame) => record.frames.push(String(frame.payload)));
    socket.on('close', () => {
      record.closed = true;
    });
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith(HUB_PATH) || url.pathname.endsWith('/negotiate')) return;
    if (request.resourceType() === 'websocket') return;
    trace.httpTransport.push(`${request.method()} ${url.pathname}`);
  });
  return trace;
}

/** Server-to-client hub invocations (`"type":1`) received so far — pings (`"type":6`) do not count. */
function invocations(trace: HubTrace): string[] {
  return trace.sockets
    .flatMap((socket) => socket.frames)
    .flatMap((frame) => frame.split('\u001e'))
    .filter((record) => record.includes('"type":1'));
}

const MARK = '__resposRealtimeScenario';

/** A value on `window` survives client-side navigation and realtime refetches, but not a page reload. */
async function markPage(page: Page): Promise<void> {
  await page.evaluate((key) => {
    (window as unknown as Record<string, unknown>)[key] = true;
  }, MARK);
}

function isMarked(page: Page): Promise<boolean> {
  return page.evaluate((key) => (window as unknown as Record<string, unknown>)[key] === true, MARK);
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) }).catch(() => undefined);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Taps menu tiles (category after category) until `count` different dishes are in the cart. A dish with modifiers
 * opens the options sheet: it is added with the defaults («Добавить · …»); one that cannot be is cancelled and skipped.
 */
async function addDishes(page: Page, count: number): Promise<string[]> {
  const tiles = page.getByRole('region', { name: 'Меню', exact: true }).getByRole('listitem').getByRole('button');
  const categories = page.getByRole('group', { name: 'Категории', exact: true }).getByRole('button');
  const cartLines = page.getByRole('list', { name: 'Новые позиции' }).getByRole('listitem');
  const sheet = page.getByRole('dialog');
  await tiles.first().waitFor({ state: 'visible', timeout: 60_000 });
  const names: string[] = [];
  const categoryCount = await categories.count();
  for (let category = 0; category < categoryCount && names.length < count; category += 1) {
    if (category > 0) await categories.nth(category).click();
    const total = await tiles.count();
    for (let index = 0; index < total && names.length < count; index += 1) {
      const tile = tiles.nth(index);
      if (await tile.isDisabled()) continue;
      const text = (await tile.innerText()).trim();
      if (/\n\s*от\s/.test(text)) continue; // "от 28 000" = the dish has variants
      const before = await cartLines.count();
      await tile.click();
      const added = async (): Promise<boolean> => (await cartLines.count()) > before;
      const outcome = await waitFor(
        `dish "${text}" in the cart (or its options sheet)`,
        async () => ((await added()) ? 'added' : (await sheet.count()) > 0 ? 'sheet' : null),
        15_000,
        100,
      );
      if (outcome === 'sheet') {
        await sheet.getByRole('button', { name: /^Добавить · / }).click();
        const accepted = await waitFor('the sheet to add the dish', added, 5_000, 100).catch(() => false);
        if (!accepted) {
          await page.keyboard.press('Escape');
          await sheet.waitFor({ state: 'hidden', timeout: 15_000 });
          continue;
        }
        await sheet.waitFor({ state: 'hidden', timeout: 15_000 });
      }
      names.push(text.split('\n')[0]?.trim() ?? text);
    }
  }
  return names;
}

/** Presses the ticket action («Начать» / «Готово») on every ticket of the table that offers it. */
async function pressOnTickets(tickets: Locator, action: string): Promise<number> {
  const buttons = tickets.getByRole('button', { name: action, exact: true });
  let pressed = 0;
  for (let guard = 0; guard < 8; guard += 1) {
    const left = await buttons.count();
    if (left === 0) break;
    await buttons.first().click();
    pressed += 1;
    await waitFor(`the «${action}» button to leave the ticket`, async () => (await buttons.count()) < left, 30_000, 150);
  }
  return pressed;
}

describe('realtime: waiter and kitchen display in two app instances', () => {
  let waiter: StartedApp;
  let cook: StartedApp;
  let waiterHub: HubTrace;
  let cookHub: HubTrace;
  let tableNumber = '';
  let dishes: string[] = [];
  let tickets: Locator;
  const timings: Record<string, number> = {};

  beforeAll(async () => {
    [waiter, cook] = await Promise.all([
      startApp({ profile: `waiter-${Date.now()}`, gatewayPort: WAITER_GATEWAY_PORT }),
      startApp({ profile: `cook-${Date.now()}`, gatewayPort: COOK_GATEWAY_PORT }),
    ]);
    waiterHub = traceHub(waiter.page);
    cookHub = traceHub(cook.page);
    for (const started of [waiter, cook]) {
      // A fresh profile has no session: the start-up POST /auth/refresh answers 401 and Chromium logs it.
      await started.page.getByRole('form', { name: 'Вход в RestaurantOS' }).waitFor({ state: 'visible', timeout: 90_000 });
      started.monitor.reset();
    }
    await loginWithPassword(waiter.page, ACCOUNTS.waiter);
    await loginWithPassword(cook.page, ACCOUNTS.cook);
  });

  afterAll(async () => {
    writeFileSync(path.join(SCENARIO_DIR, 'timings.json'), JSON.stringify(timings, null, 2));
    if (waiter) await shot(waiter.page, '99-waiter-final');
    if (cook) await shot(cook.page, '99-cook-final');
    await waiter?.close();
    await cook?.close();
  });

  it('opens the floor plan for the waiter and the kitchen display for the cook', async () => {
    await waiter.page.getByRole('heading', { name: 'Зал', exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
    // An empty display shows «Заданий нет» instead of the status columns: the station filter is always there.
    await cook.page.getByRole('button', { name: 'Все станции', exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
    await shot(waiter.page, '01-waiter-floor');
    await shot(cook.page, '01-cook-kitchen');
    expect(new URL(waiter.page.url()).port).toBe(String(WAITER_GATEWAY_PORT));
    expect(new URL(cook.page.url()).port).toBe(String(COOK_GATEWAY_PORT));
    await markPage(waiter.page);
    await markPage(cook.page);
  });

  it('connects both apps to the hub over a real WebSocket through the gateway', async () => {
    const backendPort = new URL(SERVER_URL).port;
    for (const [started, hub] of [[waiter, waiterHub], [cook, cookHub]] as const) {
      const live = await waitFor('a hub WebSocket that received a frame', () => hub.sockets.find((socket) => socket.frames.length > 0), 60_000);
      const socketUrl = new URL(live.url);
      expect(socketUrl.protocol).toBe('ws:');
      expect(socketUrl.pathname).toBe(HUB_PATH);
      // Through the gateway: the socket goes to the app's own origin, never straight to the backend port.
      expect(socketUrl.host).toBe(new URL(started.page.url()).host);
      expect(socketUrl.port).not.toBe(backendPort);
      expect(live.closed).toBe(false);
      // No long polling / server-sent events fallback.
      expect(hub.httpTransport).toEqual([]);
      expect(started.monitor.liveWebSockets.some((url) => url.includes(HUB_PATH))).toBe(true);
    }
  });

  it('shows the ticket on the kitchen display within 5 seconds of sending, without a reload', async () => {
    const { page } = waiter;
    const freeTable = page.getByRole('button', { name: /^Стол .+, Свободен, / }).first();
    await freeTable.waitFor({ state: 'visible', timeout: 60_000 });
    const label = (await freeTable.getAttribute('aria-label')) ?? '';
    tableNumber = /^Стол (.+?), /.exec(label)?.[1] ?? '';
    expect(tableNumber).not.toBe('');
    tickets = cook.page.getByRole('article', { name: new RegExp(`^Задание #\\d+, Стол ${escapeRegExp(tableNumber)}$`) });
    const newColumn = cook.page.getByRole('region', { name: 'Новые', exact: true });
    const ticketsBefore = await tickets.count();

    await freeTable.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Открыть заказ', exact: true }).click();
    await page.getByRole('heading', { level: 1, name: new RegExp(`Стол ${escapeRegExp(tableNumber)}`) }).waitFor({ timeout: 60_000 });
    dishes = await addDishes(page, 2);
    expect(dishes).toHaveLength(2);
    await shot(page, '02-waiter-cart');

    const cookInvocationsBefore = invocations(cookHub).length;
    const send = page.getByRole('button', { name: 'Отправить на кухню (2)', exact: true });
    await send.waitFor({ state: 'visible', timeout: 30_000 });
    const clickedAt = Date.now();
    const seen = newColumn
      .getByRole('article', { name: new RegExp(`Стол ${escapeRegExp(tableNumber)}$`) })
      .first()
      .waitFor({ state: 'visible', timeout: 60_000 })
      .then(() => Date.now());
    const acknowledged = page.waitForURL(new RegExp(`/waiter/orders/${UUID}`), { timeout: 60_000 }).then(() => Date.now());
    await send.click();
    const [seenAt, acknowledgedAt] = await Promise.all([seen, acknowledged]);
    timings.ticketAfterClickMs = seenAt - clickedAt;
    timings.ticketAfterServerAckMs = seenAt - acknowledgedAt;
    await shot(cook.page, '03-cook-ticket');
    await shot(page, '03-waiter-sent');

    // 5 s counted from the click on «Отправить на кухню» (it includes the order POSTs themselves).
    expect(timings.ticketAfterClickMs).toBeLessThanOrEqual(5_000);
    expect(await tickets.count()).toBeGreaterThan(ticketsBefore);
    const ticketText = (await tickets.allInnerTexts()).join('\n');
    for (const dish of dishes) expect(ticketText).toContain(dish);
    // The display was told over the hub and never reloaded.
    expect(invocations(cookHub).length).toBeGreaterThan(cookInvocationsBefore);
    expect(cookHub.httpTransport).toEqual([]);
    expect(await isMarked(cook.page)).toBe(true);
  });

  it('reflects «in progress» and «ready» on the waiter side without a reload', async () => {
    const panel = waiter.page.getByRole('complementary', { name: 'Заказ', exact: true });
    await waitFor('both sent items in the waiter order panel', async () => (await panel.getByText('Отправлена', { exact: true }).count()) === 2, 30_000);
    const waiterInvocationsBefore = invocations(waiterHub).length;

    expect(await pressOnTickets(tickets, 'Начать')).toBeGreaterThan(0);
    let pressedAt = Date.now();
    await waitFor('both items «Готовится» on the waiter side', async () => (await panel.getByText('Готовится', { exact: true }).count()) === 2, 30_000, 100);
    timings.waiterSeesInProgressMs = Date.now() - pressedAt;
    await shot(waiter.page, '04-waiter-in-progress');
    await shot(cook.page, '04-cook-in-progress');
    const inProgressColumn = cook.page.getByRole('region', { name: 'Готовятся', exact: true });
    expect(await inProgressColumn.getByRole('article', { name: new RegExp(`Стол ${escapeRegExp(tableNumber)}$`) }).count()).toBeGreaterThan(0);

    expect(await pressOnTickets(tickets, 'Готово')).toBeGreaterThan(0);
    pressedAt = Date.now();
    await waitFor('both items «Готова» on the waiter side', async () => (await panel.getByText('Готова', { exact: true }).count()) === 2, 30_000, 100);
    timings.waiterSeesReadyMs = Date.now() - pressedAt;
    await shot(waiter.page, '05-waiter-ready');
    await shot(cook.page, '05-cook-ready');
    for (const dish of dishes) {
      await panel.getByRole('button', { name: `Подано: ${dish}`, exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    }

    expect(timings.waiterSeesInProgressMs).toBeLessThanOrEqual(5_000);
    expect(timings.waiterSeesReadyMs).toBeLessThanOrEqual(5_000);
    expect(invocations(waiterHub).length).toBeGreaterThan(waiterInvocationsBefore);
    expect(waiterHub.httpTransport).toEqual([]);
    expect(await isMarked(waiter.page)).toBe(true);
    expect(await isMarked(cook.page)).toBe(true);
  });

  it('kept one live hub socket per app and logged no errors', () => {
    for (const [started, hub] of [[waiter, waiterHub], [cook, cookHub]] as const) {
      expect(hub.sockets.filter((socket) => !socket.closed)).toHaveLength(1);
      expect(started.monitor.errors).toEqual([]);
      expect(started.monitor.failedRequests).toEqual([]);
    }
  });

  it('closes both apps', async () => {
    const processes = [waiter.app?.process(), cook.app?.process()];
    await shot(waiter.page, '99-waiter-final');
    await shot(cook.page, '99-cook-final');
    await waiter.close();
    await cook.close();
    for (const child of processes) {
      expect(child).toBeDefined();
      await waitFor('the app process to exit', () => child?.exitCode !== null || child.signalCode !== null, 30_000);
    }
  });
});
