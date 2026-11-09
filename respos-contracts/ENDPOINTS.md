# REST endpoints (`/api/v1`)

Notation: `[perm]` = required permission; `B` = requires `X-Branch-Id`; `P` = paged list; `IK` = requires Idempotency-Key.
DTO fields are listed loosely; names MUST match (camelCase). Status codes per CONVENTIONS.md.
Create returns `201` + DTO; update returns `200` + DTO; actions return `200` + DTO; archive/delete returns `204`.
v1.2: shapes below were aligned with the implemented backend (2026-11-10). List `from`/`to` on orders, payments, cash shifts, movements, purchases and audit logs are DateTime (send ISO UTC instants of branch-tz day bounds); report endpoints take `YYYY-MM-DD`.
Domain errors (409/422) carry only `code` (no `errors` map); only `validation.failed` has field `errors`.

## Public (no auth)
- `POST /public/demo-requests` `{ name, phone, email?, restaurantName, city?, message? }` → 202. Rate-limited 5/hour/IP. Honeypot field `website` must be empty.
- `GET /public/plans` → `[{ code, name, maxBranches, maxUsers, features: string[] }]` (informational).

## Auth — see CONVENTIONS.md

## Organization & branches
- `GET /organization` → `{ id, name, slug, currency, defaultLanguage, status, isDemo }` ; `PUT /organization` [settings.manage]
- `GET /branches` [branches.read] → `BranchDto[]` `{ id, name, address, phone, timezone, isActive }`
- `POST /branches` [branches.manage] (checks plan limit MaxBranches → 422 `plan.limit_exceeded`); `PUT /branches/{id}`; `POST /branches/{id}/deactivate`
- `GET /branches/{id}/settings` / `PUT /branches/{id}/settings` [settings.manage] `{ serviceChargePercent, taxPercent, allowNegativeStock, receiptFooter }` (GET also returns read-only `inventoryConsumptionTrigger: "on_payment"`)

## Users & roles
- `GET /users` P [users.read] filters `status, roleId, branchId, search` → `UserDto { id, email, fullName, phone, status, roles: {id,code,name}[], branches: {id,name}[], lastLoginAt }`
- `GET /users/{id}`; `POST /users/invitations` [users.create] `{ email, fullName, roleIds, branchIds }` → `{ invitationId, inviteLink }` (link shown to admin in MVP since email is stubbed; dev/demo only)
- `POST /users` [users.create] `{ email, fullName, phone?, password, roleIds, branchIds }` (direct creation with temp password)
- `PUT /users/{id}` [users.update] `{ fullName, phone, roleIds, branchIds }`
- `POST /users/{id}/block` / `unblock` / `deactivate` [users.deactivate] (cannot deactivate self or last owner)
- `GET /roles` [roles.read] → `{ id, code, name, isSystem, permissions: string[], userCount }[]`
- `POST /roles` / `PUT /roles/{id}` [roles.manage] `{ name, permissions: string[] }`; `DELETE /roles/{id}` (not system, no users)
- `GET /permissions` [roles.read] → `{ code, module, description }[]`

## Floor (B)
- `GET /dining-areas` [tables.read] → `{ id, name, sortOrder, isActive, tableCount }[]`; `POST/PUT /dining-areas[/{id}]`, `DELETE` (archive) [tables.manage]
- `GET /tables` [tables.read] filters `areaId, status` → `TableDto { id, number, capacity, areaId, areaName, status, isActive, posX, posY, activeOrderId, activeOrderTotal, nextReservation: {id, startsAt, guestName} | null }` (last three always present, nullable)
- `POST/PUT /tables[/{id}]`, `DELETE /tables/{id}` (archive) [tables.manage]
- `POST /tables/{id}/status` [tables.manage] `{ status: "available"|"unavailable" }` (occupied/reserved are set by orders/reservations)

## Reservations (B)
- `GET /reservations` P [reservations.read] filters `date (YYYY-MM-DD), from, to (ISO), status (single), tableId, search`, sort `startsAt|createdAt|guestName|status` → `ReservationDto { id, tableId, tableNumber, preferredAreaId, guestName, guestPhone, guestCount, startsAt, endsAt, status, comment, cancelReason, createdAt }`
- `POST /reservations` / `PUT /reservations/{id}` [reservations.manage] `{ tableId?, preferredAreaId?, guestName, guestPhone (required), guestCount, startsAt, endsAt, comment }`
- `POST /reservations/{id}/confirm|seat|complete|cancel|no-show` [reservations.manage] (`cancel` body `{ reason? }`) → `ReservationDto`. Transitions: pending → confirmed|cancelled|no_show; confirmed → seated|cancelled|no_show; seated → completed
- `GET /reservations/availability` and `GET /reservations/{id}` — NOT implemented (v1.2)

## Kitchen stations (B)
- `GET /kitchen-stations` [kitchen.read] → `{ id, name, sortOrder, isActive }[]`; `POST/PUT/DELETE` [kitchen.stations.manage]

## Menu (org-scoped)
- `GET /menu/categories?includeArchived` [menu.read] → `{ id, name, nameUz, sortOrder, isActive, isArchived, itemCount }[]`; `POST/PUT/DELETE(archive)` [menu.manage]; `PUT /menu/categories/reorder` `{ ids: [] }` → categories array
- `GET /menu/items` P [menu.read] filters `categoryId, search, isAvailable, includeArchived` → `MenuItemDto { id, categoryId, categoryName, name, nameUz, description, photoUrl, price, prepTimeMinutes, kitchenStationId, isAvailable, isArchived, sku, variants: {id,name,price,isDefault}[], modifierGroups: ModifierGroupDto[], availability: {dayOfWeek: "sunday".."saturday"|null, startTime: "HH:mm:ss", endTime}[] }`; `prepTimeMinutes` is a non-null int; sort `name|price|createdAt|prepTimeMinutes`
- `GET /menu/items/{id}`; `POST/PUT /menu/items` [menu.manage] body = editable fields + `variants?`, `modifierGroupIds?`, `availability?` (null/omitted list = keep unchanged), `isAvailable?`; `POST /menu/items/{id}/archive` (204); `POST /menu/items/{id}/availability` `{ isAvailable }`
- `POST /menu/items/{id}/photo` (multipart field `file`, ≤2MB, jpg/png/webp) → `{ photoUrl }` (local file storage provider in MVP)
- `GET /menu/modifier-groups`; `POST/PUT/DELETE` [menu.manage] `ModifierGroupDto { id, name, minSelect, maxSelect, isRequired, options: {id,name,priceDelta}[] }`
- `GET /menu/pos` [menu.read] (B) → `{ id, name, nameUz, sortOrder, items: MenuItemDto[] }[]` (plain array; only items orderable now; empty categories omitted)

## Orders (B)
- `GET /orders` P [orders.read] filters `status (multi, comma), tableId, waiterId, from, to (ISO instants on openedAt), type, search(number)`, sort `openedAt|number|total|status`; `GET /orders/active` → plain `OrderDto[]` (not paid/cancelled)
- `GET /orders/{id}` → `OrderDto { id, number, businessDate (YYYY-MM-DD), type, status, tableId, tableNumber, waiterId, waiterName, guestCount, items: OrderItemDto[], subtotal, discountType, discountValue, discountAmount, serviceChargeAmount, taxAmount, total, paidAmount, remainingAmount, comment, cancelReason, openedAt, closedAt, payments: PaymentDto[], history: {fromStatus,toStatus,changedByName,changedAt,reason}[] }`
- `OrderItemDto { id, menuItemId, variantId, name, variantName, unitPrice, quantity, modifiers: {name, priceDelta}[], comment, status, lineTotal, stationId, sentAt, readyAt, cancelReason }`. `POST /orders` → 201; every other order mutation → 200 `OrderDto`
- `POST /orders` [orders.create] `{ type, tableId?, guestCount, comment?, items?: AddItem[] }` → status `draft`; table → `occupied`
- `AddItem = { menuItemId, variantId?, quantity, modifierOptionIds: [], comment? }`
- `POST /orders/{id}/items` [orders.update] `{ items: AddItem[] }`; `PUT /orders/{id}/items/{itemId}` (only status `new`) `{ quantity, comment }`; `POST /orders/{id}/items/{itemId}/cancel` `{ reason }` (sent items need orders.cancel)
- `POST /orders/{id}/send-to-kitchen` [orders.update] IK `{ itemIds?: [] }` (null = all `new` items) → creates tickets, order `submitted`
- `POST /orders/{id}/items/{itemId}/serve` [orders.update]; `POST /orders/{id}/serve-all`
- `POST /orders/{id}/discount` [orders.discount.apply] `{ type: "amount"|"percent"|"none", value, reason }`
- `POST /orders/{id}/transfer` [orders.transfer] `{ tableId }`
- `POST /orders/{id}/cancel` [orders.cancel] `{ reason }` (required)
- `GET /orders/{id}/receipt` [orders.read or payments.read] → `ReceiptDto { orderId, number, displayNumber ("#0042"), type, status, tableNumber, waiterName, guestCount, organizationName, currency, branchName, branchAddress, branchPhone, items: OrderItemDto[] (non-cancelled), subtotal, discountType, discountValue, discountAmount, serviceChargePercent, serviceChargeAmount, taxPercent, taxAmount, total, paidAmount, remainingAmount, payments: {method, amount, refundedAmount}[], openedAt, closedAt, printedAt, footer, isFiscal (false), fiscalNotice }`

## Kitchen / KDS (B)
- `GET /kitchen/tickets` [kitchen.read] filters `stationId, status (comma list, default new,in_progress,ready)` → plain array (max 300) → `KitchenTicketDto { id, number, orderId, orderNumber, tableNumber, waiterName, stationId, stationName, status, createdAt, startedAt, readyAt, items: { id, orderItemId, name, variantName, quantity, modifiers: string[], comment, status }[] }` sorted by createdAt asc
- `POST /kitchen/tickets/{id}/start|ready|served` [kitchen.status.update] → `KitchenTicketDto` (also for ticket-item actions and recall)
- `POST /kitchen/ticket-items/{id}/start|ready` [kitchen.status.update]
- `POST /kitchen/tickets/{id}/recall` (ready → in_progress, mistakes)

## Payments & cash shifts (B)
- `GET /cash-shifts/current` [cash-shifts.read] → `CashShiftDto | 204`. `CashShiftDto { id, status: open|closed, openedBy, openedByName, openedAt, openingAmount, closedBy, closedByName, closedAt, expectedCashAmount, actualCashAmount, difference, comment, cashPaymentsAmount, cashRefundsAmount, totalsByMethod: {method, amount}[] }` (same DTO for list/detail/current)
- `POST /cash-shifts/open` [cash-shifts.open] `{ openingAmount }` → 201; `POST /cash-shifts/{id}/close` [cash-shifts.close] `{ actualCashAmount, comment? }` → expected = opening + cash payments − cash refunds
- `GET /cash-shifts` P [cash-shifts.read] filters `status, from, to` (ISO; `sort` ignored, newest first); `GET /cash-shifts/{id}` → `{ ..., totalsByMethod: {method, amount}[] }`
- `POST /payments` [payments.create] IK `{ orderId, method, amount, externalReference? }` → 201 `PaymentDto { id, orderId, cashShiftId, method, amount, refundedAmount, status, provider, externalReference, createdAt, createdBy, createdByName }` (no `orderNumber`). Overpay → `payment.exceeds_due`
- `GET /payments` P [payments.read] filters `from, to (ISO instants), method, orderId, shiftId` (`sort` ignored)
- `POST /payments/{id}/refunds` [payments.refund] IK `{ amount, reason }` → 201 `RefundDto { id, paymentId, orderId, cashShiftId, method, amount, reason, createdAt, createdByName, payment: PaymentDto }`

## Inventory (B unless noted)
- `GET /units` (org) [inventory.read]; `POST /units`, `POST /unit-conversions` [inventory.manage] → `{ id, fromUnitId, fromUnitCode, toUnitId, toUnitCode, factor }`
- `GET /ingredient-categories`; `POST/PUT/DELETE` [inventory.manage]
- `GET /ingredients` P [inventory.read] filters `categoryId, search, lowStock(bool)` → `IngredientDto { id, name, sku, categoryId, categoryName, baseUnitId, baseUnitCode, costPrice (non-null number), quantity, minQuantity, isLow, isArchived }` (quantity/minQuantity for current branch)
- `POST/PUT /ingredients`, `POST /ingredients/{id}/archive` [inventory.manage]; `PUT /ingredients/{id}/min-quantity` `{ minQuantity }`
- `POST /stock/movements` [inventory.adjust] `{ ingredientId, type: "write_off"|"adjustment"|"receipt", quantity, unitId?, unitCost?, reason }`
- `GET /stock/movements` P [inventory.read] filters `ingredientId, type, from, to (ISO instants, to inclusive), sourceType`; DTO includes `baseUnitCode, createdBy, createdByName`. Quantity sign: positive for receipt/write_off, signed for adjustment
- `GET /stock/counts` P → `{ id, status, comment, createdAt, completedAt, lineCount }`; `GET /stock/counts/{id}` → lines incl. `baseUnitCode, countedQty|null, difference`; `POST /stock/counts` `{ comment?, ingredientIds? }` (snapshot expected qty); `PUT /stock/counts/{id}` `{ lines: {ingredientId, countedQty|null}[] }`, `POST /stock/counts/{id}/complete` [inventory.adjust]

## Recipes (org)
- `GET /recipes?menuItemId=` [recipes.read] → `RecipeDto[]` `{ id, menuItemId, menuItemName, variantId, version, effectiveFrom, isActive, ingredients: { ingredientId, ingredientName, quantity, unitId, unitCode }[], estimatedCost }`
- `POST /recipes` [recipes.manage] (creates a new version effective now — no `effectiveFrom` in body — deactivates previous); `GET /recipes/{id}`; `GET /recipes/history?menuItemId=`

## Suppliers & purchases
- `GET /suppliers` P [suppliers.read]; `POST/PUT /suppliers`, `POST /suppliers/{id}/archive` [suppliers.manage]
- `GET /purchases` P (B) [purchases.read] filters `status, supplierId, from, to`; list ignores `sort` and returns `items: []`; `GET /purchases/{id}` → `{ id, number (int), createdAt, supplierId, supplierName, status, expectedAt, total, comment, items: { id, ingredientId, ingredientName, quantity, unitId, unitCode, unitPrice, receivedQuantity, lineTotal }[] }`
- `POST/PUT /purchases` [purchases.manage] (only draft editable); `POST /purchases/{id}/submit|cancel`
- `POST /purchases/{id}/receive` [purchases.receive] IK `{ lines: { itemId, quantity }[] }`

## Reports & dashboard (B, branch timezone, server-calculated)
- `GET /dashboard` [reports.read OR any workspace perm → role-tailored] → `{ salesToday, ordersToday, averageCheck, activeOrders, tablesOccupied, tablesTotal, topItems: {name, quantity, revenue}[], lowStockCount, currentShift: {id, openedAt, openedByName|null} | null, isDemoData }`
- Report `from`/`to` are `YYYY-MM-DD` (branch tz, default today, max 366 days → `report.invalid_period`).
- `GET /reports/sales?from=&to=` [reports.read] → `{ totalRevenue, ordersCount, averageCheck, byDay: {date, revenue, orders}[] }`
- `GET /reports/top-items?from=&to=&limit=` → `{ menuItemId, name, quantity, revenue }[]`
- `GET /reports/sales-by-category?from=&to=` → `{ categoryId, name, revenue, quantity }[]`
- `GET /reports/payment-methods?from=&to=` → `{ method, amount, refundedAmount, count }[]`
- `GET /reports/stock` → balances incl. `sku, costPrice, stockValue`; `GET /reports/low-stock`; `GET /reports/stock-movements?from=&to=` → `{ type, ingredientId, ingredientName, unitCode, quantity (signed), count }[]`
- `GET /reports/cash-shifts?from=&to=` → rows incl. `closedByName, cashPayments, cardPayments, otherPayments, refunds`
- `GET /reports/{name}/export?format=csv&...` → `text/csv` with UTF-8 BOM (CSV only in MVP; optional `limit` for top-items)

## Notifications & audit
- `GET /notifications` P [notifications.read] filters `unreadOnly` → `NotificationDto { id, type, title, body, link, branchId, isRead, createdAt, readAt }`; `POST /notifications/{id}/read` → `NotificationDto`; `POST /notifications/read-all` → `{ count }`; `GET /notifications/unread-count` → `{ count }`
- `GET /audit-logs` P [audit.read] filters `from, to (inclusive ISO instants), userId, action (prefix), entityType, entityId` → `AuditLogDto { id, createdAt, organizationId, branchId, userId, userName, action, entityType, entityId, correlationId, ipAddress, changes: object|null }`

## Platform super admin (`IsPlatformAdmin`, token without org allowed)
- `GET /platform/organizations` P [platform.organizations.read] → `{ id, name, slug, status, planCode, subscriptionStatus, branchesCount, usersCount, createdAt, isDemo }` (aggregates only — no business data)
- `POST /platform/organizations` [platform.organizations.manage] `{ name, slug, currency, ownerEmail, ownerFullName, ownerPassword, planCode, branchName }` → creates org + branch + system roles + owner
- `POST /platform/organizations/{id}/suspend|activate`; `PUT /platform/organizations/{id}/subscription` `{ planCode, status, endsAt? }` (list DTO has no `endsAt`)
- `GET/POST/PUT /platform/plans`; `GET /platform/features`
- `GET /platform/feature-flags?organizationId=` → `{ id, organizationId|null, featureCode, isEnabled, updatedAt|null }[]`; `PUT /platform/feature-flags` `{ organizationId?, featureCode, isEnabled }`
- `GET /platform/system` → `{ version, environment, dbStatus: "ok"|"unavailable", uptime (seconds, integer), startedAt, organizationsCount, usersCount, ordersToday }`
- `GET /platform/system-events` P → `AuditLogDto` (same filters as `/audit-logs`; no `organizationName`)
- `GET /platform/demo-requests` P; `POST /platform/demo-requests/{id}/status` `{ status }`
- Break-glass tenant access: `POST /platform/organizations/{id}/access` `{ reason }` → audited, returns short-lived (30 min) token for that org with read-only permissions: 200 `{ accessToken, expiresAt, organizationId, organizationName, permissions: string[] }` (no refresh token).
