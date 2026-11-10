# F2 — Split bill, tips & payment providers (final contract)

Conventions as v1 (`CONVENTIONS.md`): camelCase JSON, snake_case enums, money = number ≤ 2 decimals (`numeric(18,2)`),
branch endpoints need `X-Branch-Id`. Base `/api/v1`.

## Split bill

| Method | Path | Permission | Body → Response |
|---|---|---|---|
| POST | `/orders/{id}/split` | `orders.split` | `SplitOrderCommand` → `200 OrderDto` |
| DELETE | `/orders/{id}/split` | `orders.split` | — → `200 OrderDto` (merge back) |

```ts
SplitOrderCommand =
  | { mode: "equal", parts: 2..20 }
  | { mode: "custom", amounts: number[] /* 2..20, each > 0, Σ == order.total */ }
  | { mode: "items", bills: { items: { orderItemId, quantity /* > 0, numeric(18,3) */ }[] }[] /* 1..20 */ }
OrderDto += { isSplit: boolean, bills: OrderBillDto[] }          // additive
OrderBillDto = { id, number, mode: "items"|"equal"|"custom", amount, paidAmount, remainingAmount,
                 status: "open"|"paid", items: { orderItemId, quantity, amount }[] }
```

Rules
- Only an open order with `paidAmount == 0`, `total > 0`, not yet split. 2–20 bills.
- `equal`: `round(total/N)` (AwayFromZero) for bills 1..N−1, **remainder on the last bill**. `custom`: Σ must equal total.
- `items`: quantities may be partial (e.g. 1 of 2 plov). Order items are **not** split into new rows (kitchen tickets keep
  their item references; snapshots unchanged) — allocations live in `order_bill_items`. Unallocated quantities form one extra
  last bill. Bill amount = order total × bill's share of line totals (discount/service/tax distributed proportionally), remainder last.
- While split: adding/editing/cancelling items and discounts → `409 order.split_active` (merge first).
- Payments on a split order must carry `billId`; amount ≤ bill remaining. Order becomes `paid` by the v1 rule
  (`paidAmount == total`) = when all bills are paid. Unsplit orders keep v1 behaviour (`billId` null).
- Refund of a bill payment re-opens the bill unless the order is already closed (paid stays paid, as v1).
- Merge: only when no payment row (even refunded) references a bill and no online payment is pending.

## Payments (changes) and tips

`POST /payments` body adds `billId?: Guid`, `tipAmount?: number (≥ 0, default 0)`. `PaymentDto` adds `billId`, `tipAmount`.

- Tip is **not** part of `amount`, order total, `paidAmount` or any revenue/sales/payment-method report. Credited to the order's waiter.
- Tips are not refundable (MVP); refunds apply to `amount` only.
- `CashShiftDto` adds `tipsAmount` (all methods) and `cashTipsAmount`. **Expected cash = opening + cash payments + cash tips − cash refunds**
  (cash tips are physically in the drawer). `totalsByMethod` excludes tips.
- `GET /reports/tips?from=YYYY-MM-DD&to=YYYY-MM-DD` [`reports.read`] → `{ from, to, totalTips, rows: { waiterId, waiterName, tipsAmount, paymentsCount }[] }`
  (payment time in branch timezone; default today).

## Online providers (Payme, Click, Uzum)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/payments/providers` | `payments.read` \| `payments.create` \| `settings.manage` | `PaymentProviderDto[]` |
| PUT | `/payments/providers/{code}` | `settings.manage` | `{ isEnabled }` → `PaymentProviderDto[]` (current branch) |
| GET | `/payments/fiscal` | `payments.read` \| `settings.manage` | `{ code: "none", status: "not_connected" }` |
| POST | `/payments/intents` | `payments.create` | `{ orderId, billId?, provider, tipAmount }` → `201 PaymentIntentDto` |
| GET | `/payments/intents?orderId=` | `payments.read` \| `payments.create` | newest first (≤ 50) |
| GET | `/payments/intents/{id}` | `payments.read` \| `payments.create` | cashier polls it |
| POST | `/payments/intents/{id}/cancel` | `payments.create` | cancels a pending intent |
| POST | `/payments/providers/{name}/callback` | **anonymous** | provider webhook (Payme JSON-RPC / Click form) |

```ts
PaymentProviderDto = { code: "payme"|"click"|"uzum", status: "not_connected"|"test"|"connected", isImplemented,
                       isConfigured, isEnabled /* branch switch */, isAvailable /* implemented+configured+enabled */, callbackPath }
PaymentIntentDto = { id, orderId, billId, provider, amount /* to order/bill */, tipAmount, totalAmount /* charged */,
                     status: "pending"|"completed"|"cancelled", isExpired, paymentUrl /* also QR payload */, expiresAt, paymentId, createdAt }
```

Flow: cashier creates an intent for the **whole remaining amount** of the order (or of the bill) → UI shows QR + link →
provider callback confirms → a `Payment` is created (`method: "other"`, `provider: payme|click`, `externalReference` = provider
transaction id, `Idempotency-Key` = `provider:transactionId`, shift = open shift of the branch, else the intent's shift) and
applied to the order/bill (may mark it paid → OrderPaid events). Realtime `PaymentRegistered` + `OrderUpdated` after commit.

- **Pending state**: an unconfirmed provider payment is a `PaymentIntent` with status `pending`; a `Payment` row is created only on
  confirmation, so shift totals and all reports never contain unconfirmed money (no status filter needed anywhere).
- While an intent is active (pending and not expired, or the provider has created its transaction), manual payments and new intents
  for the same order/bill → `409 payment.intent_pending`. Lifetime `PaymentProviders:IntentLifetimeMinutes` (15).
- Configuration (env only): `PaymentProviders__Payme__{MerchantId,Key,TestMode,AccountField=order_id,TransactionTimeoutMinutes=720}`,
  `PaymentProviders__Click__{ServiceId,MerchantId,SecretKey,TestMode}`. Without credentials → `not_connected`, cannot be enabled.
  One merchant account per deployment; each branch enables providers separately.
- Callbacks: no JWT. Unknown/unconfigured provider → `404 payment.provider_not_found`. After auth/sign verification the request
  enters the intent's tenant scope (server-side lookup only). Every state change audited (`payment.provider_transaction_created`,
  `payment.intent_completed`, `payment.provider_transaction_cancelled`, `payment.registered`). Rejected auth/sign → warning log.

### Payme Merchant API (JSON-RPC 2.0, HTTP 200 always)
Auth `Authorization: Basic base64("Paycom:" + Key)` (constant-time compare) else `-32504`. Account `account.order_id` = intent id;
amounts in tiyin (= totalAmount × 100). Checkout link `https://checkout[.test].paycom.uz/base64("m=…;ac.order_id=…;a=…")`.
- `CheckPerformTransaction` → `{allow:true}` | `-31001` wrong amount | `-31050` intent/order not payable | `-31051` intent already bound.
- `CreateTransaction` → `{create_time, transaction, state:1}`; repeat with the same id returns the same result; other id while bound → `-31051`;
  timeout (12 h) → cancelled (reason 4) + `-31008`.
- `PerformTransaction` → `{transaction, perform_time, state:2}`; idempotent; order can no longer take it → cancelled (reason 3) + `-31008`.
- `CancelTransaction` → state 1 → `{transaction, cancel_time, state:-1}`; performed → `-31007` (service delivered; refunds via cashier).
- `CheckTransaction` → `{create_time, perform_time, cancel_time, transaction, state, reason}`; `GetStatement {from,to}` → `{transactions:[…]}`.
- Unknown transaction `-31003`, unknown method `-32601`, bad JSON `-32700`, bad request `-32600`. `ChangePassword` not supported (`-32601`).

### Click SHOP API (form POST, one URL for Prepare `action=0` and Complete `action=1`)
`sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id [+ merchant_prepare_id] + amount + action + sign_time)`;
`merchant_trans_id` = intent id; link `https://my.click.uz/services/pay?service_id=…&merchant_id=…&amount=…&transaction_param=<intentId>`.
Response `{click_trans_id, merchant_trans_id, merchant_prepare_id | merchant_confirm_id, error, error_note}`.
Errors: `-1` sign, `-2` amount, `-3` action, `-4` already paid, `-5` intent not found, `-6` transaction/prepare mismatch, `-8` bad request
(service id), `-9` cancelled (also when Click sends `error < 0` on Complete, or the order can no longer take the amount). Repeated
Prepare/Complete with the same `click_trans_id` return the same ids (idempotent; one Payment).

### Uzum
**Adapter skeleton, disabled.** Uzum's merchant API could not be verified against official documentation for this release:
`status` is always `not_connected`, `isImplemented: false`, enabling → `422 payment.provider_not_configured`, callback → 404.

### Fiscal
`IFiscalProvider` with `NoFiscalProvider` (`code: "none"`, `not_connected`). Pre-checks remain non-fiscal.

## Error codes (new)
`order.bill_not_found` 404, `order.already_split` 409, `order.not_split` 409, `order.split_active` 409, `order.bill_paid` 409,
`order.invalid_split` 422, `order.split_mismatch` 422, `payment.bill_required` 422, `payment.intent_not_found` 404,
`payment.intent_not_pending` 409, `payment.intent_pending` 409, `payment.intent_transaction_mismatch` 409,
`payment.provider_not_found` 404, `payment.provider_not_configured` 422, `payment.provider_not_enabled` 422, `payment.nothing_due` 422.

## Schema changes (combined migration is generated by the orchestrator)
- `orders.is_split bool` · `payments.bill_id uuid null` (FK `order_bills`, restrict) · `payments.tip_amount numeric(18,2) default 0`
- `order_bills` (id, order_id FK cascade, number UK(order_id, number), mode, amount, paid_amount, status)
- `order_bill_items` (id, bill_id FK cascade, order_item_id FK restrict, quantity numeric(18,3), amount)
- `payment_intents` (tenant+branch; order_id, bill_id FK set null, cash_shift_id, payment_id, provider, amount, tip_amount, status,
  expires_at, payment_url, provider_transaction_id UK(provider, provider_transaction_id) filtered, provider_time, provider_prepare_id,
  provider_state, provider_created_at, performed_at, cancelled_at, cancel_reason, xmin concurrency)
- `branch_payment_providers` (tenant+branch; provider, is_enabled; UK(branch_id, provider))

## UI
Cashier: split/merge buttons, bill picker (per-bill pay), tip field, online pay panel (QR via `qrcode`, link, polling, cancel;
«Не подключено» / disabled states), shift tips lines. Waiter: split/merge in order actions. Admin: Settings → payment providers + fiscal
status; Payments page → tips by waiter. i18n namespace `billing` (ru/uz/en).
