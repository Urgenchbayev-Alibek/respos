# Contract changelog

- 2026-11-10 — v1 initial contract (CONVENTIONS, PERMISSIONS, DOMAIN_MODEL, ENDPOINTS, REALTIME).
- 2026-11-10 — v1.1 clarifications: see DECISIONS_v1_1.md (BusinessDate, refunds per shift, status families, order status recompute, variant price, roles, cookie SameSite, contrast).
- 2026-11-10 — v1.2 frontend/backend alignment: ENDPOINTS.md now documents the real implemented DTOs (OrderDto.businessDate/cancelReason, /orders/active plain array, ReceiptDto, CashShiftDto totals, PaymentDto without orderNumber, RefundDto 201 with nested payment, /menu/pos plain array, MenuItemDto sku/availability, TableDto nullable fields, ReservationDto tableNumber/cancelReason, stock counts summary/lines, movement totals, report DTOs, NotificationDto + `{count}` responses, AuditLogDto, platform system uptime seconds, break-glass response, feature flags). Date-filter formats and domain-error shape clarified. `/reservations/availability` and `GET /reservations/{id}` marked not implemented.
- 2026-11-10 — **v2.0** feature expansion (FEATURES_V2.md; per-module contracts in `v2/F1…F7`): guests CRM & loyalty (F1),
  split bill / tips / Payme & Click providers + fiscal stub (F2), delivery board / couriers / public QR menu / waiter calls (F3),
  per-branch menu overrides / stock transfers / purchase suggestions (F4), analytics + XLSX/print exports + dashboard v2 (F5),
  time clock / schedule / timesheet / PIN login on shared devices (F6), Telegram / Eskiz SMS / SMTP integrations + online
  reservations (F7), PWA / dark theme / 80 mm printing / en locale (F8). Additive DTO fields: `OrderDto.customer`,
  `loyaltyDiscountAmount`, `isSplit`, `bills`, `deliveryFee`; `PaymentDto.billId`, `tipAmount`; `CashShiftDto.tipsAmount`,
  `cashTipsAmount`; `BranchDto.slug`; `IngredientDto.defaultSupplierId/Name`; `ReceiptDto.deliveryFee`. One combined
  migration `V2Features` (additive; new non-null columns default to 0/false). Merge decisions:
  - Public online reservations are keyed by the branch slug: `GET /public/branches/{slug}/availability`,
    `POST /public/branches/{slug}/reservations` (the id-keyed routes of the F7 branch were removed; DTO has `branchSlug`).
  - `PUT /loyalty/settings` requires `settings.manage` (waiter/cashier/manager hold `customers.manage`).
  - Loyalty redeem / cancel on a split order → 409 `order.split_active` (merge first); `maxRedeemable` is 0 while split.
  - One phone normalization for guests, delivery, couriers, reservations and SMS (`+998…`, other `+<8–15 digits>`; guests UZ only).
  - Admin sidebar gets «Интеграции» (`integrations.manage`).
