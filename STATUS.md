# STATUS

## 2026-11-10
- 01:50 — Spec read. Folder layout created. Contract v1 written (`respos-contracts/`). Questions + default assumptions → `User-Todo.md`.
- Wave 1 (parallel agents): backend foundation + full domain model; admin app foundation; landing; docs/design/ERD/ADR.
- ~02:20 — Docs agent done (design artifact, ERD, 11 ADRs, test plan, deployment, CI). Contract v1.1 (`respos-contracts/DECISIONS_v1_1.md`) resolves 13 inconsistencies.
- ~02:40 — Landing done (27 tests, lint/typecheck/build OK).
- ~02:55 — Admin foundation done (107 tests, lint/typecheck/build OK). Wave 2 frontend started in 3 worktrees (floor/menu/waiter; KDS/cashier; stock/reports/platform).
- ~03:00 — Backend foundation done (52 unit + 21 integration). Wave 2 backend started in 4 worktrees.
- ~03:35 — Wave 2 merged into `main` (7 branches, no conflicts):
  - Backend: floor/reservations/menu, orders/KDS/payments/cash shifts, inventory/recipes/procurement + idempotent consumption, reports/dashboard/notifications/audit/platform. `dotnet build` 0 warnings; `dotnet test` **150 unit + 94 integration passed**.
  - Admin app: all 18 admin sections + waiter, KDS, cashier, stock, platform. lint/typecheck OK, **159 tests passed**, build OK.
  - `scripts/check-file-length.mjs`: 966 files, none > 500 lines.
- 03:40 — Wave 3: frontend↔backend DTO alignment; live E2E (9-step spec scenario + SignalR) with backend fixes.
- ~04:00 — Contract alignment (frontend ↔ real DTOs, contract v1.2). Live API E2E (spec §16, 18 steps + SignalR) passes; bugs fixed (cross-tenant payment check, platform scope, reservation status filter, table logic dedupe).
- ~04:10 — Order discount / table transfer / item edit UI. Docs synced with implementation (business rules, ERD, ADR 0011–0013).
- ~04:50 — Playwright UI smoke vs real API: 26/26 (all roles, realtime KDS, payment, stock); 6 UI/backend bugs fixed. Production hardening merged (housekeeping job, forwarded headers/HSTS/security headers, fail-fast config, hub error logging).
- ~05:10 — Refresh-token grace window (multi-tab), frontend refresh retry without logout, localized units/entity types, uz apostrophes. Docker image verified in Production mode (after repairing a Docker layer corrupted by the full C: drive).
- Totals at this point: backend 150 unit + 114 integration; admin 180; landing 27; all builds/lints green; 1028 files ≤ 500 lines.
- ~05:45 — Final regression on a fresh DB: E2E 18/18, UI smoke 26/26, backend 150+114, admin 180, landing 27, file-length OK. MVP code complete. See `HANDOFF.md`, `User-Todo.md`.

## v2 expansion — integrated and verified (2026-11-10, ~22:30)

Merged on `main`: F1 guests/loyalty, F2 split bill/tips/Payme+Click adapters, F3 delivery/QR menu/waiter calls,
F4 branch menu overrides/stock transfers/purchase suggestions, F5 analytics/XLSX/print-PDF, F6 time clock/schedule/PIN login,
F7 Telegram/SMS/SMTP/online booking, F8 PWA/dark theme/80 mm printing/shortcuts.

- **Migration `V2Features`** (one combined, additive): 24 new tables + 9 columns; new non-null columns default to 0/false.
  Applied on an empty DB and on top of a v1 DB with real v1 data (v1 E2E passed on the upgraded DB). No model drift.
- **Final results on a freshly reset DB** (details: `docs/testing/E2E_RESULTS.md`):
  backend build 0 warnings, **252 unit + 201 integration**; admin lint/typecheck/build ✔, **314 tests**; landing ✔, **35 tests**;
  1437 files ≤ 500 lines; **E2E 29/29** (18 v1 + 11 v2 steps, 150 REST calls, 0 over 2 s); **UI smoke 32/32** (59 screens crawled, 19 screenshots refreshed in `docs/design/assets/screenshots/`).
- **Bugs fixed during integration** (each with a test): loyalty points could be redeemed/returned on a split order (bills no longer
  matched the total); waiters/cashiers could rewrite the loyalty program; public QR menu and food-cost report ignored per-branch
  prices and stop-lists; delivery fee line missing in cashier summary/pre-check (rows did not add up); v2 permissions shown as raw
  codes in the role editor; workspace top bar and the QR-menu bottom bar overflowed a 390 px phone; guest card not reachable by
  keyboard; flaky admin route tests; stale role-permission test.
- **Merge follow-ups done**: public online booking by branch slug (`/public/branches/{slug}/…`, landing `VITE_PUBLIC_BRANCH_SLUG`,
  default `demo`); one phone normalization (was three); one QR generator (was two); sidebar item «Интеграции»; backend README error
  codes; contract CHANGELOG v2.0; DEPLOYMENT §11 (v2 settings); Development demo PINs (waiter 2580, cashier 3690, cook 1470).
- **Not connected / not verified with real services** (need the owner's credentials — `User-Todo.md` section E): Payme and Click
  (adapters + webhooks written and unit/integration-tested with fake keys only), Telegram, Eskiz SMS, SMTP. Uzum is a disabled
  skeleton. Fiscalization is not connected. UZ/EN texts of the new screens are machine-translated.
- **Known open issue** (v1 behaviour): a page reload during a SignalR hub call logs the cancelled invocation at `ERR` (harmless noise).
- **Not done**: load testing; a Release-build / staging run.

**Next steps for the owner:** review `User-Todo.md` section E (credentials, loyalty defaults, role rights) →
choose backend hosting (T3) and apply `V2Features` there.

## v2 published (2026-11-10, ~23:00)

- `main` pushed to GitHub (`origin/main` = v2, https://github.com/Urgenchbayev-Alibek/respos). Pre-push secret scan of the
  33 new commits: clean (only `.env.example` files tracked; the single hit was a dummy password in a masking unit test).
- Vercel production redeployed from the v2 code:
  - https://respos-admin.vercel.app (build env `VITE_APP_ENV=production`, `VITE_LANDING_URL=https://respos-landing.vercel.app`)
  - https://respos-landing.vercel.app (`VITE_ADMIN_APP_URL=https://respos-admin.vercel.app`, `VITE_PUBLIC_BRANCH_SLUG=demo`)
  - Checked after deploy: `/`, `/admin/customers`, `/manifest.webmanifest`, landing `/`, `/booking`, `/menu/demo` → 200.
  - Still true: login, QR menu data and online booking do NOT work on Vercel until the backend is hosted (T3) and
    `VITE_API_BASE_URL` / `VITE_HUB_URL` are set there.
- Local stack started for the owner (Development seed, DB contains demo data + E2E leftovers): API http://localhost:5080,
  admin http://localhost:5173, landing http://localhost:5174. Verified: `/health/ready` 200, login as `admin@demo.respos.uz` 200.
  Demo logins and PINs: root `README.md` (password `Demo123!`).

## Desktop app (Windows exe) — IN PROGRESS (started 2026-11-10, ~23:00)

Owner request: ship the web app as a Windows program. Decision: **Electron** (no Rust/MSVC toolchain on the machine for
Tauri; Electron gives silent thermal printing). Design brief: `respos-desktop/DESIGN.md` (on the branch).

- Work happens on branch **`v2/desktop`**, worktree `.claude/worktrees/desktop` (not yet merged into `main`).
- Architecture: Electron shell + loopback gateway (127.0.0.1) that serves the built `respos-admin` SPA and reverse-proxies
  `/api`, `/hubs` (WebSocket), `/files` to the server address entered on first run → cookies and SignalR work same-origin,
  backend unchanged. Extras: connection/settings window (RU/UZ/EN), silent 80 mm receipt printing, kiosk mode, autostart.
- Workflow `respos-desktop-electron` (run `wf_50ba0042-ee5`), 4 phases:
  1. **Build** — Electron shell + `respos-admin` desktop integration (relative API URLs, no service worker in desktop
     build, print bridge, file-URL helper) — *running when this note was written*.
  2. **Package** — Playwright-Electron e2e, NSIS installer + portable exe into `respos-desktop/release/`.
  3. **Review** — security / gateway correctness / packaging lenses, each finding adversarially verified.
  4. **Fix** — fix confirmed findings, rebuild, commit.
- **Planned next (owner asked for wide E2E with many agents):** a second workflow on the built exe — parallel agents,
  each with its own backend + DB: first-run & settings; admin (menu photo upload, reports, XLSX export); waiter + kitchen
  realtime across two app instances; cashier (shift, payment, split bill, tips, loyalty, receipt print); stock / delivery /
  QR codes; resilience (server down/up, busy port, second instance, session persistence); installer (silent install →
  launch → uninstall) and portable exe; language / dark theme / kiosk / shortcuts. Findings are verified, fixed and re-run.
- After that: merge `v2/desktop` into `main`, add `respos-desktop` to `CLAUDE.md` layout and root `README.md`, push,
  note in `User-Todo.md` that the exe is unsigned (code-signing certificate needed to avoid the SmartScreen warning).

## Night run plan — deadline 07:00, 2026-11-11 (owner: "finish everything, decide yourself")

Running in parallel (each in its own worktree, nothing touches `main` until merge):

| Track | Branch / worktree | Workflow run | State at 00:20 |
|---|---|---|---|
| Desktop exe (Electron) | `v2/desktop` / `.claude/worktrees/desktop` | `wf_50ba0042-ee5` | Package stage: installer (114 MB) + portable (104 MB) built, e2e in progress; then Review → Fix |
| UI redesign with the design skills | `v2/design` / `.claude/worktrees/design` | `wf_c802a677-296` | Started: Baseline capture + 6 surface audits → Spec → Implement (5 partitions) → Review (4 lenses) → Finalize |

Design skills: https://github.com/emilkowalski/skills installed globally in `~/.claude/skills/` (18 skills, content
reviewed — Markdown only, no scripts). `emil-design-eng` + `apple-design` are mandatory for all UI work (rule also in
the owner's global `CLAUDE.md`); project accessibility rules take precedence over motion advice.

Order of the remaining steps:
1. Desktop workflow done → start the **wide exe E2E matrix** (8 scenarios, parallel agents, own backend + DB each) on `v2/desktop`.
2. Redesign workflow done → merge `v2/design` and `v2/desktop` into `main`; polish the desktop connection window with the
   same design rules; rebuild the exe with the redesigned UI.
3. Final full run on the merged code: backend, admin, landing suites; API E2E; UI smoke; all exe scenarios.
4. Regroup commits **by topic** (owner request), push, redeploy Vercel, restart the local stack.
5. Publish the before/after design gallery for the owner; update `README.md`, `CLAUDE.md` layout, `User-Todo.md`
   (unsigned exe → code-signing certificate; backend hosting still needed).
