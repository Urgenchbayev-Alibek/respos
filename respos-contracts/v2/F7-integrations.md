# F7 — Integrations, notifications & online reservations

Status: implemented on branch `v2/f7-integrations`. All v1 conventions apply (camelCase JSON, snake_case enums,
ProblemDetails, `integrations.manage` from the existing catalog — no new permissions).

## Data model (new tables)

| Table | Entity | Notes |
|---|---|---|
| `integration_settings` | `IntegrationSetting` (tenant-scoped, auditable) | unique `(organization_id, type)`; `type` = `telegram \| sms_eskiz \| smtp`; `is_enabled`; `protected_config` (whole config JSON encrypted with ASP.NET Core Data Protection, purpose `RestaurantOS.Integrations.v1`); `last_success_at`, `last_error_at`, `last_error` |
| `outbound_messages` | `OutboundMessage` (no tenant filter — platform e-mails have no org; queries filter `organization_id` explicitly) | `channel` = `telegram \| sms \| email`; `kind`; `recipient_masked`; `summary` (secret-free); `protected_payload` (encrypted recipient + body; **cleared** once sent/failed/skipped); `dedupe_key` (unique when not null); `status` = `pending \| sent \| failed \| skipped`; `attempts`, `max_attempts` (5), `next_attempt_at`, `last_error`, `created_at`, `sent_at`; FK org → cascade |
| `integration_error_logs` | `IntegrationErrorLog` | `organization_id?`, `integration_type?`, `channel?`, `operation` (= message kind), `message` (≤1000, secrets scrubbed), `outbound_message_id?`, `created_at` |
| `data_protection_keys` | Data Protection key ring (`id` identity, `friendly_name`, `xml`, `created_at`) | read/written by `PostgresXmlRepository` (Npgsql, sync API required by `IXmlRepository`) |

Domain events added (`Domain/Events/IntegrationDomainEvents.cs`): `PaymentRefundedDomainEvent` (raised in
`Payment.AddRefund`), `CashShiftClosedDomainEvent` (`CashShift.Close`), `ReservationConfirmedDomainEvent`
(`TableReservation.Confirm`). `EmailMessage` got an optional `HtmlBody`.

No migration is committed (temporary `Tmp_F7` was used for tests) — the orchestrator generates the real one.

## Secrets & key persistence

- Secrets never leave the server: responses mask secret fields as `****` + last 4 chars (only for secrets ≥ 8 chars,
  shorter → `****`). Audit `integration.updated` stores only `{ type, isEnabled, wasEnabled, changedFields: [names] }`.
- On update a secret sent **empty or masked** keeps the stored value; any other value replaces it.
- Key ring: PostgreSQL table `data_protection_keys` by default (all instances share it, survives restarts). Alternative:
  `DataProtection__KeysPath=/keys` (mounted volume) → file system. **Prod:** losing the key ring makes stored secrets
  undecryptable (integrations then show «Не подключено» until secrets are re-entered). For defense in depth, keys
  in the DB are not encrypted at rest — restrict DB backups access or switch to a mounted key path protected by the host.
- Provider HTTP clients have default HttpClient logging removed (the Telegram token is part of the URL).

## Endpoints

### Organization integrations — `[integrations.manage]`, org-level (no `X-Branch-Id`)

- `GET /integrations` → `IntegrationDto[]` (always 3 items: telegram, sms_eskiz, smtp; defaults when never saved)
- `PUT /integrations/{type}` `{ isEnabled, config }` → `IntegrationDto`. Unknown type → 404 `integration.not_found`.
  Invalid/incomplete config of an enabled integration → 400 `validation.failed` with `errors["config.<field>"]`.
- `POST /integrations/{type}/test` `{ recipient? }` → `IntegrationTestResultDto` — synchronous send with the **saved**
  config (Telegram → every chat id; `sms_eskiz` → `recipient` phone (UZ), text «Это тест от Eskiz» so Eskiz test
  accounts accept it; `smtp` → `recipient` e-mail). Recorded in the outbound log (kind `test`); failures in the error log.
  Not enabled / not configured → 422 `integration.not_configured`; bad recipient → 400 `validation.failed` (`errors.recipient`).
- `GET /integrations/outbound-messages` P filters `status`, `channel` → `OutboundMessageDto` (newest first)
- `GET /integrations/errors` P filter `type` → `IntegrationErrorDto` (own organization only)

```ts
IntegrationDto = { type: 'telegram'|'sms_eskiz'|'smtp', isEnabled, status: 'not_configured'|'connected'|'error',
  isConfigured, config: TelegramConfig|EskizConfig|SmtpConfig /* secrets masked */, lastSuccessAt, lastErrorAt, lastError, updatedAt }
TelegramConfig = { botToken (secret), chatIds: string[] (≤10), dailySummaryEnabled, dailySummaryTime: 'HH:mm' (branch-local),
  lowStockEnabled, bigRefundEnabled, bigRefundThreshold: number, onlineReservationEnabled, shiftDifferenceEnabled }
EskizConfig = { email, password (secret), from ('4546'), reservationConfirmationEnabled }
SmtpConfig = { host, port (587), useSsl (true = implicit TLS/465, false = STARTTLS when offered), username, password (secret), fromEmail, fromName }
IntegrationTestResultDto = { success, error: string|null, integration: IntegrationDto }
OutboundMessageDto = { id, channel, kind, recipientMasked, summary, status, attempts, maxAttempts, nextAttemptAt, lastError, createdAt, sentAt, branchId }
IntegrationErrorDto = { id, organizationId, organizationName /* platform only */, integrationType, channel, operation, message, outboundMessageId, createdAt }
```
`status`: `not_configured` when disabled or incomplete; `error` when the last error is newer than the last success; else `connected`.

### Platform — `[platform.system.read]`, `[PlatformScope]`

- `GET /platform/integration-errors` P filters `organizationId`, `type` → `IntegrationErrorDto` with `organizationName`.

### Reservations (B)

- `GET /reservations/availability` [reservations.read] `?date=YYYY-MM-DD&guests=1&durationMinutes?&slotMinutes?` →
  `{ date, timezone, guests, durationMinutes, slots: { time: 'HH:mm', startsAt, endsAt, freeTables: { id, number, capacity, areaId, areaName }[] }[] }`.
  Free = active, non-archived, not `unavailable` table with `capacity ≥ guests` and no **pending/confirmed/seated** reservation
  overlapping `[startsAt, endsAt)` (half-open, BR-5.2). Slots before "now" have no free tables.

### Public online reservations (anonymous) — keyed by the **branch slug**

Same public slug as the QR menu (F3 `Branch.Slug`, case-insensitive). The earlier id-keyed routes were removed at merge
(a GUID in the path → 404 `branch.not_found`); the response carries `branchSlug` instead of `branchId`.

- `GET /public/branches/{branchSlug}/availability?date=&guests=` (rate limit `RateLimiting:PublicAvailabilityPerMinute`, 60/min per IP+slug) →
  `{ branchSlug, branchName, date, timezone, durationMinutes, maxGuests, slots: { time, startsAt, available }[] }` (no table data).
- `POST /public/branches/{branchSlug}/reservations` (rate limit `RateLimiting:PublicReservationsPerHour`, 10/hour per IP+slug → 429 `rate_limit.exceeded`)
  `{ date: 'YYYY-MM-DD', time: 'HH:mm' (branch-local), guests, name, phone, comment?, website /* honeypot */ }` → **201**
  `{ reservationId, status: 'pending', startsAt, endsAt, guests, branchName }`.
  Creates a `pending` reservation on the smallest free table that fits (per-branch advisory lock), notifies branch users
  with `reservations.read` (in-app, type `system`, link `/admin/reservations`) and queues the Telegram `online_reservation` alert.
  Honeypot filled → identical 201 answer, nothing stored. Phone: E.164 or 9 local digits (normalized to `+998…`).
- Errors: 404 `branch.not_found` (unknown/inactive branch or suspended org), 400 `validation.failed`,
  400 `reservation.invalid_date` (past or > `MaxDaysAhead`), 400 `reservation.invalid_time` (outside hours / off-grid / < lead time),
  422 `reservation.too_many_guests` (> `MaxOnlineGuests`), 409 `reservation.slot_unavailable`.
- Booking hours (same for all branches until per-branch hours exist), section `Reservations:Availability`:
  `OpenTime` 10:00, `LastSlotTime` 22:00, `SlotMinutes` 30, `DurationMinutes` 120, `MinLeadMinutes` 60, `MaxDaysAhead` 60, `MaxOnlineGuests` 20.

## Notifications & delivery

- Telegram alerts (queued in the same unit of work as the business change — rolled-back operations never alert):
  `daily_summary` (background job every 60 s; per branch at `dailySummaryTime` in the **branch timezone**; idempotent per
  branch + local day via `dedupe_key = {org}:daily_summary:{branch}:{date}:{chatId}`), `low_stock` (on `StockLowDomainEvent`),
  `big_refund` (amount ≥ `bigRefundThreshold`), `online_reservation`, `shift_difference` (closed shift with difference ≠ 0).
- SMS `reservation_confirmed` to the guest on `POST /reservations/{id}/confirm` when Eskiz is enabled and
  `reservationConfirmationEnabled` (UZ numbers only); disabled/not configured → no-op (`AlertStatus.Disabled/NotConfigured`).
- E-mail (invitations, password reset; RU+UZ templates, preferred language first): route = organization SMTP (enabled) →
  platform SMTP `Integrations:Smtp:*` (env only, e.g. `Integrations__Smtp__Host`, `…__Password`) → log-only stub (v1 behaviour).
  Password reset has no tenant → platform SMTP or log. SMTP e-mails are queued (encrypted payload).
- Dispatcher (`Integrations:DispatcherIntervalSeconds` 10, batch 20): claims each due row with a conditional update
  (5-min lease, safe with several instances), sends, retries retryable failures (429/5xx/timeouts/network) with backoff
  30 s·2ⁿ⁻¹ (or the provider's `retry_after` if longer) up to 5 attempts; each failed attempt → `integration_error_logs` +
  `last_error` on the setting. In-request HTTP retry: 3 attempts, 0.5 s/1 s backoff, server waits ≤ 10 s honoured inline.
  Finished rows and error logs older than `Integrations:RetentionDays` (30) are purged hourly.
- Config: `Integrations:BackgroundEnabled` (true; tests set false), `TelegramBaseUrl`, `EskizBaseUrl`, `HttpTimeoutSeconds` (10).

## Error codes (new)

`integration.not_found`, `integration.not_configured`, `reservation.invalid_date`, `reservation.invalid_time`,
`reservation.too_many_guests`, `reservation.slot_unavailable`.

## Frontend

- Admin: `/admin/integrations` (cards per integration: status «Не подключено» / «Подключено» / «Ошибка», form with masked
  secrets, «Отправить тест»), `/admin/integrations/outbound` (delivery log + error log); entry link on `/admin/settings`
  (sidebar unchanged — `ADMIN_NAV` length test). Platform: `/platform/integration-errors` (nav item added). i18n namespace `integrations`.
- Landing: `/booking` «Забронировать стол» (date, guests, slots from availability, name, phone, comment, honeypot, success
  state); branch slug from `VITE_PUBLIC_BRANCH_SLUG` (default `demo`) — when set empty the page shows «Онлайн-бронирование пока не подключено».
