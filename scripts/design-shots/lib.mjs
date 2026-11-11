// Shared helpers of the capture harness: Playwright from scripts/ui-smoke, role sessions, navigation, demo data.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// No own dependencies: the browser automation library is the one installed for scripts/ui-smoke.
const requireFromUiSmoke = createRequire(resolve(HERE, '..', 'ui-smoke', 'package.json'));
export const { chromium } = requireFromUiSmoke('@playwright/test');

export const ROOT = resolve(HERE, '..', '..');
export const AUTH_DIR = resolve(HERE, '.auth');
export const ADMIN_URL = process.env.DESIGN_ADMIN_URL ?? 'http://localhost:5183';
export const LANDING_URL = process.env.DESIGN_LANDING_URL ?? 'http://localhost:5184';
export const API_URL = (process.env.DESIGN_API_URL ?? 'http://localhost:5082/api/v1').replace(/\/$/, '');
const DEMO_PASSWORD = process.env.DESIGN_DEMO_PASSWORD ?? 'Demo123!';
/** Comment of the orders this harness creates, so later runs find and reuse them. */
const MARKER = 'design-shots';

export const USERS = {
  owner: 'owner@demo.respos.uz',
  manager: 'manager@demo.respos.uz',
  waiter: 'waiter@demo.respos.uz',
  cook: 'cook@demo.respos.uz',
  cashier: 'cashier@demo.respos.uz',
  superadmin: 'superadmin@respos.uz',
};

const HOME = { owner: '/admin', manager: '/admin', waiter: '/waiter', cook: '/kitchen', cashier: '/cashier', superadmin: '/platform' };

export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 1024, height: 768 }, hasTouch: true },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  kds: { viewport: { width: 1920, height: 1080 } },
};

/** One browser context per entry; screens and clips name the session they run in. Order = run order. */
export const SESSIONS = {
  'anon-desktop': { app: 'admin', viewport: 'desktop' },
  'owner-desktop': { app: 'admin', role: 'owner', viewport: 'desktop' },
  'waiter-tablet': { app: 'admin', role: 'waiter', viewport: 'tablet' },
  'waiter-phone': { app: 'admin', role: 'waiter', viewport: 'phone' },
  'cashier-tablet': { app: 'admin', role: 'cashier', viewport: 'tablet' },
  'cook-kds': { app: 'admin', role: 'cook', viewport: 'kds' },
  'device-tablet': { app: 'admin', stateKey: 'device', viewport: 'tablet' },
  'platform-desktop': { app: 'admin', role: 'superadmin', viewport: 'desktop' },
  'landing-desktop': { app: 'landing', viewport: 'desktop' },
  'landing-phone': { app: 'landing', viewport: 'phone' },
};

export const pause = (page, ms) => page.waitForTimeout(ms);
export const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const orderLabel = (number) => new RegExp(`#${String(number).padStart(4, '0')}\\b`);

/** Fills the login form and waits for the role's workspace. Login is rate limited (5/min per e-mail). */
export async function loginViaUi(page, role) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel(/Email/).fill(USERS[role]);
  await page.getByLabel(/Пароль|Parol|Password/).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /Войти|Kirish|Sign in/ }).click();
  await page.waitForURL((url) => url.pathname.startsWith(HOME[role]), { timeout: 30_000 });
}

/**
 * Opens the context of a session. Signed-in sessions are chained through `.auth/<role>.json`: the refresh token
 * rotates on every page load (reusing an old one revokes the family), so the state is written back on close.
 */
export async function openSession(browser, name) {
  const def = SESSIONS[name];
  const stateKey = def.stateKey ?? def.role;
  const stateFile = stateKey ? resolve(AUTH_DIR, `${stateKey}.json`) : null;
  const hasState = stateFile !== null && existsSync(stateFile);
  const context = await browser.newContext({
    ...VIEWPORTS[def.viewport],
    baseURL: def.app === 'landing' ? LANDING_URL : ADMIN_URL,
    locale: 'ru-RU',
    timezoneId: 'Asia/Tashkent',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    ...(hasState ? { storageState: stateFile } : {}),
  });
  const page = await context.newPage();
  const saveState = async () => {
    if (!stateFile) return;
    mkdirSync(AUTH_DIR, { recursive: true });
    await context.storageState({ path: stateFile }).catch(() => undefined);
  };
  if (def.role) {
    let restored = false;
    if (hasState) {
      const refresh = page.waitForResponse((r) => r.url().includes('/auth/refresh'), { timeout: 20_000 });
      await page.goto(HOME[def.role]);
      restored = (await refresh.catch(() => null))?.ok() ?? false;
    }
    if (!restored) await loginViaUi(page, def.role);
    await saveState();
  }
  return {
    name,
    def,
    context,
    page,
    saveState,
    async close() {
      await saveState();
      await context.close();
    },
  };
}

/** Client-side navigation (React Router listens to popstate): no reload, so no extra token refresh. */
export async function navigate(page, path) {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  const pathname = path.split('?')[0];
  await page.waitForURL((url) => url.pathname === pathname);
}

/** Waits until the network is quiet and busy markers are gone. Never throws: each screen has its own ready check. */
export async function settle(page) {
  const busy = page.locator('[aria-busy="true"], [class*="skeleton" i], [class*="spinner" i]');
  for (let pass = 0; pass < 2; pass += 1) {
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await busy.first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
    await pause(page, 250);
  }
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
}

/** Scrolls through the page once so lazy / reveal-on-scroll content is rendered before a full-page shot. */
export async function revealAll(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((done) => setTimeout(done, 120));
    }
    window.scrollTo(0, 0);
  });
  await pause(page, 400);
}

/** Closes the top dialog with its own close button (pointer path); falls back to Escape. */
export async function closeDialog(page) {
  const dialog = page.getByRole('dialog').last();
  const close = dialog.getByRole('button', { name: /^(Закрыть|Отмена)$/ }).first();
  if (await close.isVisible().catch(() => false)) await close.click();
  else await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
}

async function apiLogin(email) {
  const login = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  if (!login.ok) throw new Error(`API login ${email} → ${login.status} (rate limit: 5/min per e-mail)`);
  const body = await login.json();
  const headers = {
    Authorization: `Bearer ${body.accessToken}`,
    'X-Branch-Id': body.user.branches[0].id,
    'Content-Type': 'application/json',
  };
  return async function call(method, path, data) {
    const response = await fetch(API_URL + path, {
      method,
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
}

/**
 * Makes sure the operational screens have content and returns what the screens need to find it:
 * kitchen tickets in every KDS column (3 new, 1 in progress, 1 ready), an unpaid order for the cashier,
 * menu item names for the waiter and a role id for the role editor. Only missing data is created.
 */
export async function prepareData() {
  const call = await apiLogin(USERS.owner);
  const categories = await call('GET', '/menu/pos');
  const items = categories.flatMap((category) => category.items);
  const isSimple = (item) => item.variants.length === 0 && item.modifierGroups.length === 0;
  const simple = items.filter(isSimple);
  const rich = items.find((item) => item.modifierGroups.some((group) => group.options.length > 0));
  if (simple.length === 0 || !rich) throw new Error('demo menu needs an item without options and one with modifiers');
  const categoryOf = (item) => categories.find((category) => category.items.includes(item)).name;
  const quickItem = categories.find((category) => category.items.includes(rich)).items.find(isSimple) ?? simple[0];

  const createOrder = async (index) => {
    const lines = [0, 1, 2].map((offset) => simple[(index + offset) % simple.length]);
    const order = await call('POST', '/orders', {
      type: 'takeaway',
      guestCount: 2,
      comment: MARKER,
      items: lines.map((item, position) => ({ menuItemId: item.id, variantId: null, quantity: position === 0 ? 4 : 1, modifierOptionIds: [] })),
    });
    await call('POST', `/orders/${order.id}/send-to-kitchen`, { itemIds: null });
    return order;
  };
  const advance = async (order, steps) => {
    const tickets = (await call('GET', '/kitchen/tickets')).filter((ticket) => ticket.orderId === order.id);
    for (const ticket of tickets) for (const step of steps) await call('POST', `/kitchen/tickets/${ticket.id}/${step}`, {});
  };

  const tickets = await call('GET', '/kitchen/tickets');
  const missing = (status, target) => Math.max(0, target - tickets.filter((ticket) => ticket.status === status).length);
  let created = 0;
  for (let i = missing('ready', 1); i > 0; i -= 1) await advance(await createOrder(created++), ['start', 'ready']);
  for (let i = missing('in_progress', 1); i > 0; i -= 1) await advance(await createOrder(created++), ['start']);
  for (let i = missing('new', 3); i > 0; i -= 1) await createOrder(created++);

  const active = (await call('GET', '/orders/active')).filter((order) => order.type === 'takeaway' && Number(order.total) > 0);
  const own = active.filter((order) => order.comment === MARKER);
  const payOrder = (own.length > 0 ? own : active).sort((a, b) => a.number - b.number)[0] ?? (await createOrder(created++));
  const roles = await call('GET', '/roles');
  return {
    createdOrders: created,
    payOrderNumber: payOrder.number,
    simpleItemName: quickItem.name,
    simpleItemCategory: categoryOf(quickItem),
    modifierItemName: rich.name,
    modifierItemCategory: categoryOf(rich),
    roleId: (roles.find((role) => role.code === 'manager') ?? roles[0]).id,
  };
}
