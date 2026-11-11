// Short interaction clips (WebM, 3–6 s). `run(page, ctx)` sets the screen up and wraps only the interaction in
// `ctx.record(...)`, so a clip starts right before the motion. Pointer clicks are used on purpose: keyboard-driven
// actions are allowed to stay instant. Anything a clip changes is put back after the recording stops.
import { closeDialog, navigate, pause, settle } from './lib.mjs';
import { menuItemButton, openMenuItemDialog, openNewOrder, openOrderDrawer } from './screens.mjs';

const userMenuButton = (page) => page.getByRole('banner').getByRole('button', { name: 'Меню пользователя' });

async function pickTheme(page, label) {
  const item = page.getByRole('menuitem', { name: label }).or(page.getByRole('menuitemradio', { name: label })).first();
  if (!(await item.isVisible())) await userMenuButton(page).click();
  await item.click();
}

async function go(page, path) {
  await navigate(page, path);
  await settle(page);
}

export const CLIPS = [
  { id: 'modal-open-close', title: 'Modal opens and closes (menu item form)', group: 'admin', session: 'owner-desktop',
    run: async (page, ctx) => {
      await go(page, '/admin/menu');
      await ctx.record(async () => {
        await pause(page, 400);
        await openMenuItemDialog(page);
        await pause(page, 1300);
        await closeDialog(page);
        await pause(page, 900);
      });
    } },
  { id: 'drawer-open-close', title: 'Drawer opens and closes (order details)', group: 'admin', session: 'owner-desktop',
    run: async (page, ctx) => {
      await go(page, '/admin/orders');
      await ctx.record(async () => {
        await pause(page, 400);
        await openOrderDrawer(page);
        await pause(page, 1500);
        await closeDialog(page);
        await pause(page, 900);
      });
    } },
  { id: 'user-dropdown', title: 'User dropdown menu', group: 'admin', session: 'owner-desktop',
    run: async (page, ctx) => {
      await go(page, '/admin');
      await ctx.record(async () => {
        await pause(page, 400);
        await userMenuButton(page).click();
        await page.getByRole('menu').first().waitFor({ state: 'visible' });
        await pause(page, 1400);
        await page.mouse.click(400, 500);
        await pause(page, 900);
      });
      if (await page.getByRole('menu').first().isVisible()) await page.keyboard.press('Escape');
    } },
  { id: 'toast', title: 'Toast appears after saving settings', group: 'admin', session: 'owner-desktop',
    run: async (page, ctx) => {
      await go(page, '/admin/settings');
      const name = page.getByLabel(/^Название/).first();
      const save = page.getByRole('button', { name: /Сохранить/ }).first();
      const original = await name.inputValue();
      await name.fill(original.endsWith('.') ? original.slice(0, -1) : `${original}.`);
      try {
        await ctx.record(async () => {
          await pause(page, 400);
          await save.click();
          await page.getByText('Настройки организации сохранены').first().waitFor({ state: 'visible' });
          await pause(page, 1800);
        });
      } finally {
        await name.fill(original);
        await save.click();
        await pause(page, 1500);
      }
    } },
  { id: 'tab-switch', title: 'Tab switch (reports)', group: 'admin', session: 'owner-desktop',
    run: async (page, ctx) => {
      await go(page, '/admin/reports');
      const first = page.getByRole('tab').first();
      await ctx.record(async () => {
        await pause(page, 400);
        await page.getByRole('tab', { name: 'ABC-анализ' }).click();
        await pause(page, 1300);
        await page.getByRole('tab', { name: 'Тепловая карта' }).click();
        await pause(page, 1300);
        await first.click();
        await pause(page, 1100);
      });
    } },
  { id: 'sidebar-collapse', title: 'Sidebar collapses and expands', group: 'admin', session: 'owner-desktop',
    run: async (page, ctx) => {
      await go(page, '/admin');
      await ctx.record(async () => {
        await pause(page, 400);
        await page.getByRole('button', { name: 'Свернуть меню' }).click();
        await pause(page, 1300);
        await page.getByRole('button', { name: 'Развернуть меню' }).click();
        await pause(page, 1300);
      });
    } },
  { id: 'theme-toggle', title: 'Theme toggle (light → dark → light)', group: 'admin', session: 'owner-desktop',
    run: async (page, ctx) => {
      await go(page, '/admin');
      try {
        await ctx.record(async () => {
          await pause(page, 400);
          await userMenuButton(page).click();
          await pause(page, 600);
          await pickTheme(page, 'Тема: тёмная');
          await pause(page, 1500);
          await pickTheme(page, 'Тема: светлая');
          await pause(page, 1300);
        });
      } finally {
        // The stored preference must stay "system": screenshots switch themes through prefers-color-scheme.
        await pickTheme(page, 'Тема: как в системе');
        if (await page.getByRole('menu').first().isVisible()) await page.keyboard.press('Escape');
      }
    } },

  { id: 'waiter-add-item', title: 'Waiter adds items to the cart', group: 'waiter', session: 'waiter-tablet',
    run: async (page, ctx) => {
      const { simpleItemName, simpleItemCategory, modifierItemName, modifierItemCategory } = await ctx.data();
      const showCategory = async (item, category) => {
        if (await menuItemButton(page, item).isVisible()) return;
        await page.getByRole('button', { name: category, exact: true }).or(page.getByRole('tab', { name: category, exact: true })).first().click();
        await pause(page, 500);
      };
      await openNewOrder(page);
      await showCategory(simpleItemName, simpleItemCategory);
      await ctx.record(async () => {
        await pause(page, 400);
        await menuItemButton(page, simpleItemName).click();
        await pause(page, 600);
        await menuItemButton(page, simpleItemName).click();
        await pause(page, 700);
        await showCategory(modifierItemName, modifierItemCategory);
        await menuItemButton(page, modifierItemName).click();
        const sheet = page.getByRole('dialog').first();
        await sheet.waitFor({ state: 'visible' });
        await pause(page, 1100);
        await sheet.getByRole('button', { name: /Добавить ·/ }).click();
        await pause(page, 1200);
      });
    } },
  { id: 'kds-ticket-status', title: 'KDS ticket status change (new → in progress)', group: 'kitchen', session: 'cook-kds',
    run: async (page, ctx) => {
      await ctx.data();
      await go(page, '/kitchen');
      const start = page.getByRole('button', { name: /^Начать$/ }).first();
      await start.waitFor({ state: 'visible', timeout: 20_000 });
      await ctx.record(async () => {
        await pause(page, 600);
        await start.click();
        await pause(page, 2600);
      });
    } },

  { id: 'landing-home-scroll', title: 'Landing home loads and scrolls', group: 'landing', session: 'landing-desktop',
    run: async (page, ctx) => {
      await page.goto('about:blank');
      await ctx.record(async () => {
        await page.goto('/');
        await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible' });
        await pause(page, 1200);
        await page.mouse.move(720, 450);
        for (let step = 0; step < 14; step += 1) {
          await page.mouse.wheel(0, 220);
          await pause(page, 180);
        }
        await pause(page, 900);
      });
    } },
  { id: 'landing-mobile-menu', title: 'Landing mobile menu opens and closes', group: 'landing', session: 'landing-phone',
    run: async (page, ctx) => {
      await page.goto('/');
      await settle(page);
      const toggle = page.getByRole('banner').locator('button[aria-expanded]').first();
      await ctx.record(async () => {
        await pause(page, 400);
        await toggle.click();
        await pause(page, 1500);
        await toggle.click();
        await pause(page, 1100);
      });
    } },
  { id: 'qr-menu-category', title: 'QR menu category switch', group: 'landing', session: 'landing-phone',
    run: async (page, ctx) => {
      await page.goto('/menu/demo?table=2');
      await page.getByText(/UZS|сум/).first().waitFor({ state: 'visible', timeout: 20_000 });
      await settle(page);
      const chips = page.getByRole('navigation').getByRole('link');
      const count = await chips.count();
      await ctx.record(async () => {
        await pause(page, 500);
        for (const index of [2, 4, 1]) {
          if (index >= count) continue;
          await chips.nth(index).click();
          await pause(page, 1300);
        }
      });
    } },
];
