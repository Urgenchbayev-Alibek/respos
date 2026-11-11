# RestaurantOS (ResPOS) — rules for Claude / agents

Spec: `docs/requirements/TECHNICAL_SPECIFICATION.md` (original: `ТЗ_RestaurantOS_для_Claude_AI.md`).
Contract (MUST follow): `respos-contracts/` — CONVENTIONS, PERMISSIONS, DOMAIN_MODEL, ENDPOINTS, REALTIME.
Open questions / assumptions for the owner: `User-Todo.md`. Progress log: `STATUS.md`.

## Layout

| Folder | What | Stack |
|---|---|---|
| `respos-backend/` | API + SignalR, modular monolith, Clean Architecture | .NET 8 LTS, ASP.NET Core, EF Core 8 + Npgsql, FluentValidation, Serilog, xUnit, Testcontainers |
| `respos-admin/` | One React app: Admin Panel, Waiter, KDS, Cashier, Stock, Platform Super Admin (routes + layouts per workspace) | React 18, TS, Vite, React Router, TanStack Query, RHF + Zod, i18next, @microsoft/signalr, Vitest + RTL |
| `respos-landing/` | Public marketing site + demo request form | React + TS + Vite (static, Vercel) |
| `respos-desktop/` | Windows desktop app (exe): Electron shell + loopback gateway serving the built `respos-admin` | Electron, TS, esbuild, electron-builder (NSIS + portable), Vitest, Playwright `_electron` |
| `respos-contracts/` | API contract docs shared by all | Markdown |
| `docs/` | requirements, architecture + ADR, design, database (ERD), testing, deployment | Markdown |
| `infra/docker/` | docker-compose (Postgres, API), Dockerfiles | |

## Hard rules (from spec)

1. **Every hand-written source file ≤ 500 lines** (target 100–250). Generated migrations / lock files are exempt.
2. Dependency direction: `Api → Application → Domain`; Infrastructure implements Application abstractions. No DbContext in controllers, no business logic in controllers or React.
3. Money = `decimal` (C#) / `numeric(18,2)`; never float/double. Quantities `numeric(18,3)`.
4. Tenant scope: every business query is limited by `OrganizationId` (global query filter) and `BranchId` (from validated `X-Branch-Id`). Never trust org/branch/user IDs from the client body.
5. Permissions checked on the backend (`[HasPermission]`). Frontend hiding is UX only.
6. Stock balance changes only together with a `StockMovement` in one transaction. Ingredient consumption is idempotent (unique `InventoryConsumption.OrderId`).
7. Order/item statuses change only via domain methods, invalid transitions → 409.
8. SignalR only notifies; clients refetch from REST (and always after reconnect).
9. No secrets in repo or in `VITE_*`. Config via env vars (`.env.example`). No stack traces to clients.
10. Mock/demo integrations must be labeled “Демо / Не подключено” in UI. Demo seed data flagged (`Organization.IsDemo`).
11. No duplicated helpers: one api client, one formatCurrency, one hasPermission, one permission catalog per side.
12. Nullable reference types on, async all I/O, no `.Result/.Wait()`, no empty catch, no dead/commented-out code.
13. UI strings via i18n resources (ru, uz-Latn; en placeholder).
14. Don't claim tests/builds passed unless you ran them.

## Commands

```bash
# infra
docker compose -f infra/docker/docker-compose.yml up -d postgres
# backend
cd respos-backend && dotnet restore && dotnet build && dotnet test
dotnet run --project src/Restaurant.Api      # http://localhost:5080, /swagger
# admin / landing
cd respos-admin && npm install && npm run lint && npm run typecheck && npm run test && npm run build
npm run dev                                   # http://localhost:5173
cd respos-landing && npm run dev              # http://localhost:5174
```

Dev Postgres: `localhost:5433`, db `respos`, user `respos`, password `respos_dev` (dev only).
Demo users (Development seed only, password `Demo123!`): `owner@demo.respos.uz`, `admin@`, `manager@`, `waiter@`, `cook@`, `cashier@`, `stock@` (same domain), platform admin `superadmin@respos.uz`.
