import { expect, test, type Page } from '@playwright/test';
import { expectNoRawI18nKeys } from '../support/monitor';
import { openAs, settle, type RoleSession } from '../support/session';
import { shot } from '../support/screenshots';

const stamp = Date.now().toString(36);

/** Clicks an item of the admin sidebar (real in-app navigation, no reload). */
async function openSection(page: Page, name: RegExp, path: string): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name }).first().click();
  await expect(page).toHaveURL(new RegExp(`${path}(?:[?#]|$)`));
  await settle(page);
}

async function check(session: RoleSession, where: string): Promise<void> {
  await expectNoRawI18nKeys(session.page, where);
  session.monitor.expectClean(where);
}

test('admin panel: main sections work against the real API', async ({ browser }) => {
  const session = await openAs(browser, 'owner');
  const { page } = session;
  try {
    await test.step('dashboard renders numbers', async () => {
      await settle(page);
      const main = page.locator('main');
      await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(main).toContainText(/\d/);
      await expect(main.getByText(/сум|UZS/).first()).toBeVisible();
      await shot(page, 'admin-dashboard');
      await check(session, 'dashboard');
    });

    await test.step('users: list + create', async () => {
      await openSection(page, /Сотрудники/, '/admin/users');
      await expect(page.getByRole('table')).toBeVisible();
      await expect(page.getByText('waiter@demo.respos.uz', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /^Создать$/ }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel(/Имя и фамилия/).fill(`UI Smoke ${stamp}`);
      await dialog.getByLabel(/Email/).fill(`ui.${stamp}@demo.respos.uz`);
      await dialog.getByLabel(/Временный пароль/).fill('Smoke123!pass');
      await dialog.getByRole('checkbox', { name: /Официант/ }).check();
      await dialog.getByRole('button', { name: /^Создать$/ }).click();
      await expect(page.getByText('Сотрудник создан')).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(page.getByText(`ui.${stamp}@demo.respos.uz`)).toBeVisible();
      await check(session, 'users');
    });

    await test.step('menu: list + edit item', async () => {
      await openSection(page, /^Меню$/, '/admin/menu');
      const row = page.getByRole('row').filter({ hasText: 'Лагман' }).first();
      await expect(row).toBeVisible();
      await row.getByRole('button', { name: /Редактировать|Действия/ }).first().click();
      const editItem = page.getByRole('menuitem', { name: /Редактировать|Изменить/ });
      if (await editItem.count()) await editItem.first().click();
      const dialog = page.getByRole('dialog', { name: /Редактирование блюда/ });
      await expect(dialog).toBeVisible();
      const description = dialog.getByLabel(/Описание/);
      await description.fill(`Обновлено UI smoke ${stamp}`);
      await dialog.getByRole('button', { name: /Сохранить/ }).click();
      await expect(dialog).toBeHidden();
      await check(session, 'menu');
    });

    await test.step('tables: floor plan', async () => {
      await openSection(page, /Залы и столы/, '/admin/tables');
      await expect(page.getByRole('tab', { name: /План зала/ })).toBeVisible();
      await expect(page.getByText(/Стол|^\d+$/).first()).toBeVisible();
      await page.getByRole('tab', { name: /Список/ }).click();
      await expect(page.getByRole('table')).toBeVisible();
      await check(session, 'tables');
    });

    await test.step('reservations: create', async () => {
      await openSection(page, /Бронирования/, '/admin/reservations');
      await page.getByRole('button', { name: /Новая бронь/ }).first().click();
      const dialog = page.getByRole('dialog', { name: /Новая бронь/ });
      await dialog.getByLabel(/Имя гостя/).fill(`Гость ${stamp}`);
      await dialog.getByLabel(/Телефон/).fill('+998901234567');
      await dialog.getByLabel(/Количество гостей/).fill('3');
      await dialog.getByLabel(/^Начало/).fill('23:00');
      await dialog.getByLabel(/^Окончание/).fill('23:45');
      await dialog.getByRole('button', { name: /Сохранить/ }).click();
      await expect(page.getByText('Бронь создана')).toBeVisible();
      await expect(page.getByText(`Гость ${stamp}`).first()).toBeVisible();
      await check(session, 'reservations');
    });

    await test.step('orders: list + detail drawer', async () => {
      await openSection(page, /^Заказы$/, '/admin/orders');
      const firstRow = page.getByRole('row').nth(1);
      await expect(firstRow).toBeVisible();
      await firstRow.click();
      const drawer = page.getByRole('dialog');
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText(/UZS/);
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await check(session, 'orders');
    });

    await test.step('inventory: list + receipt movement', async () => {
      await openSection(page, /^Склад$/, '/admin/inventory');
      await expect(page.getByRole('table')).toBeVisible();
      await page.getByRole('button', { name: /^Движение$/ }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel(/Ингредиент/).selectOption({ index: 1 });
      await dialog.getByLabel(/Тип операции/).selectOption('receipt');
      await dialog.getByLabel(/Количество/).fill('1.5');
      await dialog.getByLabel(/Причина/).fill(`UI smoke ${stamp}`);
      await dialog.getByRole('button', { name: /Сохранить|Провести/ }).click();
      await expect(page.getByText('Движение сохранено')).toBeVisible();
      await page.getByRole('tab', { name: /Движения/ }).click();
      await expect(page.getByText(`UI smoke ${stamp}`).first()).toBeVisible();
      await check(session, 'inventory');
    });

    await test.step('reports: sales chart', async () => {
      await openSection(page, /Отчёты/, '/admin/reports');
      await expect(page.locator('.recharts-surface').first()).toBeVisible();
      await expect(page.locator('main')).toContainText(/UZS/);
      await shot(page, 'admin-reports');
      for (const tab of ['Блюда', 'Способы оплаты', 'Склад', 'Смены']) {
        await page.getByRole('tab', { name: tab }).click();
        await settle(page);
        await check(session, `reports/${tab}`);
      }
    });

    await test.step('audit logs', async () => {
      await openSection(page, /Журнал аудита/, '/admin/audit-logs');
      await expect(page.getByRole('table')).toBeVisible();
      await expect(page.getByText('auth.login_succeeded').first()).toBeVisible();
      await check(session, 'audit');
    });

    await test.step('notifications bell', async () => {
      await page.getByRole('button', { name: /^Уведомления/ }).first().click();
      await expect(page.getByRole('dialog').or(page.getByRole('menu')).first()).toBeVisible();
      await page.keyboard.press('Escape');
      await check(session, 'bell');
    });

    await test.step('settings: organization form', async () => {
      await openSection(page, /Настройки/, '/admin/settings');
      await expect(page.getByText('Организация').first()).toBeVisible();
      const name = page.getByLabel(/^Название/).first();
      const original = await name.inputValue();
      await name.fill(`${original} `);
      await name.fill(original.endsWith('.') ? original.slice(0, -1) : `${original}.`);
      await page.getByRole('button', { name: /Сохранить/ }).first().click();
      await expect(page.getByText('Настройки организации сохранены')).toBeVisible();
      await name.fill(original);
      await page.getByRole('button', { name: /Сохранить/ }).first().click();
      await expect(page.getByText('Настройки организации сохранены').first()).toBeVisible();
      await check(session, 'settings');
    });

    await test.step('language switch RU → UZ → RU', async () => {
      await page.getByRole('banner').getByRole('button', { name: 'Язык интерфейса' }).click();
      await page.getByRole('menuitem', { name: /Oʻzbekcha/ }).or(page.getByRole('menuitemradio', { name: /Oʻzbekcha/ })).first().click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'uz');
      await expect(page.getByRole('navigation')).toContainText(/Sozlamalar/);
      await expectNoRawI18nKeys(page, 'settings (uz)');
      await openSection(page, /Hisobotlar/, '/admin/reports');
      await expectNoRawI18nKeys(page, 'reports (uz)');
      await page.getByRole('banner').getByRole('button', { name: 'Interfeys tili' }).click();
      await page.getByRole('menuitem', { name: /Русский/ }).or(page.getByRole('menuitemradio', { name: /Русский/ })).first().click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
      session.monitor.expectClean('language');
    });
  } finally {
    await session.close();
  }
});
