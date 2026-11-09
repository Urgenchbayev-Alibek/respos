# RestaurantOS — API conventions (source of truth for backend + frontend)

All agents MUST follow this file. Changing it = changing the contract: record the change in
`respos-contracts/CHANGELOG.md` and tell the orchestrator.

## Base

- Base URL: `/api/v1` (dev: `http://localhost:5080/api/v1`). Swagger: `/swagger`. Health: `/health/live`, `/health/ready`.
- JSON, `camelCase`, enums serialized as **snake_case strings** (e.g. `"in_progress"`, `"dine_in"`).
- Dates: ISO 8601 UTC with `Z` (`2026-11-10T08:30:00Z`). Date-only values: `YYYY-MM-DD` (interpreted in branch timezone).
- Money: JSON **number** with max 2 decimals, backend type `decimal(18,2)`. Currency code lives on the organization (`UZS` default). Never float/double in C#.
- Quantities: `decimal(18,3)`.
- IDs: `Guid` (string in JSON).

## Request context headers

| Header | Meaning |
|---|---|
| `Authorization: Bearer <accessToken>` | JWT access token (15 min). Contains `sub` (userId), `org` (organizationId, absent for platform-only session), `platform_admin` (bool claim). Permissions are NOT trusted from the token for authorization decisions on sensitive ops — backend loads them (cached per request). |
| `X-Branch-Id: <guid>` | Current branch. Required for branch-scoped endpoints. Backend verifies `UserBranchAccess` (or Owner/Admin role covering all branches of the org). Missing/forbidden → 403 `tenant.branch_forbidden`. |
| `X-Correlation-Id` | Optional; generated if absent; echoed in response and logged. |
| `Idempotency-Key: <uuid>` | Required on `POST /payments`, `POST /payments/{id}/refunds`, `POST /orders/{id}/send-to-kitchen`, `POST /purchases/{id}/receive`. Same key + same user → same stored response (24h). |
| `Accept-Language: ru \| uz \| en` | Language for server messages (`ru` default). |

Clients NEVER send `organizationId` in bodies for scoping; the server takes it from the token. `branchId` comes only from `X-Branch-Id` (validated).

## Error format (RFC 7807 ProblemDetails + extensions)

```json
{
  "type": "https://respos.dev/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "code": "validation.failed",
  "detail": "One or more fields are invalid.",
  "correlationId": "c0ffee...",
  "errors": { "name": ["Name is required."] }
}
```

Status codes: 400 validation, 401 unauthenticated, 403 permission/tenant, 404 not found (also for other tenant's IDs — never leak existence), 409 conflict (`order.invalid_status_transition`, `reservation.time_conflict`, `payment.duplicate`, `stock.insufficient`), 422 business rule, 429 rate limit, 500 (no stack traces; only `code: "server.error"` + correlationId).

`code` values are dot-separated stable identifiers; frontend maps them to localized messages and falls back to `title`.

## Pagination / filtering / sorting

Query: `?page=1&pageSize=20&sort=createdAt:desc&search=...` + resource-specific filters. `pageSize` max 100.

```json
{ "items": [ ... ], "page": 1, "pageSize": 20, "totalCount": 135 }
```

Small reference lists (roles, permissions, stations, units, areas) return plain arrays.

## Auth flow (see ADR-0003)

- `POST /auth/login` `{ email, password, organizationId? }` → `200 { accessToken, expiresAt, user: MeDto }` + sets `refresh_token` cookie (httpOnly, Secure, SameSite=None in prod / Lax in dev, path `/api/v1/auth`).
  If the user belongs to several orgs and `organizationId` absent → token for the first active org; client can switch.
- `POST /auth/refresh` (cookie) → new access token, **rotates** refresh token; reuse of a revoked token revokes the whole family.
- `POST /auth/logout` → revokes refresh token, clears cookie.
- `POST /auth/switch-organization` `{ organizationId }` → new tokens.
- `GET /auth/me` → `MeDto`.
- `POST /auth/forgot-password` `{ email }` → always `202` (never reveals account existence). Email sending is a stub provider in MVP (logs "email would be sent", without the token in prod).
- `POST /auth/reset-password` `{ token, newPassword }`.
- `POST /auth/accept-invitation` `{ token, fullName, password }`.
- `POST /auth/change-password` `{ currentPassword, newPassword }`.
- Login rate limit: 5/min per IP+email → 429.
- Password policy: min 8 chars, at least 1 letter and 1 digit.

```ts
MeDto = {
  id, email, fullName, preferredLanguage: "ru"|"uz"|"en", isPlatformAdmin: boolean,
  currentOrganization: { id, name, currency, defaultLanguage } | null,
  organizations: { id, name }[],
  roles: string[],              // role codes in current org
  permissions: string[],        // effective permission codes in current org
  branches: { id, name, timezone }[]   // branches the user can access in current org
}
```

Frontend keeps the access token **in memory only** (never localStorage); on reload it calls `/auth/refresh`.

## Realtime (SignalR) — see REALTIME.md

## Money calculation (server-side only; frontend may preview but server result wins)

```
lineTotal      = (unitPrice + sum(modifier.priceDelta)) * quantity       (cancelled items excluded)
subtotal       = sum(lineTotal)
discountAmount = order discount (fixed amount or percent of subtotal), <= subtotal
serviceCharge  = round((subtotal - discountAmount) * branch.serviceChargePercent / 100, 2)
tax            = round((subtotal - discountAmount + serviceCharge) * branch.taxPercent / 100, 2)   // tax added on top, default 0%
total          = subtotal - discountAmount + serviceCharge + tax
paidAmount     = sum(completed payments) - sum(refunds)
```

Rounding: `MidpointRounding.AwayFromZero`, 2 decimals. Assumptions recorded in `User-Todo.md`.
