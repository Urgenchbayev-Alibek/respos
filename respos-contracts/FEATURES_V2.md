# RestaurantOS v2 — feature expansion (contract)

Owner approved expanding the MVP (2026-11-10). Each feature module (F1–F8) is built full-stack
(backend + admin UI + tests) by one agent in its own git worktree, then merged by the orchestrator.
All v1 rules still apply (`CLAUDE.md`, CONVENTIONS, DECISIONS_v1_1). Every module documents its final
endpoints + DTOs in its own file `respos-contracts/v2/F<n>-<name>.md` (no edits to shared contract files).

New permissions are ALREADY in the catalogs (backend `Permissions.cs`/`PermissionCatalog.cs`/`SystemRoles.cs`,
frontend `shared/constants/permissions.ts`): `orders.split`, `inventory.transfer`, `reports.export`,
`customers.read`, `customers.manage`, `loyalty.redeem`, `delivery.read`, `delivery.manage`,
`staff.timeclock`, `staff.manage`, `integrations.manage`. Do not add more without telling the orchestrator.

Real external integrations (Payme, Click, Uzum, Telegram, Eskiz SMS, SMTP) are implemented as provider
adapters that are **disabled unless configured** (credentials via env/config only — never in repo, never in
`VITE_*`). UI shows status «Не подключено» / «Тестовый режим» / «Подключено» honestly. No fake success.

## F1 — Guests (CRM) & loyalty
- `Customer` (org-scoped): phone (unique per org, normalized +998…), name, birthday, gender?, notes, tags,
  marketing consent, createdAt; stats (visits, total spent, average check, last visit) computed from paid orders.
- Attach a customer to an order (waiter/cashier: search by phone or create inline). Order DTO gets `customer`.
- Loyalty program settings (org): enabled, earn % of paid total, max % of bill payable by points, min order,
  points expiry days. `LoyaltyAccount` + `LoyaltyTransaction` ledger (earn on `OrderPaidDomainEvent`,
  idempotent per order; redeem as an order discount with `loyalty.redeem`; reverse on refund proportionally).
- Admin pages: Guests list/filters/segments (new, regular, sleeping >30 days, birthday this week), guest card
  (orders history, points ledger), loyalty settings. Birthday + VIP badges in waiter/cashier screens.

## F2 — Split bill, tips & payment providers
- Split an order into sub-checks (`OrderBill`): by items (move items/quantities), equally into N parts, or by
  custom amounts; pay each bill separately (payments reference `billId`); order is `paid` when all bills paid.
- Tips: optional `tipAmount` on a payment (not revenue; recorded per waiter; shown in shift close and reports).
- Payment providers via `IPaymentProvider`: `manual` (existing), `payme`, `click`, `uzum` adapters following
  their public merchant APIs (create invoice / check status / callbacks endpoint with signature verification),
  enabled per branch in settings only when credentials configured; otherwise «Не подключено». QR / payment link
  shown on cashier screen when a provider is enabled. Webhook endpoints idempotent and audited.
- Fiscal receipt adapter interface `IFiscalProvider` with `none` implementation (status «Не подключено»).

## F3 — Delivery, takeaway & QR menu
- Order type `delivery`: customer phone/name, address, comment, delivery fee (branch setting), courier
  (`Courier` entity or staff user), statuses: `new → accepted → cooking → ready → on_the_way → delivered | cancelled`
  (kitchen flow reused; delivery status separate from order status). Delivery board (kanban) page + realtime.
- Public QR menu: `GET /public/menu/{branchSlug}` (no auth, cached, only available items, photos, prices,
  categories, RU/UZ); public page in `respos-landing` at `/menu/:branchSlug` (mobile-first). Branch gets `slug`.
- Table QR codes: admin generates printable sheet (PNG/SVG via a JS QR lib) linking to `/menu/{slug}?table=N`.
- "Call waiter" from QR menu: `POST /public/menu/{branchSlug}/call-waiter` `{ tableNumber, reason }` (rate-limited)
  → realtime `WaiterCalled` + notification to waiters of that branch.

## F4 — Multi-branch menu & inventory transfers, purchase suggestions
- Per-branch menu overrides `BranchMenuItem` (price override, available/stop-list, station override) —
  `/menu/pos` and order pricing use the override for the current branch. Resolves limitation L3.
- Stock transfers between branches: document `StockTransfer` (draft → sent → received | cancelled), lines;
  `transfer_out` on send at source, `transfer_in` on receive at destination (atomic, idempotent receive).
- Purchase suggestions: for ingredients below min (or projected from last N days consumption), propose
  quantities grouped by default supplier → one click creates draft purchase orders. Ingredient gets
  `DefaultSupplierId`.

## F5 — Analytics & exports
- Reports: ABC analysis of menu items (revenue/quantity/margin), food cost per dish (active recipe cost vs price,
  margin %), waiter performance (orders, revenue, avg check, tips, cancellations), sales heatmap (weekday × hour,
  branch timezone), discounts & cancellations report, comparison with previous period (Δ%).
- Exports with `reports.export`: CSV (existing), **XLSX** (ClosedXML, MIT) and **PDF** (shift Z-report and sales
  summary; use a permissively licensed lib — e.g. QuestPDF Community only if its license fits, else HTML→print).
- Owner dashboard v2: period selector, sparkline KPIs, comparison, top/bottom dishes, food cost alert.

## F6 — Staff: time clock, schedule, PIN login
- Time clock: clock in/out (`staff.timeclock`, own record), breaks optional; `staff.manage` sees/edits all,
  timesheet report (hours per employee per period, CSV export).
- Schedule: weekly shifts per employee/branch (planned vs actual).
- PIN quick login on shared devices: user sets 4–6 digit PIN (hashed; rate-limited; lockout), `POST /auth/pin-login`
  `{ branchId, pin }` only for devices already authenticated as "device mode" OR scoped token — design securely
  and document (ADR-0014). Quick user switch UI for waiter/cashier/kitchen workspaces.

## F7 — Integrations & notifications
- Integration settings page (`integrations.manage`): Telegram bot (token + chat ids) for owner alerts (daily
  summary at configurable time, low stock, big refund, new online reservation, shift closed with difference);
  SMS (Eskiz.uz adapter) for reservation confirmations; SMTP email (MailKit) for invitations/password reset
  (replaces log-only sender when configured). Secrets stored encrypted at rest (ASP.NET Data Protection) and
  never returned to clients (masked). "Send test" buttons. Background dispatcher with retry + integration
  error log (shown in Platform → integration errors).
- Online reservations from landing: `POST /public/reservations/{branchSlug}` (rate-limited, honeypot) →
  pending reservation + notification; `GET /reservations/availability` implemented.

## F8 — UX platform: PWA, themes, printing, English
- PWA for `respos-admin` (manifest, icons, service worker caching static assets only — no API caching,
  offline banner), installable on tablets; KDS full-screen toggle.
- Dark theme for admin (tokens already exist for KDS) with toggle (per device).
- Printing: 80 mm thermal CSS layouts for kitchen ticket, pre-check, shift Z-report (browser print).
- Complete English locale (en currently mirrors ru keys) and proofread-ready uz.
- Keyboard shortcuts in cashier/waiter (documented `?` overlay). Accessibility pass on new screens.
