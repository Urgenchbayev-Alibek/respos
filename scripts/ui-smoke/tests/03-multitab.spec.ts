import { expect, test } from '@playwright/test';
import { homeUrl } from '../support/env';
import { PageMonitor } from '../support/monitor';
import { openAs } from '../support/session';

/**
 * Two tabs share one refresh cookie. Reloading both at once (or both waking up after sleep) sends two refreshes
 * with the same token — the second must not be treated as token theft that logs the user out everywhere.
 */
const STAGGER_MS = Number(process.env.UI_STAGGER_MS ?? 40);

test('two tabs reloading at the same time both stay signed in', async ({ browser }) => {
  const session = await openAs(browser, 'manager');
  const second = await session.context.newPage();
  const secondMonitor = new PageMonitor(second, 'manager tab 2');
  try {
    await second.goto('/admin');
    await expect(second).toHaveURL(homeUrl('manager'));
    const refreshes = [session.page, second].map((p) => p.waitForResponse((r) => r.url().includes('/auth/refresh')));
    // Tab 2 starts while tab 1's refresh is still in flight (DB already rotated, new cookie not yet received).
    await Promise.all([session.page.reload(), second.waitForTimeout(STAGGER_MS).then(() => second.reload())]);
    const statuses = await Promise.all(refreshes.map(async (r) => (await r).status()));
    expect(statuses).toEqual([200, 200]);
    await expect(session.page).toHaveURL(homeUrl('manager'));
    await expect(second).toHaveURL(homeUrl('manager'));
    // The cookie left in the jar still works: a third load restores the session.
    const third = second.waitForResponse((r) => r.url().includes('/auth/refresh'));
    await second.reload();
    expect((await third).status()).toBe(200);
    session.monitor.expectClean('tab 1');
    secondMonitor.expectClean('tab 2');
  } finally {
    await session.close();
  }
});
