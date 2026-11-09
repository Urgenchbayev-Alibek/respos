import { expect, test } from '@playwright/test';
import { expectNoRawI18nKeys } from '../support/monitor';
import { openAs, settle } from '../support/session';
import { shot } from '../support/screenshots';

/**
 * Spec §16 in real browsers: waiter → kitchen (realtime, second context) → waiter serves → cashier pays →
 * stockkeeper sees the consumption. No page reloads between steps: realtime must push every change.
 */
test('order flow: waiter → KDS → waiter → cashier → stock', async ({ browser }) => {
  const waiter = await openAs(browser, 'waiter');
  const cook = await openAs(browser, 'cook');
  const sessions = [waiter, cook];
  let tableNumber = '';
  try {
    await test.step('cook opens the KDS (stays open, no reload)', async () => {
      await settle(cook.page);
      await expect(cook.page.getByText(/Онлайн/)).toBeVisible({ timeout: 15_000 });
    });

    await test.step('waiter opens a free table', async () => {
      const page = waiter.page;
      await settle(page);
      const free = page.locator('[data-testid^="table-tile-"][data-status="available"]').first();
      await expect(free).toBeVisible();
      tableNumber = ((await free.getAttribute('data-testid')) ?? '').replace('table-tile-', '');
      await free.getByRole('button').click();
      const guests = page.getByRole('dialog');
      await expect(guests).toContainText('Сколько гостей');
      await guests.getByRole('button', { name: 'Открыть заказ' }).click();
      // The order is created lazily on the first send-to-kitchen.
      await expect(page).toHaveURL(/\/waiter\/orders\/new\?tableId=/);
    });

    await test.step('waiter adds items with variant + modifiers and sends to kitchen', async () => {
      const page = waiter.page;
      await settle(page);
      await page.getByRole('button', { name: /Плов ташкентский/ }).first().click();
      const sheet = page.getByRole('dialog');
      await sheet.getByRole('button', { name: /0\.5 порции/ }).click();
      await sheet.getByRole('button', { name: /Лепёшка/ }).click();
      await sheet.getByRole('button', { name: /Добавить ·/ }).click();
      await expect(sheet).toBeHidden();
      await page.getByRole('button', { name: /^Лагман/ }).first().click();
      const sheet2 = page.getByRole('dialog');
      await sheet2.getByRole('button', { name: /^Острый/ }).click();
      await sheet2.getByRole('button', { name: /Добавить ·/ }).click();
      await expect(page.getByRole('list', { name: 'Новые позиции' }).getByRole('listitem')).toHaveCount(2);
      await page.getByRole('button', { name: /Отправить на кухню \(2\)/ }).click();
      await expect(page.getByText('Отправлено на кухню').first()).toBeVisible();
      await expect(page).toHaveURL(/\/waiter\/orders\/[0-9a-f-]{36}/);
      await expectNoRawI18nKeys(page, 'waiter order');
      await shot(page, 'waiter-order');
      waiter.monitor.expectClean('send to kitchen');
    });

    await test.step('cook sees the ticket in realtime → start → ready', async () => {
      // KDS ticket aria-label: "Задание #N, Стол <number>" (exact table, "Стол 1" must not match "Стол 10").
      const ticket = cook.page.getByLabel(new RegExp(`^Задание #\\d+, Стол ${tableNumber}$`)).first();
      await expect(ticket).toBeVisible({ timeout: 5_000 });
      await expect(ticket).toContainText('0.5 порции');
      await expect(ticket).toContainText('Лепёшка');
      await shot(cook.page, 'kds-board');
      await ticket.getByRole('button', { name: /^Начать$/ }).click();
      await expect(ticket.getByRole('button', { name: /^Готово$/ })).toBeVisible();
      await ticket.getByRole('button', { name: /^Готово$/ }).click();
      await expectNoRawI18nKeys(cook.page, 'kds');
      cook.monitor.expectClean('kds');
    });

    await test.step('waiter gets the ready toast and serves', async () => {
      const page = waiter.page;
      await expect(page.getByText('Готово к подаче').first()).toBeVisible({ timeout: 5_000 });
      const serveAll = page.getByRole('button', { name: /Подать всё готовое/ });
      await expect(serveAll).toBeVisible();
      await serveAll.click();
      await expect(serveAll).toBeHidden();
      waiter.monitor.expectClean('serve');
    });

    await test.step('cashier pays the whole order', async () => {
      const cashier = await openAs(browser, 'cashier');
      sessions.push(cashier);
      const page = cashier.page;
      await settle(page);
      const openShift = page.getByRole('button', { name: 'Открыть смену' }).first();
      if (await openShift.isVisible()) {
        await openShift.click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel(/Сумма открытия/).fill('100000');
        await dialog.getByRole('button', { name: 'Открыть смену' }).click();
        await expect(page.getByText('Смена открыта').first()).toBeVisible();
      }
      await page.getByRole('button', { name: new RegExp(`Стол ${tableNumber}\\b`) }).first().click();
      await page.getByRole('button', { name: 'Весь остаток' }).click();
      await page.getByRole('button', { name: /^Принять оплату / }).click();
      await expect(page.getByText('Заказ полностью оплачен').first()).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, 'cashier-payment');
      await expectNoRawI18nKeys(page, 'cashier');
      cashier.monitor.expectClean('payment');
    });

    await test.step('waiter floor shows the table free again (realtime)', async () => {
      const page = waiter.page;
      await page.getByRole('link', { name: 'Столы' }).first().click();
      await expect(page.getByTestId(`table-tile-${tableNumber}`)).toHaveAttribute('data-status', 'available', { timeout: 5_000 });
    });

    await test.step('stockkeeper sees the sale consumption', async () => {
      const stock = await openAs(browser, 'stock');
      sessions.push(stock);
      const page = stock.page;
      await page.getByRole('tab', { name: 'Движения' }).click();
      await settle(page);
      await expect(page.getByRole('cell', { name: 'Расход (продажа)' }).first()).toBeVisible();
      await expectNoRawI18nKeys(page, 'stock movements');
      stock.monitor.expectClean('stock');
    });
  } finally {
    for (const session of sessions) await session.close();
  }
});
