// Curated screenshot list. Every entry names its session (see SESSIONS in lib.mjs), the themes to shoot and a
// `run(page, ctx)` that brings the screen to the wanted state. Elements are located by role / label / text and by
// the data attributes the test suites already rely on, so the list keeps working after a visual redesign.
import { closeDialog, escapeRegExp, loginViaUi, navigate, orderLabel, pause, revealAll, settle } from './lib.mjs';

const BOTH = ['light', 'dark'];
const LIGHT = ['light'];
/** KDS has one fixed dark theme. */
const KDS = ['dark'];

async function open(page, path, ready) {
  await navigate(page, path);
  await settle(page);
  if (ready) await ready.first().waitFor({ state: 'visible', timeout: 20_000 });
}

async function openLanding(page, path, { reveal = true } = {}) {
  await page.goto(path);
  await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 20_000 });
  await settle(page);
  if (reveal) await revealAll(page);
}

/** Opens the edit dialog of a menu item from the admin menu list. */
export async function openMenuItemDialog(page) {
  const rows = page.getByRole('row');
  const named = rows.filter({ hasText: 'Лагман' });
  const row = (await named.count()) > 0 ? named.first() : rows.nth(1);
  await row.getByRole('button', { name: /Редактировать|Действия/ }).first().click();
  const editItem = page.getByRole('menuitem', { name: /Редактировать|Изменить/ });
  if (await editItem.count()) await editItem.first().click();
  await page.getByRole('dialog').first().waitFor({ state: 'visible' });
}

export async function openOrderDrawer(page) {
  await page.getByRole('row').nth(1).click();
  await page.getByRole('dialog').first().waitFor({ state: 'visible' });
}

/** Waiter: free table → guest count → the new-order screen (the order itself is created only on "send"). */
export async function openNewOrder(page) {
  await open(page, '/waiter');
  const free = page.locator('[data-testid^="table-tile-"][data-status="available"]').first();
  await free.waitFor({ state: 'visible', timeout: 20_000 });
  await free.getByRole('button').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Открыть заказ' }).click();
  await page.waitForURL(/\/waiter\/orders\/new\?tableId=/);
  await settle(page);
}

export const menuItemButton = (page, name) => page.getByRole('button', { name: new RegExp(escapeRegExp(name)) }).first();

async function openModifierSheet(page, ctx) {
  const { modifierItemName } = await ctx.data();
  await openNewOrder(page);
  await menuItemButton(page, modifierItemName).click();
  await page.getByRole('dialog').first().waitFor({ state: 'visible' });
  await pause(page, 500);
}

/** Cashier: opens the shift when needed and selects the prepared unpaid order. */
async function openCashierOrder(page, ctx) {
  const { payOrderNumber } = await ctx.data();
  await open(page, '/cashier');
  const openShift = page.getByRole('button', { name: 'Открыть смену' }).first();
  if (await openShift.isVisible()) {
    await openShift.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Сумма открытия/).fill('100000');
    await dialog.getByRole('button', { name: 'Открыть смену' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await settle(page);
  }
  await page.getByRole('button', { name: orderLabel(payOrderNumber) }).first().click();
  await page.getByRole('button', { name: 'Разделить счёт' }).waitFor({ state: 'visible', timeout: 20_000 });
  await settle(page);
}

/** Shared-device lock screen. The registered device lives in `.auth/device.json`; it is registered once. */
async function openLockScreen(page) {
  const heading = page.getByRole('heading', { name: 'Кто работает?' });
  await page.goto('/device');
  if (!(await heading.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false))) {
    await loginViaUi(page, 'manager');
    await open(page, '/admin/staff/devices');
    await page.getByRole('button', { name: 'Сделать это устройство общим' }).click();
    await page.getByRole('dialog').getByLabel(/Название/).fill('Design shots tablet');
    await page.getByRole('dialog').getByRole('button', { name: 'Подключить' }).click();
    await page.waitForURL(/\/device/, { timeout: 30_000 });
    await heading.waitFor({ state: 'visible', timeout: 20_000 });
  }
  await settle(page);
}

const reportsTab = (name) => async (page) => {
  await open(page, '/admin/reports', page.getByRole('tab', { name }));
  await page.getByRole('tab', { name }).click();
  await settle(page);
  await pause(page, 600);
};

export const SCREENS = [
  { id: 'login', title: 'Login', group: 'auth', session: 'anon-desktop', themes: BOTH,
    run: async (page) => { await page.goto('/login'); await page.getByRole('button', { name: 'Войти' }).waitFor(); await settle(page); } },

  { id: 'admin-dashboard', title: 'Admin dashboard', group: 'admin', session: 'owner-desktop', themes: BOTH,
    run: (page) => open(page, '/admin', page.locator('main').getByText(/сум|UZS/)) },
  { id: 'admin-menu', title: 'Menu list', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/menu', page.getByRole('row').nth(1)) },
  { id: 'admin-menu-item-modal', title: 'Menu item form (modal)', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: async (page) => { await open(page, '/admin/menu', page.getByRole('row').nth(1)); await openMenuItemDialog(page); await pause(page, 500); },
    cleanup: closeDialog },
  { id: 'admin-orders-drawer', title: 'Orders list with the order drawer', group: 'admin', session: 'owner-desktop', themes: BOTH,
    run: async (page) => { await open(page, '/admin/orders', page.getByRole('row').nth(1)); await openOrderDrawer(page); await settle(page); await pause(page, 500); },
    cleanup: closeDialog },
  { id: 'admin-tables-floor', title: 'Tables floor plan', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/tables', page.getByRole('tab', { name: /План зала/ })) },
  { id: 'admin-reservations', title: 'Reservations', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/reservations', page.getByRole('button', { name: /Новая бронь/ })) },
  { id: 'admin-guests', title: 'Guests list', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/customers', page.getByRole('table').getByRole('link')) },
  { id: 'admin-guest-card', title: 'Guest card', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: async (page) => {
      await open(page, '/admin/customers', page.getByRole('table').getByRole('link'));
      await page.getByRole('table').getByRole('link').first().click();
      await page.waitForURL(/\/admin\/customers\/[0-9a-f-]{36}/);
      await settle(page);
    } },
  { id: 'admin-inventory', title: 'Inventory', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/inventory', page.getByRole('table')) },
  { id: 'admin-reports-sales', title: 'Reports: sales chart', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: async (page) => { await open(page, '/admin/reports', page.getByRole('tab', { name: 'ABC-анализ' })); await pause(page, 1200); } },
  { id: 'admin-reports-abc', title: 'Reports: ABC analysis', group: 'admin', session: 'owner-desktop', themes: LIGHT, run: reportsTab('ABC-анализ') },
  { id: 'admin-reports-heatmap', title: 'Reports: heatmap', group: 'admin', session: 'owner-desktop', themes: LIGHT, run: reportsTab('Тепловая карта') },
  { id: 'admin-staff-schedule', title: 'Staff schedule', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/staff/schedule', page.locator('main').getByRole('heading')) },
  { id: 'admin-delivery-board', title: 'Delivery board', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/delivery', page.locator('main').getByRole('heading')) },
  { id: 'admin-users', title: 'Users', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/users', page.getByText('waiter@demo.respos.uz', { exact: true })) },
  { id: 'admin-role-editor', title: 'Role editor', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: async (page, ctx) => open(page, `/admin/roles/${(await ctx.data()).roleId}`, page.getByRole('checkbox')) },
  { id: 'admin-settings', title: 'Settings', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/settings', page.getByLabel(/^Название/)) },
  { id: 'admin-integrations', title: 'Integrations', group: 'admin', session: 'owner-desktop', themes: LIGHT,
    run: (page) => open(page, '/admin/integrations', page.getByText('Telegram-бот')) },

  { id: 'waiter-floor-tablet', title: 'Waiter floor (tablet)', group: 'waiter', session: 'waiter-tablet', themes: LIGHT,
    run: (page) => open(page, '/waiter', page.locator('[data-testid^="table-tile-"]')) },
  { id: 'waiter-order-sheet-tablet', title: 'Waiter order with the modifier sheet (tablet)', group: 'waiter', session: 'waiter-tablet', themes: BOTH,
    run: openModifierSheet, cleanup: closeDialog },
  { id: 'waiter-floor-phone', title: 'Waiter floor (phone)', group: 'waiter', session: 'waiter-phone', themes: LIGHT,
    run: (page) => open(page, '/waiter', page.locator('[data-testid^="table-tile-"]')) },
  { id: 'waiter-order-sheet-phone', title: 'Waiter order with the modifier sheet (phone)', group: 'waiter', session: 'waiter-phone', themes: BOTH,
    run: openModifierSheet, cleanup: closeDialog },

  { id: 'cashier-payment', title: 'Cashier payment', group: 'cashier', session: 'cashier-tablet', themes: LIGHT, run: openCashierOrder },
  { id: 'cashier-split-dialog', title: 'Cashier split bill dialog', group: 'cashier', session: 'cashier-tablet', themes: LIGHT,
    run: async (page, ctx) => {
      await openCashierOrder(page, ctx);
      await page.getByRole('button', { name: 'Разделить счёт' }).click();
      await page.getByRole('dialog').first().waitFor({ state: 'visible' });
      await pause(page, 500);
    },
    cleanup: closeDialog },

  { id: 'kds-board', title: 'KDS board', group: 'kitchen', session: 'cook-kds', themes: KDS,
    run: (page) => open(page, '/kitchen', page.getByLabel(/^Задание #\d+/)) },
  { id: 'device-lock', title: 'Shared-device lock screen', group: 'device', session: 'device-tablet', themes: LIGHT, run: openLockScreen },
  { id: 'platform-organizations', title: 'Platform: organizations', group: 'platform', session: 'platform-desktop', themes: LIGHT,
    run: (page) => open(page, '/platform', page.getByRole('table')) },

  { id: 'landing-home', title: 'Landing home', group: 'landing', session: 'landing-desktop', themes: LIGHT, fullPage: true,
    run: (page) => openLanding(page, '/') },
  { id: 'landing-features', title: 'Landing features', group: 'landing', session: 'landing-desktop', themes: LIGHT, fullPage: true,
    run: (page) => openLanding(page, '/features') },
  { id: 'landing-pricing', title: 'Landing pricing', group: 'landing', session: 'landing-desktop', themes: LIGHT, fullPage: true,
    run: (page) => openLanding(page, '/pricing') },
  { id: 'landing-demo', title: 'Landing demo request form', group: 'landing', session: 'landing-desktop', themes: LIGHT,
    run: async (page) => { await openLanding(page, '/demo', { reveal: false }); await page.getByLabel(/Ваше имя/).waitFor(); } },
  { id: 'landing-booking', title: 'Landing booking', group: 'landing', session: 'landing-desktop', themes: LIGHT,
    run: (page) => openLanding(page, '/booking', { reveal: false }) },
  { id: 'landing-home-phone', title: 'Landing home (phone)', group: 'landing', session: 'landing-phone', themes: LIGHT, fullPage: true,
    run: (page) => openLanding(page, '/') },
  { id: 'landing-booking-phone', title: 'Landing booking (phone)', group: 'landing', session: 'landing-phone', themes: LIGHT,
    run: (page) => openLanding(page, '/booking', { reveal: false }) },
  { id: 'qr-menu-phone', title: 'Public QR menu (phone)', group: 'landing', session: 'landing-phone', themes: LIGHT,
    run: async (page) => { await openLanding(page, '/menu/demo?table=2', { reveal: false }); await page.getByText(/UZS|сум/).first().waitFor(); } },
];
