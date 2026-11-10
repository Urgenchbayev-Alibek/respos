# RestaurantOS backend (`respos-backend`)

.NET 8 · ASP.NET Core · EF Core 8 + Npgsql (snake_case) · FluentValidation · Serilog · SignalR · xUnit + Testcontainers.
Clean Architecture modular monolith: `Api → Application → Domain`, `Infrastructure → Application`.

```bash
docker compose -f ../infra/docker/docker-compose.yml up -d postgres   # localhost:5433
dotnet build && dotnet test                                            # tests need Docker (Testcontainers)
dotnet run --project src/Restaurant.Api                                # http://localhost:5080/swagger
dotnet tool restore && dotnet ef migrations add <Module>_<Change> -p src/Restaurant.Infrastructure -s src/Restaurant.Api -o Persistence/Migrations
dotnet ef database update -p src/Restaurant.Infrastructure -s src/Restaurant.Api   # design-time DB: RESPOS_DESIGN_CONNECTION
docker build -t respos-api .                                           # container listens on 8080
```

In Development the app migrates on startup and seeds the demo org (`Database:MigrateOnStartup`, `Seed:DemoData`).
Demo users: `owner|admin|manager|waiter|cook|cashier|stock|accountant@demo.respos.uz` / `Demo123!` (`Seed:DemoPassword`, Development only), platform admin `superadmin@respos.uz`.
Outside Development, set `ConnectionStrings__DefaultConnection`, `Jwt__SigningKey` (≥32 bytes), `Frontend__AllowedOrigins__0`, `Seed__PlatformAdminPassword`.
Startup fails fast (`InvalidOperationException`) when the connection string is missing or the signing key is < 32 bytes.
`Database:MigrateOnStartup` works in any environment (compose profile `full` runs `Production` with it on; see `docs/deployment/DEPLOYMENT.md`).
Base seeders (permission sync incl. system-role permissions, plans/features, platform admin) run on every start and are idempotent.

## Layout

| Project | Contents |
|---|---|
| `Restaurant.Domain` | `Common/` (Entity, AuditableEntity, ITenantScoped/IBranchScoped/IArchivable, Result, Error, Money, DomainEvent), `Constants/` (Permissions, PermissionCatalog, SystemRoles), `Enums/`, `Entities/<Module>/`, `Events/DomainEvents.cs`, `Exceptions/DomainException` |
| `Restaurant.Application` | `Abstractions/` (persistence, context, clock, security, files, payments, email, realtime, audit, idempotency, events), `Common/` (IHandler, PageQuery/PagedResult, validation rules, security services), `Features/<Module>/<UseCase>/` |
| `Restaurant.Infrastructure` | `Persistence/Context` (AppDbContext partials), `Configurations/<Module>/`, `Migrations/`, `Seed/`, `Identity/` (JWT, hashing), `Realtime/`, `Audit/`, `Idempotency/`, `Files/`, `Services/` |
| `Restaurant.Api` | `Controllers/`, `Authorization/` (HasPermission), `Filters/` (RequireBranch, RequireIdempotencyKey, validation, login rate limit), `Middleware/`, `Hubs/RestaurantHub`, `Extensions/` |

## How to add a feature module (parallel-agent guide)

Touch only your module's files. Nothing has to be registered centrally.

1. **Entities** already exist for every module (`Domain/Entities/<Module>`). Add behaviour in your module's entity files
   (several are `partial`: `Order`, `OrderItem`, `KitchenTicket`, `PurchaseOrder`, `CashShift`, `Payment` — add e.g. `KitchenTicket.Lifecycle.cs`).
   Throw `DomainException(Error)` for invariant violations; keep errors in `<Module>Errors.cs`.
2. **DbSets** already exist: `IApplicationDbContext.{Identity,Floor,Orders,Inventory,Notifications}.cs`
   ↔ `AppDbContext.{same}.cs`. A new entity → add it to your module's pair of partial files + an
   `IEntityTypeConfiguration<T>` under `Persistence/Configurations/<Module>/` (use `HasTenant()` / `HasBranch()` / `IsQuantity()`
   from `ConfigurationExtensions`). Prefer **no schema change**; if you must, add one migration named `<Module>_<Change>` and tell the
   orchestrator (snapshot conflicts are resolved by regenerating).
3. **Use case** = folder `Application/Features/<Module>/<UseCase>/` with a command/query record, a FluentValidation
   `AbstractValidator<TCommand>` (validated automatically for action arguments by the global `ValidationFilter`) and a handler:
   ```csharp
   public sealed record CancelOrderCommand(string Reason) { public Guid OrderId { get; init; } }
   public sealed class CancelOrderHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, IAuditLogger audit, IRealtimeNotifier realtime)
       : IHandler<CancelOrderCommand, OrderDto>
   {
       public async Task<Result<OrderDto>> HandleAsync(CancelOrderCommand cmd, CancellationToken ct)
       {
           var branchId = tenant.RequireBranchId();
           var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == cmd.OrderId && o.BranchId == branchId, ct);
           if (order is null) return OrderErrors.NotFound;              // other tenant's id → 404 (query filter)
           order.Cancel(cmd.Reason, tenant.UserId, clock.UtcNow);       // invalid transition → DomainException → 409
           audit.Log("order.cancelled", nameof(Order), order.Id, new { cmd.Reason });
           realtime.ToBranch(branchId, RealtimeEvents.OrderUpdated, new { orderId = order.Id, status = order.Status, tableId = order.TableId, branchId, occurredAt = clock.UtcNow });
           await db.SaveChangesAsync(ct);                               // events → commit → realtime flush
           return OrderMapper.ToDto(order);
       }
   }
   ```
   Handlers (`IHandler<,>`), validators and domain event handlers are found by assembly scanning (`Application/DependencyInjection.cs`).
   Shared helpers used by several handlers: mark the class `[ScopedService]` (auto-registered as itself).
   We deliberately avoid MediatR: plain DI handlers are explicit, debuggable and enough here.
4. **Controller** in `Api/Controllers/<Module>Controller.cs`:
   ```csharp
   [Route(RoutePrefix + "orders")]
   [RequireBranch]                                         // X-Branch-Id required + validated → ITenantContext.BranchId
   public sealed class OrdersController : ApiControllerBase  // [ApiController][Authorize], Result → HTTP helpers
   {
       [HttpPost("{id:guid}/cancel")]
       [HasPermission(Permissions.Orders.Cancel)]           // any-of: [HasPermission(a, b)]
       public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelOrderCommand cmd, [FromServices] CancelOrderHandler h, CancellationToken ct)
           => OkOrProblem(await h.HandleAsync(cmd with { OrderId = id }, ct));
   }
   ```
   `[RequireIdempotencyKey]` on `POST /payments`, `/payments/{id}/refunds`, `/orders/{id}/send-to-kitchen`, `/purchases/{id}/receive`
   (stores the 2xx response for 24h per Key+User; replay sets `Idempotent-Replayed: true`). Org-level endpoints do not use `[RequireBranch]`.
   Helpers: `OkOrProblem`, `CreatedOrProblem`, `AcceptedOrProblem`, `NoContentOrProblem`, `Problem(error)`.
5. **Tenant & branch rules**: every `ITenantScoped` entity has a global filter `OrganizationId == current org`; new rows get
   `OrganizationId` automatically; cross-tenant writes throw. Branch data: always filter `x.BranchId == tenant.RequireBranchId()`.
   Child tables (OrderItem, ticket items, recipe ingredients, PO items, variants, options…) have **no** OrganizationId — always reach them via the root.
   Never read org/branch/user ids from request bodies. Without tenant (seeders, anonymous auth) use `IgnoreQueryFilters()` + explicit ids.
6. **Domain events** (`Domain/Events/DomainEvents.cs`: `OrderSubmitted`, `OrderItemReady`, `OrderPaid`, `StockLow`, `PurchaseReceived`):
   raise via `Raise(...)` in entities; handle with `IDomainEventHandler<TEvent>` anywhere in Application. Handlers run **inside the same
   SaveChanges, before commit** (e.g. ingredient consumption on `OrderPaidDomainEvent` is atomic with the payment). Handlers must not call
   `SaveChangesAsync`. `Order` raises Submitted/ItemReady/Paid; `StockBalance.Apply` raises StockLow when crossing the minimum.
7. **Realtime**: `IRealtimeNotifier.ToBranch/ToKitchen/ToUser(...)` only queues; messages are sent after a successful commit
   (`SaveChangesAsync` or `ExecuteInTransactionAsync`). Groups/event names: `RealtimeGroups`, `RealtimeEvents` (REALTIME.md).
8. **Audit**: `IAuditLogger.Log(action, entityType, id, changes)` adds a sanitized row to the same unit of work (keys containing
   password/token/hash/secret are stripped). Actions are dot-separated (`order.cancelled`, `payment.refunded`).
9. **Money/quantities**: `decimal` only; `Money.Round` / `Money.Percent` (AwayFromZero). Columns default to numeric(18,2); use `IsQuantity()` for (18,3).
10. **Tests**: integration tests share one Postgres container and API host:
    ```csharp
    [Collection(ApiCollection.Name)]
    public sealed class OrdersTests(ApiFactory factory) : ApiTestBase(factory)
    {
        [Fact] public async Task Waiter_creates_order()
        {
            var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);          // org + branch + roles + plan + units + user
            var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
            var cook = await AddUserAsync(org, SystemRoles.Cook);               // more users in the same org
            await WithDbAsync(async (db, sp) => { /* arrange data; IgnoreQueryFilters() for tenant tables */ await db.SaveChangesAsync(); });
            // ... ReadJsonAsync(response), ReadErrorCodeAsync(response)
        }
    }
    ```
    Create your own data per test (never rely on demo seed). Unit tests: `tests/Restaurant.UnitTests/<Module>/`.
11. Files ≤ 500 lines (aim 100–250); no float/double; async I/O; no empty catch.

## Cross-cutting behaviour

- **Errors**: RFC 7807 + `code` + `correlationId` (+ camelCase `errors` for validation). `ErrorType` → 400/401/403/404/409/422/429/500.
  DbUpdateConcurrency → 409 `concurrency.conflict` (Order/StockBalance use `xmin`), unique violation → 409 `conflict.duplicate`.
- **Auth**: JWT 15 min (`sub`, `org`, `platform_admin`), refresh token in httpOnly cookie `refresh_token` (path `/api/v1/auth`,
  SameSite from `Auth:RefreshCookieSameSite`, default Lax), SHA-256 hashed, rotated each refresh (atomic conditional update); reuse revokes the family, except within the grace window (ADR-0003).
  Lockout 5 failures → 15 min. Permissions are loaded from DB per request (cached in scope); blocked users/suspended orgs lose them immediately.
- **Rate limits**: login 5/min per IP+email, `auth` policy 20/min/IP (refresh, forgot/reset, accept), public demo requests 5/hour/IP, global 300/min per user/IP.
- **Health**: `/health/live`, `/health/ready` (DB). **Swagger**: `/swagger` (Development or `Swagger:Enabled`).
- **SignalR**: `/hubs/restaurant?access_token=…`; `JoinBranch`, `JoinKitchenStation`, `LeaveKitchenStation` validate access.
  Refusals throw `HubException` with a safe code (`tenant.branch_forbidden`, `auth.forbidden`, `kitchen_station.not_found`);
  `HubErrorLoggingFilter` logs them at Warning and drops SignalR's duplicate Error entry (other exceptions still log at Error).
- **HTTP pipeline** (`Extensions/HttpPipelineExtensions`): `UseForwardedHeaders` (X-Forwarded-For/Proto; `Http:KnownProxies` /
  `Http:KnownNetworks`, empty = trust the nearest hop, for PaaS), `Http:UseHttpsRedirection` (default false — TLS ends at the proxy;
  true → HSTS + redirect outside Development), security headers on every response (`nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`).
- **Housekeeping** (`Infrastructure/Housekeeping`): background job on start + every `Housekeeping:IntervalMinutes` (60; `Housekeeping:Enabled`)
  bulk-deletes across tenants: idempotency records > 24h, refresh tokens expired/revoked > 30d, password-reset tokens and
  invitations expired > 30d, read notifications > 90d (`*RetentionHours/Days` keys). Failures are logged; the next tick retries.

## Error codes

Every `code` the API can return (collected from all modules' `*Errors.cs`, validators and middleware). Frontends map them to localized messages and fall back to `title`.

- **Common**: `concurrency.conflict`, `conflict.duplicate`, `feature.disabled`, `feature.not_found`, `idempotency.in_progress`, `idempotency.key_required`, `idempotency.key_reused`, `plan.code_taken`, `plan.invalid_features`, `plan.limit_exceeded`, `plan.not_found`, `rate_limit.exceeded`, `request.invalid`, `server.error`, `tenant.branch_forbidden`, `tenant.required`, `validation.failed`
- **Auth & organization**: `auth.account_blocked`, `auth.account_locked`, `auth.forbidden`, `auth.invalid_credentials`, `auth.invalid_current_password`, `auth.invalid_refresh_token`, `auth.invalid_token`, `auth.no_organization`, `auth.organization_forbidden`, `auth.refresh_token_reused`, `auth.token_expired`, `auth.unauthenticated`, `auth.weak_password`, `branch.last_active`, `branch.not_found`, `organization.not_found`, `organization.slug_taken`, `organization.suspended`, `role.in_use`, `role.invalid_permissions`, `role.name_taken`, `role.not_found`, `role.system_protected`, `user.cannot_modify_self`, `user.email_taken`, `user.invalid_branches`, `user.invalid_roles`, `user.last_owner`, `user.not_found`, `user.owner_protected`
- **Floor & reservations**: `dining_area.archived`, `dining_area.has_tables`, `dining_area.not_found`, `reservation.invalid_period`, `reservation.invalid_status_transition`, `reservation.not_editable`, `reservation.not_found`, `reservation.table_required`, `reservation.time_conflict`, `table.archived`, `table.has_active_order`, `table.invalid_status`, `table.not_found`, `table.number_taken`, `table.unavailable`
- **Menu & kitchen**: `kitchen_station.in_use`, `kitchen_station.not_configured`, `kitchen_station.not_found`, `kitchen_ticket.invalid_status_transition`, `kitchen_ticket.not_found`, `kitchen_ticket_item.not_found`, `menu_category.archived`, `menu_category.has_items`, `menu_category.not_found`, `menu_item.archived`, `menu_item.invalid_modifier_groups`, `menu_item.invalid_photo`, `menu_item.invalid_variant`, `menu_item.not_found`, `modifier_group.invalid_option`, `modifier_group.not_found`
- **Orders & payments**: `cash_shift.already_open`, `cash_shift.closed`, `cash_shift.invalid_amount`, `cash_shift.not_found`, `cash_shift.not_open`, `order.cancel_reason_required`, `order.closed`, `order.has_payments`, `order.invalid_discount`, `order.invalid_quantity`, `order.invalid_status_transition`, `order.item_not_editable`, `order.item_not_found`, `order.menu_item_unavailable`, `order.not_dine_in`, `order.not_found`, `order.nothing_to_send`, `order.table_required`, `payment.duplicate`, `payment.exceeds_due`, `payment.invalid_amount`, `payment.invalid_refund_amount`, `payment.not_found`, `payment.provider_failed`, `payment.refund_reason_required`
- **Inventory & procurement**: `ingredient.archived`, `ingredient.base_unit_locked`, `ingredient.not_found`, `ingredient_category.not_found`, `inventory_count.completed`, `inventory_count.not_found`, `purchase.invalid_receive_quantity`, `purchase.invalid_status_transition`, `purchase.item_not_found`, `purchase.not_editable`, `purchase.not_found`, `purchase.receive_exceeds_remaining`, `recipe.invalid_variant`, `recipe.not_found`, `stock.insufficient`, `supplier.archived`, `supplier.not_found`, `unit.code_taken`, `unit.conversion_exists`, `unit.conversion_missing`, `unit.not_found`
- **Reports, notifications, platform**: `demo_request.not_found`, `notification.not_found`, `report.invalid_period`, `report.not_found`, `report.unsupported_format`
- **Guests & loyalty (F1)**: `customer.has_history`, `customer.invalid_phone`, `customer.invalid_tags`, `customer.name_required`, `customer.not_found`, `customer.phone_taken`, `loyalty.already_redeemed`, `loyalty.below_min_order`, `loyalty.disabled`, `loyalty.exceeds_limit`, `loyalty.insufficient_points`, `loyalty.invalid_points`, `loyalty.invalid_settings`, `loyalty.no_customer`, `loyalty.nothing_redeemed`, `loyalty.redemption_active`
- **Split bill, tips & payment providers (F2)**: `order.already_split`, `order.bill_not_found`, `order.bill_paid`, `order.invalid_split`, `order.not_split`, `order.split_active`, `order.split_mismatch`, `payment.bill_required`, `payment.intent_not_found`, `payment.intent_not_pending`, `payment.intent_pending`, `payment.intent_transaction_mismatch`, `payment.nothing_due`, `payment.provider_not_configured`, `payment.provider_not_enabled`, `payment.provider_not_found`
- **Delivery, QR menu & waiter calls (F3)**: `branch.slug_taken`, `courier.inactive`, `courier.not_found`, `delivery.cancel_reason_required`, `delivery.closed`, `delivery.courier_required`, `delivery.invalid_status_transition`, `delivery.items_required`, `delivery.not_found`, `order.invalid_delivery_fee`, `public_menu.not_found`, `waiter_call.not_found`
- **Branch menu & stock transfers (F4)**: `stock_transfer.destination_branch_required`, `stock_transfer.destination_not_found`, `stock_transfer.empty`, `stock_transfer.invalid_status_transition`, `stock_transfer.not_editable`, `stock_transfer.not_found`, `stock_transfer.same_branch`, `stock_transfer.source_branch_required`
- **Staff, time clock & PIN (F6)**: `device.invalid`, `device.locked`, `device.not_found`, `pin.invalid`, `pin.locked`, `pin.not_allowed`, `pin.weak`, `shift.invalid_period`, `shift.invalid_time`, `shift.not_found`, `shift.overlap`, `staff.member_not_found`, `time_entry.already_open`, `time_entry.invalid_break`, `time_entry.invalid_period`, `time_entry.not_found`, `time_entry.not_open`
- **Integrations & online reservations (F7)**: `integration.not_configured`, `integration.not_found`, `reservation.invalid_date`, `reservation.invalid_time`, `reservation.slot_unavailable`, `reservation.too_many_guests`
- **SignalR hub errors** (`HubException` message): `tenant.branch_forbidden`, `auth.forbidden`, `kitchen_station.not_found`.

## Report exports & licensing (F5)

`GET /reports/{name}/export?format=csv|xlsx|pdf` (`reports.export`). XLSX uses **ClosedXML** (MIT) behind
`ISpreadsheetWriter`; "pdf" is print-ready HTML printed by the browser (ADR-0015). **QuestPDF is deliberately not used**:
its Community license is free only for companies with < 1 M USD annual revenue — adopting it later requires a paid license
review. Contract: `respos-contracts/v2/F5-analytics.md`.

## Known limitations

- `User.Status` is global: blocking a user in one org also blocks them in their other orgs (MVP: one org per user).
- `POST /users` returns `user.email_taken` for an e-mail that exists in another org; use invitations for existing people.
- Concurrent refreshes with the same cookie (two tabs / retry) are handled by the reuse grace window (`Auth:RefreshReuseGraceSeconds`, 15 s, ADR-0003); reuse after the window still revokes the family.
- Idempotency records are written after the action commits (separate statement); `Payment.IdempotencyKey` (unique per org) is the DB safety net.
- Break-glass: `POST /platform/organizations/{id}/access` issues a 30-min JWT with claim `tenant_access=read_only` (no refresh);
  it gets only org `*.read` permissions, all branches, and GET/HEAD requests only. Every grant is audited (`platform.tenant_access.granted`).
- Notifications fan out one row per recipient (`INotificationPublisher`); `IFeatureFlags`: org flag > global flag > plan feature.
