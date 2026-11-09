# Contract v1.1 — clarifications (override earlier text where they conflict)

Resolves inconsistencies found during docs review (2026-11-10). All agents MUST apply these.

1. **Order.BusinessDate** (`date`, branch timezone) added. `Number` is unique per `(BranchId, BusinessDate)`.
2. **Refund** gets `CashShiftId` (shift open at refund time, required) and `Method` (copied from the payment).
   `paidAmount = Σ payment.Amount − Σ refund.Amount` (payments counted regardless of their status; `Payment.Status`
   is informational: `completed | partially_refunded | refunded`). Shift expected cash =
   opening + Σ cash payments in this shift − Σ cash refunds in this shift.
3. **Status families** (distinct on purpose):
   - OrderItem: `new | sent | preparing | ready | served | cancelled`
   - KitchenTicketItem: `new | preparing | ready | cancelled` (serving is tracked on OrderItem only)
   - KitchenTicket: `new | in_progress | ready | served | cancelled`
   Mapping: ticket item `new`→order item `sent`; `preparing`→`preparing`; `ready`→`ready`.
4. **Order status is recomputed from active (non-cancelled) items** after every item change, except terminal states:
   no items sent → `draft`; any `sent` and none preparing/ready → `submitted`; any `preparing` or a mix → `in_progress`;
   some `ready|served` and some not → `partially_ready`; all `ready|served` and at least one `ready` → `ready`;
   all `served` → `served`. Adding/sending new items to a `ready|served` order moves it back accordingly. Ticket recall
   (ready→in_progress) likewise.
   - Payment allowed in any status except `cancelled`/`paid` (takeaway may pay first). When `paidAmount == total`
     and total > 0 → `paid` (terminal, closes order, frees table, raises `OrderPaidDomainEvent`). Kitchen tickets
     of a paid order continue normally.
   - Cancel allowed from any non-terminal status only if `paidAmount == 0` (otherwise refund first); requires reason
     + `orders.cancel`; cancels open tickets.
   - Refund does not change a `paid` order status (MVP); refund reason + audit required.
5. **MenuItemVariant** has absolute `Price` (no PriceDelta). **MinQuantity** lives only on `StockBalance` (per branch).
6. **Child tables** (OrderItem, OrderItemModifier, KitchenTicketItem, RecipeIngredient, PurchaseOrderItem,
   ModifierOption, MenuItemVariant, RolePermission, …) are scoped through their aggregate root; they have no
   OrganizationId and are never queried without the root.
7. `MenuItem.KitchenStationId` and `IsAvailable` are org-level in MVP (single pilot branch). Known limitation →
   per-branch menu settings later (User-Todo Q2).
8. Idempotency: `IdempotencyRecord(Key, UserId)` is the HTTP-level replay store (same response returned).
   `Payment.IdempotencyKey` unique per org is a DB safety net against double payment.
9. Roles: `admin` = all org permissions (cannot remove/deactivate the last owner). `manager` includes
   `orders.discount.apply` and `orders.transfer`. `accountant` also gets `notifications.read`.
   `GET /dashboard` requires `reports.read`; users without it get 403 and the UI opens their workspace instead.
10. Refresh cookie: recommended deployment is same-site (`app.<domain>` + `api.<domain>`), cookie `SameSite=Lax`
    when same-site, `None; Secure` only when cross-site (configurable `Auth:RefreshCookieSameSite`).
11. UI: filled primary buttons use `#C2410C` (hover `#9A3412`) for WCAG AA; `#E85D2A` for accents.
12. Reservation ↔ table: confirming a reservation does not change the table status by itself; `TableDto.nextReservation`
    shows the next confirmed one (today). `seat` → creates nothing but sets table `occupied`; `complete`/`no_show`/`cancel`
    → table `available` if no active order. A background check is NOT required in MVP.
    Login lockout: 5 consecutive failures → 15 min lockout (plus the rate limiter).
