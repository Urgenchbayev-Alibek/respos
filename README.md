# RestaurantOS (ResPOS)

Система управления рестораном для Узбекистана, с заделом под SaaS: зал и столики, бронирования, меню, заказы,
кухонный экран (KDS), склад и рецептуры, закупки, платежи и кассовые смены, отчёты, сотрудники и роли,
аудит. Платформенная супер-админка управляет организациями и тарифами.

- Валюта по умолчанию — UZS, часовой пояс — `Asia/Tashkent`. Языки: русский и узбекский (латиница); английский пока заготовка.
- Статус: MVP в разработке (см. `STATUS.md`). Оплата в MVP — только ручная или демо-отметка. Пречек не является фискальным чеком.

## Структура репозитория

| Папка | Назначение | В ТЗ (§15) называется |
|---|---|---|
| `respos-backend/` | ASP.NET Core API + SignalR, модульный монолит, Clean Architecture (`src/Restaurant.Api`, `.Application`, `.Domain`, `.Infrastructure`, `tests/`) | `backend/` |
| `respos-admin/` | Одно React-приложение с рабочими местами: Admin Panel, Waiter, KDS, Cashier, Stock, Platform Super Admin | `frontend/` |
| `respos-landing/` | Публичный сайт и форма заявки на демо | часть §2.3 |
| `respos-contracts/` | Контракт API и доменная модель (CONVENTIONS, PERMISSIONS, DOMAIN_MODEL, ENDPOINTS, REALTIME). Обязателен для всех | — |
| `docs/` | Требования, архитектура и ADR, дизайн, ERD, тесты, деплой | `docs/` |
| `infra/docker/` | docker-compose (PostgreSQL, API) | `infra/docker/` |
| `scripts/` | Скрипты разработчика и CI (`dev-up`, `check-file-length`) | `scripts/` |
| `.github/workflows/` | CI (GitHub Actions) | `.github/workflows/` |

## Стек

- **Backend:** .NET 8 LTS, ASP.NET Core Web API, EF Core 8 + Npgsql, PostgreSQL 16, SignalR, FluentValidation, Serilog, Swagger, xUnit, Testcontainers. Поддержка .NET 8 заканчивается 2026-11-10, план перехода на .NET 10 LTS описан в [ADR-0009](docs/architecture/ADR/0009-dotnet-8-upgrade-to-10.md).
- **Frontend:** React 18, TypeScript, Vite, React Router, TanStack Query, React Hook Form + Zod, i18next, @microsoft/signalr, Vitest + React Testing Library.
- **DevOps:** Docker Compose, GitHub Actions, Vercel для фронтендов; backend и PostgreSQL размещаются на отдельном хостинге.

## Что нужно установить

- .NET SDK 8.0.x
- Node.js 22 LTS (npm)
- Docker Desktop или Docker Engine с Compose v2
- Git

## Быстрый старт

```bash
# 1. Переменные окружения
cp .env.example .env            # задайте Jwt__SigningKey (не короче 32 символов); .env не коммитить

# 2. PostgreSQL (localhost:5433)
./scripts/dev-up.sh             # или: pwsh ./scripts/dev-up.ps1

# 3. Backend → http://localhost:5080/swagger
cd respos-backend && dotnet restore && dotnet run --project src/Restaurant.Api

# 4. Admin → http://localhost:5173
cd respos-admin && npm install && npm run dev

# 5. Landing → http://localhost:5174
cd respos-landing && npm install && npm run dev
```

Демо-пользователи создаются только в Development seed: `owner@`, `admin@`, `manager@`, `waiter@`, `cook@`, `cashier@` и `stock@demo.respos.uz`, а также `superadmin@respos.uz`. Пароль задаётся в `Seed__DemoPassword` (см. `CLAUDE.md`). Демо-данные помечены флагом `Organization.IsDemo`.

## Переменные окружения

Полный список — в [`.env.example`](.env.example). Основные:

| Переменная | Где используется | Комментарий |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | backend | Строка подключения к PostgreSQL |
| `Jwt__Issuer`, `Jwt__Audience`, `Jwt__SigningKey` | backend | Ключ — секрет, не короче 32 байт, свой для каждого окружения |
| `Frontend__AllowedOrigins` | backend | CORS allowlist, домены через запятую |
| `FileStorage__Provider` | backend | `Local` в MVP |
| `Seed__DemoData`, `Seed__DemoPassword` | backend | Только для Development и staging |
| `VITE_API_BASE_URL`, `VITE_HUB_URL` | admin, landing | Видны в браузере, секреты сюда класть нельзя |

## Миграции БД

```bash
cd respos-backend
dotnet ef migrations add <ПонятноеИмя> --project src/Restaurant.Infrastructure --startup-project src/Restaurant.Api
dotnet ef database update --project src/Restaurant.Infrastructure --startup-project src/Restaurant.Api
```

Процедура для production (сначала бэкап, затем идемпотентный скрипт) описана в [DEPLOYMENT.md §5](docs/deployment/DEPLOYMENT.md).

## Проверки и тесты

```bash
cd respos-backend && dotnet build && dotnet test          # для интеграционных тестов нужен запущенный Docker (Testcontainers)
cd respos-admin   && npm run lint && npm run typecheck && npm run test && npm run build
cd respos-landing && npm run lint && npm run typecheck && npm run test && npm run build
node scripts/check-file-length.mjs                         # правило: файл не длиннее 500 строк
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) запускает всё это на каждый PR. План тестирования — [TEST_PLAN.md](docs/testing/TEST_PLAN.md).

## Деплой

`respos-admin` и `respos-landing` разворачиваются на Vercel как два проекта с разными Root Directory. Backend и PostgreSQL — на отдельной платформе, она пока не выбрана (User-Todo T3). Бесплатный production-хостинг не обещается. Подробности — в [DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md).

## Документация

- **Требования:** [ТЗ](docs/requirements/TECHNICAL_SPECIFICATION.md) · [Бизнес-правила](docs/requirements/BUSINESS_RULES.md) · [Глоссарий RU/UZ/EN](docs/requirements/GLOSSARY.md)
- **Контракт:** [CONVENTIONS](respos-contracts/CONVENTIONS.md) · [PERMISSIONS](respos-contracts/PERMISSIONS.md) · [DOMAIN_MODEL](respos-contracts/DOMAIN_MODEL.md) · [ENDPOINTS](respos-contracts/ENDPOINTS.md) · [REALTIME](respos-contracts/REALTIME.md)
- **Архитектура:** [Обзор системы](docs/architecture/SYSTEM_OVERVIEW.md) · [ADR](docs/architecture/ADR/README.md)
- **База данных:** [ERD](docs/database/ERD.md) · [ERD: склад, платежи, аудит](docs/database/ERD_INVENTORY_PAYMENTS.md) · [Ограничения и индексы](docs/database/ERD_CONSTRAINTS.md)
- **Дизайн («RestaurantOS — Product Design»):** [Brief](docs/design/DESIGN_BRIEF.md) · [Design system](docs/design/DESIGN_SYSTEM.md) · [User flows](docs/design/USER_FLOWS.md) · [Экраны](docs/design/SCREEN_INVENTORY.md) · [Responsive](docs/design/RESPONSIVE_RULES.md) · [Доступность](docs/design/ACCESSIBILITY.md) · [HTML-макеты](docs/design/assets/index.html)
- **Тесты и деплой:** [TEST_PLAN](docs/testing/TEST_PLAN.md) · [DEPLOYMENT](docs/deployment/DEPLOYMENT.md)
- **Процесс:** [CONTRIBUTING](CONTRIBUTING.md) · [Открытые вопросы и решения владельца — User-Todo.md](User-Todo.md) · [STATUS.md](STATUS.md) · [Правила для агентов — CLAUDE.md](CLAUDE.md)

## Юридическое

ТЗ не является юридическим заключением. До коммерческого запуска нужна консультация местного специалиста по персональным данным (включая локализацию данных граждан РУз), платежам, фискализации и договорам (User-Todo, раздел C).
