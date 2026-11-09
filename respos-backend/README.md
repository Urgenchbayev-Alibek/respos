# RestaurantOS backend (`respos-backend`)

.NET 8 · ASP.NET Core · EF Core 8 + Npgsql (snake_case) · FluentValidation · Serilog · SignalR · xUnit + Testcontainers.
Clean Architecture modular monolith: `Api → Application → Domain`, `Infrastructure → Application`.

```bash
docker compose -f ../infra/docker/docker-compose.yml up -d postgres   # localhost:5433
dotnet build && dotnet test                                            # tests need Docker (Testcontainers)
dotnet run --project src/Restaurant.Api                                # http://localhost:5080/swagger
dotnet ef migrations add <Name> -p src/Restaurant.Infrastructure -s src/Restaurant.Infrastructure -o Persistence/Migrations
docker build -t respos-api .                                           # container listens on 8080
```

In Development the app migrates on startup and seeds the demo org (`Database:MigrateOnStartup`, `Seed:DemoData`).
Demo users: `owner|admin|manager|waiter|cook|cashier|stock|accountant@demo.respos.uz` / `Demo123!` (`Seed:DemoPassword`, Development only), platform admin `superadmin@respos.uz`.
Outside Development, set `ConnectionStrings__DefaultConnection`, `Jwt__SigningKey` (≥32 bytes), `Frontend__AllowedOrigins__0`, `Seed__PlatformAdminPassword`.
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
  SameSite from `Auth:RefreshCookieSameSite`, default Lax), SHA-256 hashed, rotated each refresh; reuse revokes the family.
  Lockout 5 failures → 15 min. Permissions are loaded from DB per request (cached in scope); blocked users/suspended orgs lose them immediately.
- **Rate limits**: login 5/min per IP+email, `auth` policy 20/min/IP (refresh, forgot/reset, accept), public demo requests 5/hour/IP, global 300/min per user/IP.
- **Health**: `/health/live`, `/health/ready` (DB). **Swagger**: `/swagger` (Development or `Swagger:Enabled`).
- **SignalR**: `/hubs/restaurant?access_token=…`; `JoinBranch`, `JoinKitchenStation`, `LeaveKitchenStation` validate access.

## Error codes defined so far

`validation.failed`, `server.error`, `request.invalid`, `concurrency.conflict`, `conflict.duplicate`, `rate_limit.exceeded`,
`auth.unauthenticated`, `auth.forbidden`, `auth.invalid_credentials`, `auth.account_locked`, `auth.account_blocked`, `auth.no_organization`,
`auth.organization_forbidden`, `auth.invalid_refresh_token`, `auth.refresh_token_reused`, `auth.token_expired`, `auth.invalid_token`,
`auth.invalid_current_password`, `organization.suspended`, `organization.not_found`,
`tenant.required`, `tenant.branch_forbidden`, `plan.limit_exceeded`,
`user.not_found`, `user.email_taken`, `user.cannot_modify_self`, `user.last_owner`, `user.owner_protected`, `user.invalid_roles`, `user.invalid_branches`,
`role.not_found`, `role.name_taken`, `role.system_protected`, `role.in_use`, `role.invalid_permissions`, `branch.not_found`, `branch.last_active`,
`idempotency.key_required`, `idempotency.key_reused`, `idempotency.in_progress`,
`order.not_found`, `order.item_not_found`, `order.invalid_status_transition`, `order.has_payments`, `order.closed`, `order.nothing_to_send`,
`order.cancel_reason_required`, `order.invalid_quantity`, `order.item_not_editable`, `order.invalid_discount`, `order.table_required`,
`payment.invalid_amount`, `payment.exceeds_due`, `payment.invalid_refund_amount`, `stock.insufficient`,
`reservation.invalid_period`, `reservation.time_conflict`,
`report.not_found`, `report.invalid_period`, `report.unsupported_format`, `feature.disabled`, `feature.not_found`, `notification.not_found`,
`organization.slug_taken`, `plan.not_found`, `plan.code_taken`, `plan.invalid_features`, `demo_request.not_found`. Hub errors: `tenant.branch_forbidden`, `auth.forbidden`, `kitchen_station.not_found`.

## Known limitations

- `User.Status` is global: blocking a user in one org also blocks them in their other orgs (MVP: one org per user).
- `POST /users` returns `user.email_taken` for an e-mail that exists in another org; use invitations for existing people.
- Two concurrent refreshes with the same cookie (two tabs) trigger reuse detection → sign-in again.
- Idempotency records are written after the action commits (separate statement); `Payment.IdempotencyKey` (unique per org) is the DB safety net.
- Break-glass: `POST /platform/organizations/{id}/access` issues a 30-min JWT with claim `tenant_access=read_only` (no refresh);
  it gets only org `*.read` permissions, all branches, and GET/HEAD requests only. Every grant is audited (`platform.tenant_access.granted`).
- Notifications fan out one row per recipient (`INotificationPublisher`); `IFeatureFlags`: org flag > global flag > plan feature.
