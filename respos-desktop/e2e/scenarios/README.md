# Desktop end-to-end scenarios

Each `*.scenario.ts` file drives the built desktop app (Playwright `_electron`) against **its own backend**: a
database `respos_sc_<key>` in the `respos-desktop-pg` container (port 5434) and an API process started from the
published folder `D:/tmp/respos-e2e/api` in Development mode (migrations + demo seed on start).

## Run

```bash
# once (and again after backend changes), from the worktree root:
dotnet publish respos-backend/src/Restaurant.Api -c Release -o D:/tmp/respos-e2e/api
cd respos-desktop
npm run scenario sanity             # stack up → vitest e2e/scenarios/sanity.scenario.ts → stack down
npm run scenario -- sanity --keep   # leave the backend running (note the "--")
npm run scenario:all                # every scenario, one after another, summary table at the end
node scripts/scenario-stack.mjs status | down <key> | down --all
node scripts/scenario-stack.mjs stop-api <key> | start-api <key> | restart-api <key>   # database is kept
```

The app runs from `dist/` + `web-dist/` (not rebuilt by the runner). Scenario files: `D:/tmp/respos-e2e/<key>/` (`api.log`, `storage/`, `profiles/`, `result.json`).

| key | API port | key | API port | key | API port |
|---|---|---|---|---|---|
| sanity | 5090 | realtime | 5093 | resilience | 5096 |
| first-run | 5091 | cashier | 5094 | installer | 5097 |
| admin | 5092 | stock-delivery | 5095 | ui-modes | 5098 |

A new key needs a line in `PORTS` of `scripts/scenario-run.mjs`.

## Helper API (`./helpers/scenario`)

- `SERVER_URL`, `SCENARIO_KEY`, `SCENARIO_DIR` — from the runner's environment.
- `ACCOUNTS` (`admin`, `manager`, `waiter`, `cook`, `cashier`, `stock` → e-mail), `DEMO_PASSWORD`, `PINS` (`waiter`, `cashier`, `cook`).
- `startApp({ profile?, configured?, gatewayPort?, args?, printCaptureFile?, packagedExe? })` →
  `{ app?, packaged?, page, monitor, userDataDir, close }`. The profile is created under `SCENARIO_DIR/profiles`
  with `settings.json { serverUrl }`; `configured: false` gives a first-run profile (`page` = connection window);
  the same `profile` name relaunches on the same data; `packagedExe` drives a packaged exe over CDP (`app` undefined).
- `loginWithPassword(page, email, password?)` — real login form, waits for the workspace heading.
- `api<T>(page, method, path, body?, headers?)` → `{ status, body }` — fetch inside the page through the gateway
  with the web app's own access token and `X-Branch-Id` (read off its requests; refresh cookie as fallback).
- `monitor.errors`, `monitor.failedRequests`, `monitor.liveWebSockets`, `monitor.reset()`; `monitorPage(page)` for extra windows.
- `waitFor(label, check, timeoutMs?, intervalMs?)`, `waitForApi(page, path, accept, timeoutMs?)`, `trackSession(page)`;
  shell helpers stay in `../helpers/launch` (`settingsWindow`, `webAppWindow`, `clickClosing`, …).

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, api, loginWithPassword, startApp, type StartedApp } from './helpers/scenario';

describe('cashier: …', () => {
  let cashier: StartedApp;
  beforeAll(async () => {
    cashier = await startApp({ profile: 'cashier' });
    await loginWithPassword(cashier.page, ACCOUNTS.cashier); // once per account
  });
  afterAll(async () => {
    await cashier?.close();
  });

  it('opens a shift', async () => {
    const { page, monitor } = cashier;
    await page.getByRole('button', { name: 'Открыть смену' }).click();
    const shift = await api<{ status: string }>(page, 'GET', '/api/v1/cash-shifts/current');
    expect(shift.status).toBe(200);
    expect(monitor.errors).toEqual([]);
  });
});
```

## Rules for scenario authors

- One file `e2e/scenarios/<key>.scenario.ts`; use only your own port, database and `SCENARIO_DIR`.
- Never reuse a user-data dir between two running apps (one profile name = one running app); use different
  `gatewayPort`s (or none) for apps that run at the same time.
- Close every app in `afterAll` (`close()` is idempotent). Stop / start the server only with `scenario-stack.mjs`
  and only for your own key (`execFileSync(process.execPath, ['scripts/scenario-stack.mjs', 'stop-api', SCENARIO_KEY])`).
- Locate elements by role / label / text (Russian UI by default), never by CSS class names.
- Login is limited to 5 per minute per e-mail: sign in once per account and reuse the window.
- A fresh profile logs one expected console error (start-up refresh → 401): `monitor.reset()` once the login form shows.
- Never rebuild `dist/` or `web-dist/` while other scenarios run. Do not touch ports 5080–5082, 5173, 5174, 5183, 5184.
- The machine is slow under load (stack up ~2 min, down ~1 min): use generous timeouts, never fixed sleeps; 180 s per test.
