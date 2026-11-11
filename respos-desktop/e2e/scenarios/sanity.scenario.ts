import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, api, loginWithPassword, startApp, type StartedApp } from './helpers/scenario';

/** Proves the scenario infrastructure: own backend, app launch, real login, API helper, console monitor. */
describe('sanity: the desktop app against its own scenario backend', () => {
  let started: StartedApp;

  beforeAll(async () => {
    started = await startApp();
  });

  afterAll(async () => {
    await started?.close();
  });

  it('signs in as the admin and shows the dashboard without console errors', async () => {
    const { page, monitor } = started;
    // A fresh profile has no session: the web app's start-up POST /auth/refresh answers 401 and Chromium logs it.
    await page.getByRole('form', { name: 'Вход в RestaurantOS' }).waitFor({ state: 'visible', timeout: 60_000 });
    monitor.reset();

    await loginWithPassword(page, ACCOUNTS.admin);
    await page.getByRole('heading', { level: 1, name: 'Дашборд' }).waitFor({ state: 'visible', timeout: 60_000 });

    const me = await api<{ email: string }>(page, 'GET', '/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(ACCOUNTS.admin);

    expect(monitor.errors).toEqual([]);
  });
});
