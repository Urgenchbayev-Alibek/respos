# F3 — Delivery, takeaway & QR menu (implemented contract)

All rules of CONVENTIONS.md apply (camelCase JSON, snake_case enums, money = number with ≤ 2 decimals, ProblemDetails `code`).
`B` = requires `X-Branch-Id`. Permissions: `delivery.read`, `delivery.manage` (already in the catalog); waiter calls reuse
`orders.read` / `orders.update`; branch slug/fee reuse `settings.manage`.

## Data model

| Entity / column | Table | Notes |
|---|---|---|
| `OrderType.delivery` | `orders.type` | new enum value (`dine_in`, `takeaway`, `delivery`) |
| `Order.DeliveryFee` | `orders.delivery_fee numeric(18,2)` default 0 | snapshot of the branch fee at creation |
| `RestaurantBranch.Slug` | `branches.slug varchar(64)` nullable, **unique** (global) | generated on branch creation `{translit-name}-{6 hex of id}`; existing rows backfilled at startup by `BranchSlugSeeder` (demo org branch → `demo`) |
| `BranchSettings.DeliveryFee` | `branch_settings.delivery_fee numeric(18,2)` default 0 | |
| `Courier` | `couriers` | branch-scoped: `name`, `phone` (E.164), `isActive` |
| `OrderDelivery` | `order_deliveries` | 1:1 with order (unique `order_id`, cascade), branch-scoped; customer name/phone, address, entrance/floor/apartment, comment, `courierId?` (FK restrict), `status`, `statusChangedAt`, `acceptedAt/cookingAt/readyAt/onTheWayAt/deliveredAt/cancelledAt`, `cancelReason`, `xmin` concurrency |
| `WaiterCall` | `waiter_calls` | branch-scoped: `tableId` (FK cascade), `tableNumber` snapshot, `reason call|bill`, `status active|acknowledged`, `createdAt`, `acknowledgedAt/By` |
| `NotificationType.waiter_called` | `notifications.type` | new enum value |

## Money

`total = subtotal − discount + serviceCharge + tax + deliveryFee`. The fee is added **after** tax: it is not discounted and
gets no service charge/tax. Dine-in/takeaway keep the v1 formula (fee = 0). `OrderDto.deliveryFee` and `ReceiptDto.deliveryFee`
were added (0 for other types). `POST /orders` with `type: "delivery"` → 400 (use `/delivery/orders`).

## Delivery status (separate from the order status)

`new → accepted → cooking → ready → on_the_way → delivered`; `accepted → ready` allowed; any non-terminal → `cancelled`.
`delivered` / `cancelled` are terminal. Invalid transition → **409 `delivery.invalid_status_transition`**.
Side effects (kitchen flow reused):
- `accepted` sends all `new` items to the kitchen (one ticket per station, like `send-to-kitchen`; no active station → 422 `kitchen_station.not_configured`).
- **Auto ready:** when the KDS marks the last item ready (order status `ready`/`served`), an `accepted`/`cooking` delivery becomes `ready` in the same transaction (`DeliveryReadyOnKitchenReadyHandler`). `cooking` is set manually (no KDS "start" event exists).
- `on_the_way` requires a courier (422 `delivery.courier_required`); ready items are marked served and their tickets closed.
- `cancelled` requires `reason` (400 `delivery.cancel_reason_required`), cancels the order (422 `order.has_payments` if paid) and its open tickets.
- Payment uses the normal `POST /payments`; the order becomes `paid` independently of the delivery status.
- Adding items after creation uses `POST /orders/{id}/items` (`orders.update`).

## Endpoints

| Method + path | Perm | Body / query → response |
|---|---|---|
| `GET /delivery/orders` B | delivery.read | `?status=new,on_the_way` (comma list). Default: open + closed in the last 12 h, oldest first, max 300 → `DeliveryOrderDto[]` |
| `GET /delivery/orders/{orderId}` B | delivery.read | → `DeliveryOrderDto` (404 `delivery.not_found`) |
| `POST /delivery/orders` B | delivery.manage | `{ customerName, customerPhone, address, entrance?, floor?, apartment?, comment?, courierId?, items: AddItem[] (≥1) }` → 201 `DeliveryOrderDto` (order `draft`, delivery `new`) |
| `PUT /delivery/orders/{orderId}` B | delivery.manage | customer/address fields → `DeliveryOrderDto` (409 `delivery.closed` when terminal) |
| `POST /delivery/orders/{orderId}/status` B | delivery.manage | `{ status, reason? }` → `DeliveryOrderDto` |
| `POST /delivery/orders/{orderId}/courier` B | delivery.manage | `{ courierId: guid \| null }` → `DeliveryOrderDto` (404 `courier.not_found`, 422 `courier.inactive`, 409 `delivery.closed`) |
| `GET /delivery/couriers` B | delivery.read | `?includeInactive=false` → `CourierDto[]` |
| `POST /delivery/couriers` / `PUT /delivery/couriers/{id}` B | delivery.manage | `{ name, phone, isActive }` → 201 / 200 `CourierDto` |
| `GET /branches/{id}/delivery-settings` | settings.manage | → `{ branchId, slug, deliveryFee }` |
| `PUT /branches/{id}/delivery-settings` | settings.manage | `{ slug, deliveryFee }` → same DTO. Slug: 3–64 `[a-z0-9]+(-[a-z0-9]+)*` (lower-cased), globally unique → 409 `branch.slug_taken` |
| `GET /branches` | branches.read | `BranchDto` now includes `slug` |
| `GET /public/menu/{branchSlug}` | anonymous | → `PublicMenuDto`; headers `ETag`, `Cache-Control: public, max-age=60`; `If-None-Match` → 304. In-memory cache 60 s per slug. Unknown/inactive branch or suspended org → 404 `public_menu.not_found` |
| `POST /public/menu/{branchSlug}/call-waiter` | anonymous | `{ tableNumber: string, reason: "call" \| "bill" }` → 202 `{ id, tableNumber, reason, status, createdAt }`. Table must exist (404 `table.not_found`). An active call for the same table+reason is returned instead of a duplicate. Rate limit (429 `rate_limit.exceeded`): `PublicMenu:CallWaiterPerTablePerMinute` (3/min per IP+slug+table) and `PublicMenu:CallWaiterPerIpPerHour` (60/h per IP) |
| `GET /waiter-calls` B | orders.read | → active calls of the last 12 h `WaiterCallDto[]` |
| `POST /waiter-calls/{id}/acknowledge` B | orders.update | idempotent → `WaiterCallDto` (404 `waiter_call.not_found`) |

Phones (`customerPhone`, courier `phone`) are normalized to E.164: 9 local digits → `+998…`, `998…` (12 digits) → `+998…`,
other `+<8–15 digits>` kept; anything else → 400 `validation.failed`.

```ts
DeliveryOrderDto = {
  orderId, orderNumber, displayNumber ("#0042"), orderStatus, status, allowedTransitions: DeliveryStatus[],
  customerName, customerPhone, address, entrance, floor, apartment, comment,
  courier: CourierDto | null, items: { id, name, variantName, quantity, status, lineTotal }[],
  subtotal, discountAmount, deliveryFee, total, paidAmount, remainingAmount,
  createdAt, statusChangedAt, acceptedAt, cookingAt, readyAt, onTheWayAt, deliveredAt, cancelledAt, cancelReason
}
CourierDto = { id, name, phone, isActive }
PublicMenuDto = {
  organizationName, currency, isDemo, branch: { slug, name, address, phone },
  categories: { id, name, nameUz, items: { id, name, nameUz, description, photoUrl, price, variants: { id, name, price }[] }[] }[]
}  // only active, non-archived categories with ≥1 available, non-archived item of THAT branch's organization;
   // prices, variant prices and availability are the BRANCH-effective values (F4 overrides via `BranchMenuResolver`, same as `/menu/pos`)
WaiterCallDto = { id, tableId, tableNumber, reason, status, createdAt, acknowledgedAt, acknowledgedBy, acknowledgedByName }
```

## Realtime (branch group `branch:{branchId}`)

| Event | Payload |
|---|---|
| `DeliveryUpdated` | `{ orderId, status, courierId, branchId, occurredAt }` (create, status, courier, details, auto-ready) |
| `WaiterCalled` | `{ callId, tableId, tableNumber, reason, branchId, occurredAt }` + `NotificationCreated` (type `waiter_called`, link `/waiter`) to active members with `orders.update` + `notifications.read` who can access the branch |
| `WaiterCallUpdated` | `{ callId, tableId, status, branchId, occurredAt }` |

## Error codes (new)

`delivery.not_found`, `delivery.closed`, `delivery.courier_required`, `delivery.cancel_reason_required`, `delivery.items_required`,
`delivery.invalid_status_transition`, `courier.not_found`, `courier.inactive`, `branch.slug_taken`, `public_menu.not_found`,
`waiter_call.not_found`, `order.invalid_delivery_fee`.

## Frontend

- Admin `/admin/delivery` and cashier `/cashier/delivery`: kanban board (columns new/accepted/cooking/ready/on_the_way/done,
  minutes-in-status timer — red after 30 min, `tel:` links, courier select, next-status buttons, cancel with reason),
  "New delivery" modal (POS menu picker reused from the waiter workspace), couriers modal.
- Branch settings page: "QR menu & delivery" card (slug + fee + link to the public menu).
- `/admin/tables/qr` (button on the Tables page, `tables.manage`): pick tables → A4 print sheet, QR via `qrcode@1.5.4` linking to
  `${VITE_LANDING_URL}/menu/{slug}?table={number}` (`VITE_LANDING_URL`, default `http://localhost:5174`).
- Waiter: `/waiter/calls` list + acknowledge; sticky toast on `WaiterCalled` anywhere in the waiter workspace.
- Landing `/menu/:branchSlug` (outside the marketing layout): mobile-first, categories, search, photos, UZS prices, RU/UZ,
  "Позвать официанта" / "Попросить счёт" when `?table=N`, friendly 404. The landing origin must be in `Frontend__AllowedOrigins`.
