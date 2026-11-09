# E2E smoke results (spec §16 scenario, §6.1 targets)

Script: `scripts/e2e/e2e-smoke.mjs` (Node 24, built-in `fetch`, `@microsoft/signalr` 8.0.7 over WebSockets).
It runs against a real API process and the Development demo seed — no mocks.

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
dotnet run --project respos-backend/src/Restaurant.Api          # Development: migrate + demo seed, http://localhost:5080
cd scripts/e2e && npm install && node e2e-smoke.mjs             # E2E_API_URL (default http://localhost:5080/api/v1)
# optional: E2E_PERF_JSON=perf.json writes latencies + step results as JSON
```

The script is re-runnable on the same database (unique e-mails/slugs per run, picks a free table, compares report
deltas with a baseline). Each run logs in every demo user once (login limit is 5/min per IP+e-mail): do not run it more
than ~4 times per minute.

## Scenario (all steps ✔ on a freshly reset DB, 2026-11-10)

| # | Step | Checks |
|---|---|---|
| 0 | Demo users log in | admin/cook/cashier/manager/stock tokens, `/auth/me` |
| 1 | Admin creates a waiter with branch access; waiter logs in | `POST /users` 201, branch access, waiter permissions |
| — | SignalR | cook `JoinBranch` + `JoinKitchenStation(branch, null)`, waiter/cashier/stock `JoinBranch`; foreign branch refused |
| 2 | Waiter opens a table | `POST /orders` dine-in → `draft`; `GET /tables` → `occupied` + `activeOrderId`; `TableUpdated` event |
| 3 | Items with variant + modifiers | server subtotal = (variant price + Σ priceDelta) × qty; variant/modifier names in DTO |
| 3b | Send to kitchen (Idempotency-Key) | `submitted`; replay → `Idempotent-Replayed: true`; no key → 400 |
| 4 | Cook receives the ticket | `KitchenTicketCreated` ≤ 2 s; `GET /kitchen/tickets` shows it; one event/ticket; no duplicate ticket items after replay |
| 5 | Cook start → ready | ticket `in_progress` → `ready`; order `in_progress`; `KitchenTicketUpdated` |
| 6 | Waiter sees readiness | `OrderItemReady` per item + `OrderUpdated(ready)`; order `ready`; `serve-all` → `served` |
| 7 | Cashier pays | shift opened if none; half cash (replayed with same key → same payment, 1 row); overpay → 422 `payment.exceeds_due`; card rest → `paid`, `closedAt`, table `available`; `PaymentRegistered`, `TableUpdated` |
| 8 | Stock consumption | `GET /stock/movements?sourceType=order` rows for the order = active recipe × qty (g→kg, ml→l) per ingredient; balances decreased by exactly that; payment replay + extra payment (409) → movement count unchanged |
| 9 | Manager sees the sale | `/reports/sales` revenue +total, orders +1, `byDay` today; `/dashboard` salesToday/ordersToday deltas; top-items, payment-methods; order history complete; audit `payment.registered`, `user.created`; unread notifications for waiter (`order_ready`) and cook (`order_new`) |
| + | StockLow | write-off below the minimum → `StockLow` realtime event + `stock_low` notification; receipt restores the balance |
| + | Landing | `POST /public/demo-requests` → 202; `GET /public/plans` |
| + | CORS | preflight from `http://localhost:5173` and `:5174` allowed with credentials; `http://evil.example` not allowed |
| + | Tenant isolation | platform admin creates a 2nd org; its owner: demo order GET/cancel/pay → 404, demo `X-Branch-Id` → 403 `tenant.branch_forbidden`, no demo menu/orders visible |
| + | Platform / break-glass | platform admin without break-glass cannot read tenant orders (403); break-glass token: `/auth/me` 200 with the org, order read 200, write 403 |

## Performance (§6.1)

Environment: one laptop — Intel i5-1135G7 (4C/8T), 24 GB RAM, Windows 11 Pro; API = .NET 8 **Debug** build
(`dotnet Restaurant.Api.dll`, Development, console logging), PostgreSQL 16-alpine in Docker Desktop 29.9 (port 5433);
client on the same machine (localhost, no network latency). Single user flow, no concurrent load.
Latencies are client-measured round trips (`fetch` start → body read). KDS delivery = time from the start of the
`send-to-kitchen` request to the `KitchenTicketCreated` event at the cook's SignalR client (includes the request itself,
the DB commit and the push).

| Run | REST calls | p50 | p95 | max | > 2 s | KDS delivery | OrderItemReady delivery |
|---|---|---|---|---|---|---|---|
| 1 (fresh DB, cold API — JIT/first queries) | 76 | 43 ms | 380 ms | 687 ms (`POST /auth/login`) | 0 | 370 ms | 82 ms |
| 2 (warm) | 75 | 23 ms | 223 ms | 284 ms (`POST /auth/login`) | 0 | 64 ms | 35 ms |
| 3 (warm) | 75 | 23 ms | 262 ms | 374 ms (`POST /auth/login`) | 0 | 46 ms | 64 ms |
| 4 (final code, fresh DB, cold API, right after the test suite) | 76 | 59 ms | 565 ms | 1241 ms (`POST /auth/login`) | 0 | 720 ms | 72 ms |
| 5 (final code, warm) | 75 | 28 ms | 284 ms | 531 ms (`POST /platform/organizations`) | 0 | 60 ms | 35 ms |

Targets: typical API request ≤ 2 s — **met** (max 1.24 s cold, ≤ 0.53 s warm); KDS event delivery ≤ 2 s — **met**
(≤ 0.72 s cold, ≤ 0.07 s warm). Slowest calls are password hashing (`/auth/login`, `POST /users`,
`POST /platform/organizations`) — by design. Page-load (≤ 3 s) is a frontend measurement and not covered here.
Not measured: behaviour under concurrent load, over a real network, or with a Release build — repeat on the staging host.

## Backend issues found by the run (fixed, with integration tests)

- `POST /payments` checked the cash shift before the order → paying a foreign/unknown order returned 422 `cash_shift.not_open`
  instead of 404. Order lookup now comes first (`PaymentsTests.Paying_another_tenants_order_is_404_even_without_an_open_shift`).
- Platform endpoints ran in the tenant scope of the token's `org` claim → a platform admin who is also an org member got
  500 on `POST /platform/organizations` (cross-tenant write rejected). `[PlatformScope]` clears the tenant for platform
  controllers (`PlatformScopeTests`).
- Known noise: a refused `JoinBranch` (expected `HubException`) is logged by SignalR at `ERR` with a stack trace.

# UI smoke in a real browser (Playwright)

Folder: `scripts/ui-smoke/` (`@playwright/test` 1.64.1, Chromium only, sequential, trace + screenshot on failure).
Runs against the real dev servers — API :5080 (Development seed), admin :5173, landing :5174. No mocks.

```bash
cd scripts/ui-smoke && npm install && npx playwright install chromium
npx playwright test            # all specs; report: npx playwright show-report
npm run typecheck
# env: UI_ADMIN_URL, UI_LANDING_URL, UI_API_URL, UI_DEMO_PASSWORD; UI_SCREENSHOTS=0 skips doc screenshots,
# UI_CRAWL_SHOTS=1 saves a full-page PNG of every crawled screen into test-results/
```

| Spec | Covers |
|---|---|
| `01-auth` | UI login for all 8 demo users → right workspace; reload restores the session from the httpOnly refresh cookie cross-port (5173 → 5080, CORS with credentials); wrong password; deep link → login; cook → admin = 403 page |
| `02-crawl` | every screen of every workspace (42): no console errors, no unexpected 4xx/5xx or failed requests, no leaked i18n keys, no horizontal scroll, no screen stuck in loading |
| `03-multitab` | two tabs of one session reloading concurrently stay signed in |
| `10-admin` | dashboard numbers, users list + create, menu edit, floor plan, reservation create, orders drawer, inventory receipt movement, reports chart + tabs, audit log, notifications bell, settings save, RU → UZ → RU |
| `20-order-flow` | waiter opens table → plov (variant + modifier) + lagman (modifier) → send; cook (2nd context) gets the ticket via SignalR without reload → start → ready; waiter gets the toast → serve all; cashier (opens shift if needed) pays the rest → paid; table free again; stockkeeper sees the sale consumption |
| `30-platform-landing` | platform organizations + system page; landing home, demo form → 202 → success state; landing on a phone |
| `40-mobile-logout` | waiter workspace at 390×844 (floor, orders, reservations, new order): no horizontal scroll; logout → reload stays on login |

Sessions are reused between specs through `.auth/<role>.json` (git-ignored); the rotated refresh cookie is written back
after each test, so one run logs every user in once (login limit 5/min per IP+e-mail). The demo form is limited to
5 requests/hour per IP — more runs per hour make the landing test fail with 429.

Bugs found and fixed by the first run (2026-11-10): floor plan rendered seeded pixel coordinates as grid cells (4 700 px
horizontal scroll, tiles of different areas stacked); `/auth/refresh` limited per IP (20/min) — a full suite, or a
restaurant's tablets behind one NAT reloading together, got 429 and were logged out (now per refresh cookie); waiter
topbar overflowed a 390 px phone; reports period presets wrapped and the chart `<figure>` overflowed its card; platform
system page showed a 40-char git SHA, `0h 16m`, raw `ok`; stock movement column "Остаток" for the change and English
consumption reason "Order #N". Screenshots: `docs/design/assets/screenshots/`.
