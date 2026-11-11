# RestaurantOS (ResPOS)

Система управления рестораном для Узбекистана, с заделом под SaaS: зал и столики, бронирования, меню, заказы,
кухонный экран (KDS), склад и рецептуры, закупки, платежи и кассовые смены, отчёты, сотрудники и роли,
аудит. Платформенная супер-админка управляет организациями и тарифами.

- Валюта по умолчанию — UZS, часовой пояс — `Asia/Tashkent`. Языки UI: русский и узбекский (латиница; тексты UZ — черновик, нужна вычитка); английский — заготовка.
- Статус: **MVP + расширение v2 реализованы** (backend, admin-приложение, лендинг) и проверены на демо-данных — см. `STATUS.md` и таблицу ниже.
  Оплата — ручная отметка кассиром; Payme/Click/Telegram/SMS/SMTP написаны, но **не подключены** (нужны реквизиты). Пречек не является фискальным чеком.

## Структура репозитория

| Папка | Назначение | В ТЗ (§15) называется |
|---|---|---|
| `respos-backend/` | ASP.NET Core API + SignalR, модульный монолит, Clean Architecture (`src/Restaurant.Api`, `.Application`, `.Domain`, `.Infrastructure`, `tests/`); руководство — [respos-backend/README.md](respos-backend/README.md) | `backend/` |
| `respos-admin/` | Одно React-приложение с рабочими местами: Admin Panel, Waiter, KDS, Cashier, Stock, Platform Super Admin | `frontend/` |
| `respos-landing/` | Публичный сайт и форма заявки на демо | часть §2.3 |
| `respos-desktop/` | Программа для Windows (Electron): то же `respos-admin` в окне, тихая печать чеков, киоск, автозапуск; установщик и portable-exe — [respos-desktop/README.md](respos-desktop/README.md), [ADR-0016](docs/architecture/ADR/0016-desktop-electron-loopback-gateway.md) | — |
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

| Логин | Роль | Рабочее место после входа | Демо-PIN (общий планшет) |
|---|---|---|---|
| `owner@demo.respos.uz` | владелец | Админ-панель `/admin` (все филиалы) | — (владельцу PIN запрещён) |
| `admin@demo.respos.uz` | администратор | Админ-панель `/admin` (все филиалы) | — (запрещён) |
| `manager@demo.respos.uz` | менеджер | Админ-панель `/admin` (оба демо-филиала) | не задан |
| `waiter@demo.respos.uz` | официант | Официант `/waiter` | `2580` |
| `cook@demo.respos.uz` | повар | Кухня (KDS) `/kitchen` | `1470` |
| `cashier@demo.respos.uz` | кассир | Касса `/cashier` | `3690` |
| `stock@demo.respos.uz` | кладовщик | Склад `/stock` (оба демо-филиала) | не задан |
| `accountant@demo.respos.uz` | бухгалтер | Админ-панель `/admin` (только чтение отчётов, платежей, аудита) | не задан |
| `superadmin@respos.uz` | Platform Super Admin | Платформа `/platform` (вне Development создаётся только при заданном `Seed__PlatformAdminPassword`) | — |

**Вход по PIN:** менеджер открывает «Персонал → Общие устройства → Сделать это устройство общим» — браузер становится общим планшетом
и показывает экран `/device`, где сотрудник выбирает себя и вводит PIN. Демо-PIN создаются только в Development (`DemoPinSeeder`).
Второй демо-филиал «Ташкент — Чиланзар» (свои цены на 2 блюда, остатки ниже минимума) — для проверки меню по филиалам, перемещений и предложений закупок.
Публичные страницы демо-филиала: QR-меню `http://localhost:5174/menu/demo`, онлайн-бронь `http://localhost:5174/booking`.

Демо-данные вне Development не создаются, даже если `Seed:DemoData=true`.

## Статус функций (MVP + v2)

Легенда: ✅ реализовано и проверено тестами/E2E на демо-данных · 🟡 частично · 🔌 код готов, но внешний сервис **не подключён**
(нужны ваши реквизиты, см. `User-Todo.md` раздел E) · ❌ не реализовано.

| Модуль | Статус | Комментарий |
|---|---|---|
| Вход, refresh-cookie, сброс пароля, приглашения | ✅ | письма: SMTP организации → SMTP платформы → запись в лог (пока SMTP не задан — как в MVP) |
| Пользователи, роли, права (RBAC), филиалы, настройки | ✅ | лимиты тарифа (филиалы, пользователи); права v2 в каталоге и редакторе ролей |
| Зал, столы, зоны | ✅ | QR-коды столов (лист A4 для печати) |
| Бронирования | ✅ | CRUD, пересечения, seat/complete/no-show, `/reservations/availability`; отдельного `GET /reservations/{id}` нет; статус стола `reserved` не ставится автоматически |
| Онлайн-бронирование с лендинга (v2/F7) | ✅ | `/booking` → заявка `pending` по slug филиала; лимит запросов, honeypot; часы приёма общие для всех филиалов |
| Меню (категории, блюда, варианты, модификаторы, расписание, фото) | ✅ | |
| Меню по филиалам (v2/F4) | ✅ | цена, стоп-лист и станция кухни на филиал; действует в POS, заказах, QR-меню и фудкосте |
| Заказы (в зале, навынос), скидки, перенос | ✅ | |
| Разделение счёта и чаевые (v2/F2) | ✅ | поровну / по позициям / по суммам; чаевые не входят в выручку, видны в смене и отчётах |
| Доставка (v2/F3) | ✅ | доска доставки, курьеры, статусы, стоимость доставки на филиал; приёма онлайн-заказов с сайта нет |
| QR-меню для гостей и «позвать официанта» (v2/F3) | ✅ | публичная страница лендинга `/menu/{slug}`; вызов приходит официантам в реальном времени |
| Гости (CRM) и лояльность (v2/F1) | ✅ | карточка гостя, сегменты, бонусы (начисление/списание/возврат); программа по умолчанию выключена |
| Кухня (KDS) + realtime | ✅ | кухонных принтеров нет (Q9); печать тикета через браузер (80 мм) |
| Платежи (ручная отметка), частичная оплата, возвраты, кассовые смены | ✅ | наличные/карта отмечаются кассиром вручную («Демо») |
| Онлайн-оплата Payme, Click (v2/F2) | 🔌 не подключено | адаптеры и webhook-и написаны по публичным API и покрыты тестами, **с реальными Payme/Click не проверялись**; нужны реквизиты мерчанта |
| Онлайн-оплата Uzum (v2/F2) | ❌ заготовка | адаптер-скелет, всегда «Не подключено» (нет официальной документации) |
| Фискализация / онлайн-ККМ | ❌ не подключена | пречек «Не является фискальным чеком» (Q6) |
| Склад, рецептуры, списание при оплате, инвентаризация | ✅ | продажа может увести остаток в минус (Q8) |
| Перемещения между филиалами, предложения закупок (v2/F4) | ✅ | |
| Поставщики и закупки | ✅ | |
| Отчёты, дашборд | ✅ | |
| Аналитика и экспорт (v2/F5) | ✅ | ABC, фудкост, официанты, тепловая карта, скидки/отмены; CSV и XLSX; «PDF» — печатная HTML-страница (сохранение в PDF через браузер) |
| Персонал: учёт времени, график, табель (v2/F6) | ✅ | |
| Вход по PIN на общих планшетах (v2/F6) | ✅ | только на устройстве, подключённом менеджером; сессия ограничена филиалом устройства |
| Уведомления, аудит | ✅ | in-app + SignalR |
| Telegram-уведомления владельцу (v2/F7) | 🔌 не подключено | нужен токен бота и chat id |
| SMS-подтверждения броней, Eskiz.uz (v2/F7) | 🔌 не подключено | нужен договор и доступ Eskiz; с реальным Eskiz не проверялось |
| Почта через SMTP (v2/F7) | 🔌 не подключено | нужны параметры SMTP; до этого письма пишутся в лог |
| PWA, тёмная тема, печать 80 мм, горячие клавиши (v2/F8) | ✅ | service worker кэширует только статику (API не кэшируется, офлайн-работы с данными нет) |
| Платформа (организации, тарифы, feature flags, заявки, break-glass, ошибки интеграций) | ✅ | биллинга/онлайн-оплаты подписки нет |
| Лендинг + заявка на демо | ✅ | юридические страницы — черновик |
| Офлайн-режим | ❌ | вне объёма (Q10) |
| Локализация | 🟡 | RU полный; UZ и EN — машинный перевод, нужна вычитка (Q11) |
| Production-деплой v2 | ❌ не выполнен | фронтенды MVP на Vercel (T4) — **v2 туда не выкладывался**; хостинг backend не выбран (T3) |

## Проверки и тесты

```bash
cd respos-backend && dotnet build && dotnet test      # 252 unit + 201 integration; интеграционным нужен Docker (Testcontainers)
cd respos-admin   && npm run lint && npm run typecheck && npm run test && npm run build   # 314 тестов (Vitest)
cd respos-landing && npm run lint && npm run typecheck && npm run test && npm run build   # 35 тестов
cd respos-desktop && npm run lint && npm run typecheck && npm run test                    # оболочка Windows; e2e и сборка exe — в её README
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
