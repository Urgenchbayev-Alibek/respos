# HANDOFF — RestaurantOS (ResPOS)

Краткая передача проекта. Подробности: `README.md`, `STATUS.md`, `User-Todo.md`, `docs/`.

## Что это
Система управления рестораном (SaaS для Узбекистана): зал и столики, брони, меню, заказы, кухонный экран (KDS, realtime),
склад и рецептуры, закупки, платежи и кассовые смены, отчёты, аудит, супер-админ платформы. MVP по ТЗ
`docs/requirements/TECHNICAL_SPECIFICATION.md` (оригинал — `ТЗ_RestaurantOS_для_Claude_AI.md`).

## Структура
| Папка | Что |
|---|---|
| `respos-backend/` | .NET 8 API + SignalR, Clean Architecture, модульный монолит, EF Core + PostgreSQL |
| `respos-admin/` | React-приложение: админ-панель, официант, KDS, касса, склад, платформа |
| `respos-landing/` | Публичный сайт + форма заявки на демо |
| `respos-contracts/` | Контракт API (источник истины для фронта и бэка), решения v1.1, changelog |
| `docs/` | дизайн (`docs/design`, скриншоты), ERD, ADR (13), бизнес-правила, тест-план, деплой |
| `scripts/` | `check-file-length.mjs` (лимит 500 строк), `e2e/` (API-сценарий из ТЗ §16), `ui-smoke/` (Playwright) |
| `infra/docker/` | docker-compose: Postgres (5433) и API (профиль `full`, Production-режим) |

## Запуск (локально)
```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
cd respos-backend && dotnet run --project src/Restaurant.Api     # :5080, /swagger, миграции+демо-данные в Development
cd respos-admin && npm install && npm run dev                     # :5173
cd respos-landing && npm install && npm run dev                   # :5174
```
Демо-пользователи (только Development), пароль `Demo123!`: `owner@demo.respos.uz`, `admin@…`, `manager@…`,
`waiter@…`, `cook@…`, `cashier@…`, `stock@…`; платформа — `superadmin@respos.uz`.

## Проверено (фактически запускалось)
- Backend: `dotnet build` 0 предупреждений; `dotnet test` — 150 unit + 114 integration (Testcontainers PostgreSQL).
- Admin: lint, typecheck, 180 тестов, build. Landing: lint, typecheck, 27 тестов, build.
- `scripts/e2e`: полный сценарий ТЗ §16 через реальный API + SignalR — все шаги проходят (`docs/testing/E2E_RESULTS.md`).
- `scripts/ui-smoke`: 26 Playwright-тестов в реальном браузере против реального API (все роли, realtime KDS, оплата, склад).
- Docker-образ API собирается, стартует в Production, отказывается стартовать без секретов (fail-fast).
- Производительность (локально, dev): p95 API < 0.6 c, доставка события на KDS < 0.1 c «на прогретом» (цель ТЗ ≤ 2 c).

## Что НЕ сделано / требует вас — см. `User-Todo.md`
- Ответы на бизнес-вопросы Q1–Q14 (сейчас работают допущения по умолчанию).
- Реальные платёжные провайдеры (Payme/Click/Uzum) и фискализация — **не подключены** (ручная отметка «Демо»).
- Хостинг backend + PostgreSQL, Vercel, GitHub-репозиторий (CI готов в `.github/workflows/ci.yml`), email-провайдер.
- .NET 8 — поддержка заканчивается 10.11.2026 → рекомендован переход на .NET 10 LTS.
- Узбекские тексты — черновик, нужна вычитка. Юридические страницы лендинга — черновики.
- Место на диске C: (был заполнен — см. L5/L6).

## Как продолжать
Правила для агентов — `CLAUDE.md` (лимит 500 строк/файл, decimal для денег, tenant/branch scope, права на бэке,
SignalR только уведомляет). Новый модуль бэка — `respos-backend/README.md`, новая страница — `respos-admin/README.md`.
Любое изменение API — сначала `respos-contracts/` + `CHANGELOG.md`.
