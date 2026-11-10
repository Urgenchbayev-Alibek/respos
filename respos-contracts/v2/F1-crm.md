# F1 — Guests (CRM) & loyalty

Base `/api/v1`. Notation as in ENDPOINTS.md (`[perm]`, `B` = requires `X-Branch-Id`, `P` = paged).
Money/points are JSON numbers. **1 point = 1 unit of the org currency.** Points are whole numbers.

## Guests (org-level; `X-Branch-Id` optional — only sets the timezone for birthday flags)

- `GET /customers` P [customers.read] — `search` (name contains, or phone digits ≥ 3, `+998` prefix optional),
  `segment` = `new` (created ≤ 30 days ago) | `regular` (≥ 3 paid visits) | `sleeping` (last paid visit > 30 days ago) |
  `birthday` (birthday in the next 7 days incl. today) | `vip` (tag `vip`), `tag`, sort `name|createdAt|visits|totalSpent|lastVisitAt|points`
  (default `createdAt:desc`) →
  `CustomerListItemDto { id, name, phone, birthday (YYYY-MM-DD|null), tags: string[], isVip, isBirthdayToday, isBirthdaySoon, visits, totalSpent, averageCheck, lastVisitAt|null, points, createdAt }`
- `GET /customers/{id}` [customers.read] → `CustomerDto { id, name, phone, birthday, gender: "male"|"female"|null, notes, tags, marketingConsent, isVip, isBirthdayToday, isBirthdaySoon, createdAt, stats: { visits, totalSpent, averageCheck, lastVisitAt }, loyalty: { points, lifetimeEarned, lifetimeRedeemed } }`
- `POST /customers` [customers.manage] → 201 `CustomerDto`; `PUT /customers/{id}` [customers.manage] → 200 `CustomerDto`.
  Body `{ phone, name, birthday?, gender?, notes?, tags?: string[], marketingConsent }`. Phone is normalized to
  `+998XXXXXXXXX` (accepts `+998 90 123 45 67`, `998901234567`, `90 123-45-67`); unique per organization.
  Tags are trimmed, lower-cased, distinct (≤ 20, ≤ 32 chars).
- `DELETE /customers/{id}` [customers.manage] → 204; only guests with no orders and no ledger entries.
- `GET /customers/{id}/orders` P [customers.read] → `CustomerOrderDto { id, number, branchId, branchName, businessDate, type, status, total, paidAmount, loyaltyDiscountAmount, openedAt, closedAt }` (all branches, newest first)
- `GET /customers/{id}/loyalty/transactions` P [customers.read] → `LoyaltyTransactionDto { id, type: earn|redeem|expire|reverse, reason: order_paid|order_redeemed|redemption_cancelled|order_cancelled|refund|reconcile|expiry, points (signed), balanceAfter, orderId, orderNumber, expiresAt, createdAt, createdByName }` (newest first)

Stats are computed in SQL from **paid** orders of the org linked to the guest: visits = count, totalSpent = Σ `paidAmount`
(net of refunds), averageCheck = totalSpent / visits, lastVisitAt = max `closedAt`.

## Loyalty settings (org)

- `GET /loyalty/settings` [customers.read | customers.manage | loyalty.redeem] → `LoyaltySettingsDto { isEnabled, earnPercent, maxRedeemPercent, minOrderAmount, pointsExpiryDays|null }`
  (defaults until saved: disabled, 5 %, 30 %, 0, null)
- `PUT /loyalty/settings` [customers.manage] same body → 200. Percents 0–100, minOrderAmount ≥ 0, expiry 1–3650 days or null (never). Audited `loyalty.settings_updated`.

Rules: earn = `floor(order.total × earnPercent / 100)` on full payment; redeem ≤ `floor((subtotal − manual discount) × maxRedeemPercent / 100)`,
≤ balance, ≤ remaining due; both require `subtotal ≥ minOrderAmount` and the program enabled.

## Order guest & points (B)

`OrderDto` gets two fields: `customer: { id, name, phone, isBirthdayToday, isVip, points } | null` and `loyaltyDiscountAmount`
(the points part of `discountAmount`; `discountAmount = manual discount + loyaltyDiscountAmount ≤ subtotal`, service/tax computed after it as before).

- `POST /orders/{id}/customer` [customers.read AND (orders.update | payments.create)] `{ customerId }` → `OrderDto`. Open orders only (409 `order.closed`).
- `DELETE /orders/{id}/customer` (same perms) → `OrderDto`.
- `GET /orders/{id}/loyalty` [customers.read | loyalty.redeem] → `OrderLoyaltyDto { isEnabled, customerId, points, maxRedeemable, redeemed, expectedEarn, minOrderAmount, maxRedeemPercent }`
- `POST /orders/{id}/loyalty/redeem` [loyalty.redeem] `{ points }` (positive integer) → `OrderDto`. One active redemption per order. Audited `loyalty.redeemed`.
- `DELETE /orders/{id}/loyalty/redeem` [loyalty.redeem] → `OrderDto`; points are returned. Audited `loyalty.redemption_cancelled`.

Realtime: every mutation above sends `OrderUpdated` after commit (no new events).

## Ledger behaviour

- `LoyaltyAccount` per guest (balance, lifetime earned/redeemed, `xmin` concurrency → 409 `concurrency.conflict`).
  `LoyaltyTransaction` is append-only; positive entries are lots with `remainingPoints` + `expiresAt`; redemptions/expiry consume lots FIFO by expiry.
- **Earn** in `IDomainEventHandler<OrderPaidDomainEvent>` (same transaction as the payment); idempotent per order
  (checked + unique index `(order_id, type) WHERE type='earn'`). Points redeemed but not applied (discount clamped after item cancellations) are returned first (`reason=reconcile`).
- **Refund** (`OrderRefundedDomainEvent`, raised by `Order.RegisterRefund`) on a paid order: with r = refunded / total, takes back `floor(earned × r)` and returns
  `floor(loyaltyDiscountAmount × r)` (cumulative targets → idempotent across partial refunds). Taking back never makes the balance negative.
- **Order cancelled** (`OrderCancelledDomainEvent`): all points still spent on it are returned.
- **Expiry** is lazy: written as `expire` entries on the next ledger write for that guest; reads already subtract lots past expiry from `points`.

## Error codes

`customer.not_found` (404), `customer.phone_taken` (409), `customer.invalid_phone`, `customer.name_required`, `customer.invalid_tags` (400),
`customer.has_history` (422), `loyalty.invalid_settings` (400), `loyalty.invalid_points` (400), `loyalty.disabled`, `loyalty.no_customer`,
`loyalty.insufficient_points`, `loyalty.exceeds_limit`, `loyalty.below_min_order` (422), `loyalty.already_redeemed`, `loyalty.redemption_active`,
`loyalty.nothing_redeemed` (409). Invalid phone in a request body → 400 `validation.failed` with `errors.phone`.

## Schema (one combined migration is generated by the orchestrator)

- `orders`: + `customer_id uuid null` (FK customers, restrict, indexed), + `loyalty_discount_amount numeric(18,2) not null default 0`.
- `customers` (org): phone varchar(32) unique per org, name, birthday date, birthday_key int (month*100+day, indexed), gender, notes, tags text[], marketing_consent, audit stamps.
- `loyalty_settings` (unique organization_id), `loyalty_accounts` (unique customer_id, cascade from customer, `xmin`),
  `loyalty_transactions` (account cascade, order FK restrict, filtered unique `(order_id, type) WHERE type='earn'`).

## Known limitations

- Cashier role has no `customers.manage` → can search/attach guests but not create them (quick create is shown only with `customers.manage`).
- Max-% rule is enforced at redeem time; cancelling items afterwards only clamps the points discount to the new subtotal.
- Earned points are not shown on the receipt/pre-check (receipt DTO unchanged; `discountAmount` includes the points part).
