# RestaurantOS (ResPOS)

Система управления рестораном для Узбекистана, с заделом под SaaS: зал и столики, бронирования, меню, заказы,
кухонный экран (KDS), склад и рецептуры, закупки, платежи и кассовые смены, отчёты, сотрудники и роли,
аудит. Платформенная супер-админка управляет организациями и тарифами.

- Валюта по умолчанию — UZS, часовой пояс — `Asia/Tashkent`. Языки UI: русский и узбекский (латиница; тексты UZ — черновик, нужна вычитка); английский — заготовка.
- Статус: **MVP реализован** (backend, admin-приложение, лендинг), идёт стабилизация — см. `STATUS.md` и таблицу ниже.
  Оплата — только ручная/демо-отметка. Пречек не является фискальным чеком.

## Структура репозитория

| Папка | Назначение | В ТЗ (§15) называется |
|---|---|---|
| `respos-backend/` | ASP.NET Core API + SignalR, модульный монолит, Clean Architecture (`src/Restaurant.Api`, `.Application`, `.Domain`, `.Infrastructure`, `tests/`); руководство — [respos-backend/README.md](respos-backend/README.md) | `backend/` |
| `respos-admin/` | Одно React-приложение с рабочими местами: Admin Panel, Waiter, KDS, Cashier, Stock, Platform Super Admin | `frontend/` |
| `respos-landing/` | Публичный сайт и форма заявки на демо | часть §2.3 |
| `respos-contracts/` | Контракт API и доменная модель (CONVENTIONS, PERMISSIONS, DOMAIN_MODEL, ENDPOINTS v1.2, REALTIME, DECISIONS_v1_1, CHANGELOG). Обязателен для всех | — |
| `docs/` | Требования, архитектура и ADR, дизайн, ERD, тесты, деплой | `docs/` |
| `infra/docker/` | docker-compose (PostgreSQL; API — профиль `full`) | `infra/docker/` |
| `scripts/` | `dev-up`, `check-file-length.mjs`, `e2e/` (API E2E smoke), `ui-smoke/` (Playwright) | `scripts/` |
| `.github/workflows/` | CI (GitHub Actions) | `.github/workflows/` |

## Стек

- **Backend:** .NET 8 LTS, ASP.NET Core Web API, EF Core 8 + Npgsql (snake_case), PostgreSQL 16, SignalR, FluentValidation, Serilog, Swagger, xUnit, Testcontainers. Без MediatR (ADR-0011). Поддержка .NET 8 заканчивается 2026-11-10 — план перехода на .NET 10 LTS: [ADR-0009](docs/architecture/ADR/0009-dotnet-8-upgrade-to-10.md), User-Todo T1.
- **Frontend:** React 18, TypeScript, Vite, React Router, TanStack Query, React Hook Form + Zod, i18next, @microsoft/signalr, Vitest + React Testing Library.
- **DevOps:** Docker Compose, GitHub Actions, Vercel для фронтендов; backend и PostgreSQL — на отдельном хостинге (не выбран, User-Todo T3).

## Что нужно установить

- .NET SDK 8.0.x
- Node.js 22 LTS (npm)
- Docker Desktop или Docker Engine с Compose v2 (нужен и для интеграционных тестов)
- Git

## Быстрый старт (Development)

```bash
# 1. PostgreSQL 16 в Docker → localhost:5433 (db/user respos, пароль respos_dev — только dev)
docker compose -f infra/docker/docker-compose.yml up -d postgres     # или ./scripts/dev-up.sh / pwsh ./scripts/dev-up.ps1

# 2. API → http://localhost:5080 (Swagger: /swagger)
cd respos-backend && dotnet run --project src/Restaurant.Api
#    В Development настройки берутся из appsettings.Development.json: миграции применяются при старте
#    (Database:MigrateOnStartup), создаётся демо-организация (Seed:DemoData). .env не нужен.

# 3. Admin → http://localhost:5173
cd respos-admin && npm install && npm run dev

# 4. Landing → http://localhost:5174
cd respos-landing && npm install && npm run dev
```

`.env.example` (корень, `respos-admin/`, `respos-landing/`) — образцы переменных; для фронтендов значения по умолчанию
уже указывают на `http://localhost:5080`.

### Демо-аккаунты (только Development)

Пароль у всех: `Demo123!` (`Seed:DemoPassword`). Демо-организация помечена `Organization.IsDemo` («Демо-данные» в UI).

| Логин | Роль |
|---|---|
| `owner@demo.respos.uz` | владелец |
| `admin@demo.respos.uz` | администратор |
| `manager@demo.respos.uz` | менеджер |
| `waiter@demo.respos.uz` | официант |
| `cook@demo.respos.uz` | повар (KDS) |
| `cashier@demo.respos.uz` | кассир |
| `stock@demo.respos.uz` | кладовщик |
| `accountant@demo.respos.uz` | бухгалтер |
| `superadmin@respos.uz` | Platform Super Admin (вне Development создаётся только при заданном `Seed__PlatformAdminPassword`) |

Демо-данные вне Development не создаются, даже если `Seed:DemoData=true`.

## Статус функций MVP

| Модуль | Статус | Комментарий |
|---|---|---|
| Вход, refresh-cookie, сброс пароля, приглашения | ✅ реализовано | email — заглушка: письмо пишется в лог, ссылка-приглашение показывается админу (T6) |
| Пользователи, роли, права (RBAC), филиалы, настройки | ✅ реализовано | лимиты тарифа (филиалы, пользователи) |
| Зал, столы, зоны | ✅ реализовано | |
| Бронирования | 🟡 частично | CRUD, пересечения, seat/complete/no-show; `/reservations/availability` и `GET /reservations/{id}` не реализованы; статус стола `reserved` не ставится автоматически |
| Меню (категории, блюда, варианты, модификаторы, расписание, фото) | ✅ реализовано | станция и стоп-лист — на уровне организации (L3) |
| Заказы (dine-in, takeaway), скидки, перенос | ✅ реализовано | доставки нет (Q1); разделения счёта по позициям нет (Q13) |
| Кухня (KDS) + realtime | ✅ реализовано | кухонных принтеров нет (Q9) |
| Платежи, частичная оплата, возвраты, кассовые смены | 🟡 частично | только `ManualPaymentProvider` («Демо»); **Payme/Click/Uzum не подключены** (Q5) |
| Фискализация / онлайн-ККМ | ❌ не реализовано | пречек «Не является фискальным чеком» (Q6) |
| Склад, рецептуры, списание при оплате, инвентаризация | ✅ реализовано | продажа может увести остаток в минус (Q8) |
| Поставщики и закупки | ✅ реализовано | |
| Отчёты, дашборд, экспорт | ✅ реализовано | экспорт только CSV |
| Уведомления, аудит | ✅ реализовано | in-app + SignalR; SMS/Telegram нет |
| Платформа (организации, тарифы, feature flags, заявки, break-glass) | ✅ реализовано | биллинга/онлайн-оплаты подписки нет |
| Лендинг + заявка на демо | ✅ реализовано | юридические страницы — черновик |
| Офлайн-режим | ❌ не реализовано | вне MVP (Q10) |
| Локализация | 🟡 частично | RU полный; UZ — черновой (Q11); EN — заготовка |
| Production-деплой | ❌ не выполнен | хостинг не выбран (T3), Vercel не подключён (T4) |

## Проверки и тесты

```bash
cd respos-backend && dotnet build && dotnet test      # 150 unit + 98 integration; интеграционным нужен Docker (Testcontainers)
cd respos-admin   && npm run lint && npm run typecheck && npm run test && npm run build   # ~164 теста (Vitest)
cd respos-landing && npm run lint && npm run typecheck && npm run test && npm run build   # 27 тестов
node scripts/check-file-length.mjs                     # правило: файл не длиннее 500 строк
```

**E2E (API + SignalR, без моков)** — против запущенного API с демо-seed:

```bash
cd scripts/e2e && npm install && node e2e-smoke.mjs   # E2E_API_URL, по умолчанию http://localhost:5080/api/v1
```

Сценарий, результаты и замеры производительности — [docs/testing/E2E_RESULTS.md](docs/testing/E2E_RESULTS.md).
Не запускайте чаще ~4 раз в минуту (лимит входа 5/мин). Браузерный smoke (Playwright) — `scripts/ui-smoke` (`npm run smoke`).

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): правило 500 строк, backend build/test, admin и landing lint/typecheck/test/build.
План тестирования — [TEST_PLAN.md](docs/testing/TEST_PLAN.md).

## Миграции БД

```bash
cd respos-backend
dotnet tool restore                                    # локальный dotnet-ef 8.0.11 (.config/dotnet-tools.json)
dotnet ef migrations add <Module>_<Change> -p src/Restaurant.Infrastructure -s src/Restaurant.Api -o Persistence/Migrations
dotnet ef database update -p src/Restaurant.Infrastructure -s src/Restaurant.Api
```

Design-time подключение — `RESPOS_DESIGN_CONNECTION` (по умолчанию локальная dev-БД на 5433). Production-процедура
(бэкап → идемпотентный скрипт или bundle) — [DEPLOYMENT.md §5](docs/deployment/DEPLOYMENT.md).

## Деплой

`respos-admin` и `respos-landing` — два Vercel-проекта с разными Root Directory. Backend (`respos-backend/Dockerfile`,
порт 8080) и PostgreSQL — на отдельной платформе (User-Todo T3). Бесплатный production-хостинг не обещается.
Переменные окружения и процедура — [DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md).

## Документация

- **Требования:** [ТЗ](docs/requirements/TECHNICAL_SPECIFICATION.md) · [Бизнес-правила](docs/requirements/BUSINESS_RULES.md) · [Глоссарий RU/UZ/EN](docs/requirements/GLOSSARY.md)
- **Контракт:** [CONVENTIONS](respos-contracts/CONVENTIONS.md) · [PERMISSIONS](respos-contracts/PERMISSIONS.md) · [DOMAIN_MODEL](respos-contracts/DOMAIN_MODEL.md) · [ENDPOINTS](respos-contracts/ENDPOINTS.md) · [REALTIME](respos-contracts/REALTIME.md) · [DECISIONS v1.1](respos-contracts/DECISIONS_v1_1.md) · [CHANGELOG](respos-contracts/CHANGELOG.md)
- **Архитектура:** [Обзор системы](docs/architecture/SYSTEM_OVERVIEW.md) · [ADR](docs/architecture/ADR/README.md) · [Backend README](respos-backend/README.md)
- **База данных:** [ERD](docs/database/ERD.md) · [ERD: склад, платежи, аудит](docs/database/ERD_INVENTORY_PAYMENTS.md) · [Ограничения и индексы](docs/database/ERD_CONSTRAINTS.md)
- **Дизайн («RestaurantOS — Product Design»):** [Brief](docs/design/DESIGN_BRIEF.md) · [Design system](docs/design/DESIGN_SYSTEM.md) · [User flows](docs/design/USER_FLOWS.md) · [Экраны](docs/design/SCREEN_INVENTORY.md) · [Responsive](docs/design/RESPONSIVE_RULES.md) · [Доступность](docs/design/ACCESSIBILITY.md) · [HTML-макеты](docs/design/assets/index.html)
- **Тесты и деплой:** [TEST_PLAN](docs/testing/TEST_PLAN.md) · [E2E_RESULTS](docs/testing/E2E_RESULTS.md) · [DEPLOYMENT](docs/deployment/DEPLOYMENT.md)
- **Процесс:** [CONTRIBUTING](CONTRIBUTING.md) · [Открытые вопросы и решения владельца — User-Todo.md](User-Todo.md) · [STATUS.md](STATUS.md) · [Правила для агентов — CLAUDE.md](CLAUDE.md)

## Юридическое

ТЗ не является юридическим заключением. До коммерческого запуска нужна консультация местного специалиста по персональным данным (включая локализацию данных граждан РУз), платежам, фискализации и договорам (User-Todo, раздел C).
