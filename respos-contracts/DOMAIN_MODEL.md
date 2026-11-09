# Domain model (entities, enums, rules)

Base classes (Domain/Common): `Entity` (Guid Id), `AuditableEntity` (CreatedAt, CreatedBy, UpdatedAt, UpdatedBy),
`ITenantScoped` (OrganizationId), `IBranchScoped` (BranchId), `IArchivable` (IsArchived, ArchivedAt).
Every business table has `OrganizationId` (indexed) + EF global query filter on the current tenant.
Branch data also has `BranchId`. Archive instead of delete for anything referenced historically.

## Identity / SaaS

- **Organization**: Name, Slug (unique), Currency (default `UZS`), DefaultLanguage (`ru`), Status (`active|suspended|closed`), IsDemo (bool, demo seed flag), CreatedAt.
- **RestaurantBranch**: OrganizationId, Name, Address, Phone, Timezone (default `Asia/Tashkent`), IsActive.
- **BranchSettings** (1:1 branch): ServiceChargePercent (decimal 5,2 default 0), TaxPercent (default 0), AllowNegativeStock (false), InventoryConsumptionTrigger (`on_payment` — only value in MVP), ReceiptFooter.
- **User**: Email (unique, normalized lower), PasswordHash, FullName, Phone, PreferredLanguage, IsPlatformAdmin, Status (`active|invited|blocked|deactivated`), LastLoginAt, FailedLoginCount, LockoutUntil.
- **UserOrganization**: UserId, OrganizationId, IsActive, JoinedAt (unique pair).
- **Role**: OrganizationId, Code, Name, IsSystem. **Permission**: Code (PK-like unique), Module, Description. **RolePermission**, **UserRole** (UserId, RoleId, OrganizationId).
- **UserBranchAccess**: UserId, BranchId, OrganizationId.
- **RefreshToken**: UserId, OrganizationId?, TokenHash (SHA-256, never raw), FamilyId, ExpiresAt, RevokedAt, ReplacedByTokenId, CreatedByIp.
- **UserInvitation**: OrganizationId, Email, RoleIds, BranchIds, TokenHash, ExpiresAt, AcceptedAt.
- **PasswordResetToken**: UserId, TokenHash, ExpiresAt, UsedAt.
- **Plan**: Code (`starter|business|enterprise`), Name, MaxBranches, MaxUsers, IsActive. **Feature**: Code, Name. **PlanFeature**. **Subscription**: OrganizationId, PlanId, Status (`trial|active|past_due|suspended|cancelled`), StartsAt, EndsAt. **FeatureFlag**: OrganizationId? (null = global), FeatureCode, IsEnabled. **BillingEvent** (entity only, unused in MVP).
- **DemoRequest** (from landing, not tenant-scoped): Name, Phone, Email, RestaurantName, City, Message, Status (`new|contacted|closed`), CreatedAt.

## Floor & reservations

- **DiningArea**: Branch-scoped. Name, SortOrder, IsActive.
- **DiningTable**: Branch-scoped. DiningAreaId, Number (string, unique per branch among non-archived), Capacity, Status (`available|occupied|reserved|unavailable`), IsActive, IsArchived, PosX, PosY (floor plan, nullable).
- **TableReservation**: Branch-scoped. TableId?, PreferredAreaId?, GuestName, GuestPhone, GuestCount, StartsAt, EndsAt, Comment, Status (`pending|confirmed|seated|completed|cancelled|no_show`).
  Rule: for the same table, active reservations (`pending|confirmed|seated`) must not overlap `[StartsAt, EndsAt)` → 409 `reservation.time_conflict`.

## Menu & kitchen stations

- **KitchenStation**: Branch-scoped. Name, SortOrder, IsActive.
- **MenuCategory**: Org-scoped. Name, NameUz, SortOrder, IsActive, IsArchived.
- **MenuItem**: Org-scoped. CategoryId, Name, NameUz, Description, PhotoUrl, Price, PrepTimeMinutes, KitchenStationId? (branch-specific mapping kept simple: station of the pilot branch), IsAvailable, IsArchived, Sku.
- **MenuItemVariant**: MenuItemId, Name, PriceDelta (or absolute Price — use `Price` absolute), IsDefault, IsArchived.
- **ModifierGroup**: Org-scoped. Name, MinSelect, MaxSelect, IsRequired. **MenuItemModifierGroup** (link). **ModifierOption**: GroupId, Name, PriceDelta, IsArchived.
- **MenuAvailability**: MenuItemId, DayOfWeek?, StartTime, EndTime (time-of-day availability, branch timezone).

## Orders

- **Order**: Branch-scoped. Number (int, sequential per branch per day → display `#0042`), Type (`dine_in|takeaway`), TableId?, WaiterId, GuestCount, Status, Subtotal, DiscountType (`none|amount|percent`), DiscountValue, DiscountAmount, ServiceChargeAmount, TaxAmount, Total, PaidAmount, Comment, CancelReason, OpenedAt, ClosedAt, RowVersion (concurrency token — `xmin` in Postgres).
- **OrderStatus**: `draft → submitted → in_progress → partially_ready → ready → served → paid`; `cancelled` from `draft|submitted|in_progress` (with reason + `orders.cancel`). Paid orders cannot be cancelled (use refund). Transitions only through domain methods; invalid → 409 `order.invalid_status_transition`. Status is derived from item statuses after kitchen changes (all ready → `ready`; some ready → `partially_ready`; any preparing → `in_progress`).
- **OrderItem**: OrderId, MenuItemId, VariantId?, **snapshot** NameSnapshot, VariantNameSnapshot, UnitPrice, Quantity (decimal), Comment, Status (`new|sent|preparing|ready|served|cancelled`), KitchenStationId?, LineTotal, SentAt, ReadyAt, CancelReason.
- **OrderItemModifier**: OrderItemId, ModifierOptionId, NameSnapshot, PriceDelta.
- **OrderStatusHistory**: OrderId, FromStatus, ToStatus, ChangedBy, ChangedAt, Reason.
- Transfer order to another table: `orders.transfer`, audit log.

## Kitchen

- **KitchenTicket**: Branch-scoped. OrderId, KitchenStationId, Number, Status (`new|in_progress|ready|served|cancelled`), CreatedAt, StartedAt, ReadyAt.
- **KitchenTicketItem**: TicketId, OrderItemId, Status (mirrors item status: `new|preparing|ready|cancelled`).
- "Send to kitchen" groups all `new` order items by station → one ticket per station per send (partial sends allowed). Items without station → default station of branch (first by SortOrder).

## Inventory, recipes, procurement

- **UnitOfMeasure**: Org-scoped (+ seeded globals copied per org): Code (`kg,g,l,ml,pcs`), Name, Kind (`mass|volume|count`).
- **UnitConversion**: FromUnitId, ToUnitId, Factor (decimal 18,6).
- **IngredientCategory**: Name. **Ingredient**: Org-scoped. CategoryId?, Name, Sku, BaseUnitId, MinQuantity (per branch → stored on StockBalance), CostPrice (last purchase price), IsArchived.
- **StockBalance**: Branch-scoped. IngredientId, Quantity, MinQuantity, RowVersion. Unique (BranchId, IngredientId).
- **StockMovement**: Branch-scoped. IngredientId, Type (`receipt|consumption|write_off|adjustment|inventory_count|transfer_in|transfer_out`), Quantity (signed, base unit), BalanceAfter, UnitCost?, SourceType (`order|purchase|manual|inventory_count`), SourceId?, Reason, CreatedBy, CreatedAt.
  Rule: balance + movement in ONE transaction; never change a balance without a movement.
  Rule: manual movements may not make balance negative unless `AllowNegativeStock` (409 `stock.insufficient`).
- **Recipe**: Org-scoped. MenuItemId, VariantId?, Version (int), EffectiveFrom, IsActive. Only one active version per (MenuItem, Variant). New version = new row; old kept for history.
- **RecipeIngredient**: RecipeId, IngredientId, Quantity, UnitId (converted to ingredient base unit on consumption).
- **InventoryConsumption**: Branch-scoped. OrderId (**unique** → idempotency), RecipeVersionsJson, CreatedAt. Consumption trigger = **order fully paid** (`OrderPaidDomainEvent`). Consumption for sales MAY go below zero (sale already happened) → creates `StockLow`/negative notification + audit; see User-Todo Q7/Q8.
- **InventoryCount** (inventarization): Branch-scoped, Status (`draft|completed`), Lines (IngredientId, ExpectedQty, CountedQty) → on complete creates `inventory_count` adjustments.
- **Supplier**: Org-scoped. Name, ContactPerson, Phone, Email, Address, Inn (tax id, optional), Notes, IsArchived.
- **PurchaseOrder**: Branch-scoped. SupplierId, Number, Status (`draft|submitted|partially_received|received|cancelled`), ExpectedAt, Total, Comment.
- **PurchaseOrderItem**: IngredientId, Quantity, UnitId, UnitPrice, ReceivedQuantity.
- Receiving (`purchases.receive`, idempotency key): per line received qty → `receipt` StockMovement, update CostPrice, status partially_received/received.

## Payments & cash

- **CashShift**: Branch-scoped. OpenedBy, OpenedAt, OpeningAmount, ClosedBy, ClosedAt, ExpectedCashAmount, ActualCashAmount, Difference, Status (`open|closed`), Comment. Rule: max one open shift per branch per cashier... MVP: **one open shift per branch**.
- **Payment**: Branch-scoped. OrderId, CashShiftId, Method (`cash|card|other`), Amount, Status (`completed|refunded|partially_refunded`), Provider (`manual`), ExternalReference?, IdempotencyKey (unique per org), CreatedBy, CreatedAt.
  Rules: requires open shift; amount > 0; amount ≤ order remaining due (no overpay in MVP; change for cash is computed client-side as info only); when PaidAmount == Total → order `paid`, table → `available`, raise `OrderPaidDomainEvent`.
- **Refund**: PaymentId, Amount (≤ refundable), Reason (required), CreatedBy, CreatedAt. Requires `payments.refund`. Audited.
- `IPaymentProvider` (Application abstraction) with `ManualPaymentProvider` (Infrastructure). UI labels it "Ручная отметка (демо)".

## Notifications & audit

- **Notification**: Org-scoped, BranchId?, UserId? (null = all users with permission), Type (`order_new|order_status|order_ready|stock_low|purchase_received|integration_error|system`), Title, Body, Link?, IsRead (per-user read state: **NotificationRead** NotificationId+UserId), CreatedAt.
- **AuditLog**: OrganizationId?, BranchId?, UserId?, Action (e.g. `order.cancelled`), EntityType, EntityId, CorrelationId, ChangesJson (sanitized: no passwords/tokens), IpAddress, CreatedAt. Append-only.
- **IdempotencyRecord**: Key, UserId, RequestHash, ResponseStatus, ResponseBody, CreatedAt (unique Key+UserId).
