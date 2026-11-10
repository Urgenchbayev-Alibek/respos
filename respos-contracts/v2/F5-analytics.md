# F5 — Analytics & exports (final contract)

All endpoints: branch-scoped (`X-Branch-Id`), `reports.read`, calculated in SQL, branch timezone. Period params
`from`/`to` = `YYYY-MM-DD` (branch-local, inclusive, default today, ≤ 366 days → 400 `report.invalid_period`).
Revenue rule (unchanged from v1): only `paid` orders by `businessDate`; revenue = Σ order.total − refunds of those orders.
Item stats use non-cancelled lines (line totals, before the order-level discount). No schema changes.

## Endpoints

| Endpoint | Response |
|---|---|
| `GET /reports/sales-summary?from&to` | `SalesSummaryDto` |
| `GET /reports/abc?from&to&metric=revenue\|quantity\|margin` (default revenue) | `AbcReportDto` |
| `GET /reports/food-cost?threshold=35` (1–100, default 35; current menu, no period) | `FoodCostReportDto` |
| `GET /reports/waiters?from&to` | `WaiterPerformanceDto[]` (by revenue desc) |
| `GET /reports/heatmap?from&to` | `HeatmapReportDto` |
| `GET /reports/discounts-cancellations?from&to` | `DiscountsCancellationsDto` |
| `GET /reports/z-report?shiftId=` | `ZReportDto` (404 `cash_shift.not_found` for another branch / unknown) |
| `GET /dashboard/overview?period=today\|7d\|30d` (default today; other → 400 `report.invalid_period`) | `DashboardOverviewDto` |
| `GET /reports/{name}/export?format=csv\|xlsx\|pdf&…` **[reports.export]** | file |

## DTOs

- `SalesTotalsDto { revenue, grossRevenue, refunds, ordersCount, averageCheck, itemsSold, discountsAmount, guestsCount }`
- `SalesDeltasDto { revenue, ordersCount, averageCheck, itemsSold, discountsAmount, guestsCount }` — Δ % =
  (current − previous) / |previous| × 100, 1 decimal, **`null` when previous = 0**.
- `SalesSummaryDto { from, to, previousFrom, previousTo, current, previous, deltas, byDay: {date, revenue, orders}[], previousByDay }`
  — previous period = same length, ending the day before `from`.
- `AbcReportDto { metric, total, items: { menuItemId, name, quantity, revenue, cost, margin, value, sharePercent, cumulativePercent, class: "A"|"B"|"C" }[] }`
  — sorted by `value` desc. Class by cumulative share **before** the item: < 80 % → A, < 95 % → B, else C (top item is always A).
  Items with value ≤ 0 (negative margin) → C, share 0. `cost` = sold qty × current active recipe cost (variant recipe, else item recipe);
  `margin` = revenue − cost (current costs, not historical).
- `FoodCostReportDto { thresholdPercent, aboveThresholdCount, items: FoodCostItemDto[] }`;
  `FoodCostItemDto { menuItemId, variantId|null, name, variantName|null, categoryName, price, hasRecipe, hasMissingConversions,
  recipeCost, foodCostPercent|null, marginAmount, marginPercent|null, isAboveThreshold }` — one row per non-archived item, or per
  non-archived variant (variant price). Prices are those of the current branch (F4 price overrides applied). recipeCost = Σ line qty × factor(line unit → ingredient base unit) × ingredient.costPrice,
  rounded to 2; lines without a conversion count 0 and set `hasMissingConversions`. foodCost % = cost / price × 100.
  Sorted: with recipe first, food cost % desc. (Threshold is a query param; a persisted per-org setting can be added later.)
- `WaiterPerformanceDto { waiterId, name, ordersCount, revenue, averageCheck, itemsSold, cancelledOrders, cancelledItems, discountsAmount, tipsAmount }`
  — waiter = order owner; cancelledItems = cancelled lines in orders not cancelled as a whole. **`tipsAmount` is always 0**
  until payments carry tips (F2 `Payment.TipAmount`): then sum it per order waiter in `WaiterPerformanceHandler` (and
  `ZReportHandler.tipsAmount`); the field already exists in JSON, CSV/XLSX and UI.
- `HeatmapReportDto { maxRevenue, maxOrders, cells: { weekday (ISO 1=Mon…7=Sun), hour (0–23), orders, revenue }[168] }` —
  paid orders bucketed by the local hour they were **opened** (SQL groups by UTC hour, buckets converted to branch time; DST-safe,
  15-min slots for non-whole-hour zones).
- `DiscountsCancellationsDto { discounts: { ordersCount, amount, byWaiter: StaffAmountDto[], orders: { orderId, number, businessDate,
  waiterName, discountType, discountValue, subtotal, discountAmount, total }[≤100, largest first] },
  cancellations: { ordersCount, ordersAmount, itemsCount, itemsAmount, byReason: { reason, ordersCount, itemsCount, amount }[],
  byWaiter: StaffAmountDto[] } }`; `StaffAmountDto { waiterId, name, count, amount }` (cancellations count = orders + lines).
  Discounts: paid orders; cancellations: business date in period; cancelled order amount = Σ its line totals.
- `ZReportDto { shiftId, branchName, timezone, status, openedAt, openedByName, closedAt, closedByName, openingAmount,
  methods: { method, paymentsCount, payments, refundsCount, refunds, net }[], totalPayments, totalRefunds, netAmount,
  ordersCount, tipsAmount (0, see above), expectedCashAmount, actualCashAmount, difference }`
- `DashboardOverviewDto { period, from, to, previousFrom, previousTo, current, previous, deltas,
  sparkline: { date, hour|null, revenue, orders }[] (24 hourly points for today, else daily), topItems, bottomItems:
  { menuItemId, name, quantity, revenue, margin }[≤5] (by revenue; bottom excludes top), foodCostAlerts: FoodCostReportDto
  (items above 35 %, ≤5), isDemoData }`. The live `GET /dashboard` is unchanged.

## Export

`GET /reports/{name}/export?format=csv|xlsx|pdf&from&to&limit&metric&threshold&shiftId&lang=ru|uz|en` — requires
**`reports.export`** (+ `reports.read`; 403 otherwise) and the `csv_export` plan feature (all formats).
Names: `sales, top-items, sales-by-category, payment-methods, stock, low-stock, stock-movements, cash-shifts,
sales-summary, abc, food-cost, waiters, heatmap, discounts-cancellations, z-report` (unknown → 404 `report.not_found`).

- `csv` → `text/csv; charset=utf-8` with BOM, first table only, stable camelCase headers (v1 files unchanged), ISO UTC instants.
- `xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`: title/period/summary on sheet 1, one sheet per table
  (e.g. heatmap: data + weekday×hour grid; discounts-cancellations: discounts, reasons, by waiter), numeric cells with formats,
  branch-local dates, localized headers (`lang`), id columns omitted, text never written as formulas.
- `pdf` → **print-ready HTML** (`text/html`, `.html`, CSP `default-src 'none'`), only `sales-summary` and `z-report`
  (others → 400 `report.unsupported_format`); the admin app prints it (browser "Save as PDF"). See ADR-0015.
- Bad `format` → 400 `report.unsupported_format`.

## Admin UI
Reports: new tabs ABC (metric switch, class-coloured bar chart + table), Food cost (threshold, alerts), Waiters, Heatmap
(table grid), Discounts & cancellations; Sales KPIs show Δ % vs previous period; export menu (CSV / Excel / PDF) shown only
with `reports.export`; Z-report action per shift. Dashboard v2: period selector, KPI cards with Δ % + sparkline, top/bottom 5,
food-cost alert widget. i18n namespace `analytics` (ru/uz/en).
