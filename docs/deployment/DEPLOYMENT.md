# Деплой RestaurantOS

Состав: `respos-backend` (ASP.NET Core API + SignalR), PostgreSQL 16, `respos-admin` (SPA), `respos-landing` (статический сайт).
ТЗ §11: frontend — Vercel (если актуальные условия подходят), backend и БД — отдельный хостинг.

> **Важно.** Бесплатный постоянный production-хостинг не обещается. Бесплатные тарифы backend/БД
> могут засыпать, иметь лимиты CPU/RAM/подключений/хранения и удалять неактивные ресурсы.
> Для пилота с реальными заказами надёжность и резервное копирование важнее бесплатности.
> **Перед выбором любой платформы проверьте её актуальные тарифы, лимиты и условия.**

## 1. Локальный запуск (Docker Compose)

Требования: Docker Desktop / Docker Engine с Compose v2, .NET 8 SDK, Node.js 22.

```bash
# PostgreSQL (localhost:5433, db/user respos, пароль respos_dev — только для dev)
docker compose -f infra/docker/docker-compose.yml up -d postgres
# или скриптом
./scripts/dev-up.sh          # Linux/macOS/Git Bash
pwsh ./scripts/dev-up.ps1    # Windows PowerShell

# API в контейнере вместе с БД (профиль full; образ из respos-backend/Dockerfile, http://localhost:5080 → :8080)
docker compose -f infra/docker/docker-compose.yml --profile full up -d --build
```

### Профиль `full` = production-конфигурация

Профиль `full` запускает API с `ASPNETCORE_ENVIRONMENT=Production` — так же, как реальный образ: `appsettings.Development.json`
не применяется, все значения заданы явно через env в `docker-compose.yml`:

| Переменная compose | По умолчанию | Что задаёт |
|---|---|---|
| `POSTGRES_PASSWORD` | `respos_dev` | пароль БД и `ConnectionStrings__DefaultConnection` (`postgres:5432`) |
| `JWT_SIGNING_KEY` | локальный ключ (≥ 32 байт) | `Jwt__SigningKey` — **для любого не-локального запуска задайте свой** |
| `DATABASE_MIGRATE_ON_STARTUP` | `true` | `Database__MigrateOnStartup` — миграции при старте |
| `PLATFORM_ADMIN_PASSWORD` | пусто | `Seed__PlatformAdminPassword` (пусто → superadmin не создаётся) |
| `FRONTEND_ALLOWED_ORIGINS` | `:5173,:5174` | CORS |
| `REFRESH_COOKIE_SECURE` | `false` | `Auth__RefreshCookieSecure` (локальный HTTP) |
| `SWAGGER_ENABLED` | `false` | Swagger |

`Seed__DemoData=false`: демо-организация сидится только в Development (для демо-данных используйте `dotnet run`).
**Fail-fast:** вне зависимости от окружения API не стартует (понятное `InvalidOperationException` в логе), если не задан
`ConnectionStrings__DefaultConnection` или `Jwt__SigningKey` короче 32 байт.

Затем:

```bash
cd respos-backend && dotnet run --project src/Restaurant.Api   # http://localhost:5080/swagger
cd respos-admin   && npm install && npm run dev                 # http://localhost:5173
cd respos-landing && npm install && npm run dev                 # http://localhost:5174
```

Локально `dotnet run` берёт всё из `appsettings.Development.json` (строка подключения на 5433, dev-ключ JWT, CORS для
`:5173/:5174`, `Database:MigrateOnStartup=true`, `Seed:DemoData=true`, пароль демо `Demo123!`) — `.env` не нужен.
`.env.example` — справочник имён переменных; копию `.env` не коммитить. Не задавайте `Seed__DemoPassword` пустым значением.
Demo seed выполняется только при `ASPNETCORE_ENVIRONMENT=Development` **и** `Seed:DemoData=true`.

## 2. Окружения

| Окружение | Frontend | Backend | БД | Данные |
|---|---|---|---|---|
| Development | `npm run dev` | `dotnet run` / compose | compose Postgres | demo seed |
| Preview | Vercel Preview (каждый PR) | общий staging API | staging БД | demo seed, `IsDemo=true` |
| Production | Vercel Production (`main`) | production API | managed Postgres с бэкапами | без demo seed |

## 3. Frontend на Vercel (`respos-admin`, `respos-landing`)

Два отдельных Vercel-проекта из одного репозитория (monorepo):

| Настройка | respos-admin | respos-landing |
|---|---|---|
| Root Directory | `respos-admin` | `respos-landing` |
| Framework preset | Vite | Vite |
| Install / Build | `npm ci` / `npm run build` | `npm ci` / `npm run build` |
| Output | `dist` | `dist` |
| Node.js | 22.x | 22.x |

**Переменные окружения** (задаются в Vercel отдельно для Development / Preview / Production):

| Переменная | Пример (не реальный адрес) | Проект |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.example.com/api/v1` | admin, landing (форма заявки, тарифы) |
| `VITE_HUB_URL` | `https://api.example.com/hubs/restaurant` | admin |
| `VITE_APP_ENV` | `development` / `preview` / `production` (метка окружения в UI, необязательно) | admin |
| `VITE_ADMIN_APP_URL` | `https://app.example.com` (ссылка «Войти») | landing |

`VITE_*` попадают в браузерный бандл — **никаких секретов в них**. URL API не хардкодить.

**SPA rewrite** (React Router): в `respos-admin/vercel.json` (поддерживается агентом frontend) должна быть
fallback-перезапись всех путей на `index.html`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Проверить после деплоя: прямой переход на `/kds` и обновление страницы не дают 404; preview и production работают с нужным API.

## 4. Backend и PostgreSQL — варианты хостинга

Требования к платформе: .NET 8 (контейнер), **длительные WebSocket-соединения** (SignalR), HTTPS, переменные окружения/секреты, health checks, логи. Для БД: PostgreSQL 16, автоматические бэкапы и восстановление (PITR желательно), лимит подключений, регион, экспорт.

Образ: `respos-backend/Dockerfile` (multi-stage, `mcr.microsoft.com/dotnet/aspnet:8.0`, слушает `8080`, по умолчанию
`ASPNETCORE_ENVIRONMENT=Production`, пользователь `app`, каталог файлов `/app/storage`):

```bash
cd respos-backend && docker build -t respos-api . && docker run -p 8080:8080 --env-file prod.env respos-api
```

| Вариант | Плюсы | Что проверить перед выбором |
|---|---|---|
| PaaS с контейнерами (Render, Railway, Fly.io и т. п.) | быстрый старт из Dockerfile, managed Postgres | засыпание на бесплатном тарифе, поддержка WebSocket, лимиты, регион, цена бэкапов |
| Azure App Service + Azure Database for PostgreSQL | нативно для .NET, WebSockets, slots | стоимость, регион |
| VPS (в т. ч. дата-центры в Узбекистане) + Docker Compose + Caddy/Nginx | полный контроль, локализация данных | администрирование, бэкапы, мониторинг — на вас |

Выбор — за владельцем (User-Todo **T3**). Требования закона РУз о персональных данных (локализация данных граждан РУз) могут сделать хостинг в Узбекистане обязательным — нужна юридическая консультация (User-Todo, раздел C).

Минимальные переменные backend (production). Имена — секции `appsettings.json` через `__`:

```env
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Host=...;Port=5432;Database=...;Username=...;Password=...;SSL Mode=Require
Jwt__Issuer=respos
Jwt__Audience=respos
Jwt__SigningKey=<случайные ≥ 32 байт, из secret manager>
Frontend__AllowedOrigins=https://app.example.com,https://example.com   # или Frontend__AllowedOrigins__0=..., __1=...
Frontend__AppUrl=https://app.example.com                              # база ссылок приглашений / сброса пароля
Auth__RefreshCookieSameSite=Lax                                       # None — только при cross-site (§7)
Seed__PlatformAdminPassword=<секрет>                                  # без него superadmin@respos.uz не создаётся
```

Полный список настроек (значения по умолчанию — `respos-backend/src/Restaurant.Api/appsettings.json`):

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | — | PostgreSQL |
| `Jwt__Issuer`, `Jwt__Audience` | `respos` | параметры токена |
| `Jwt__SigningKey` | — (обязателен, ≥ 32 байт) | подпись JWT |
| `Jwt__AccessTokenMinutes` | `15` | время жизни access token |
| `Auth__RefreshTokenDays` | `14` | refresh token |
| `Auth__PasswordResetTokenMinutes`, `Auth__InvitationDays` | `60`, `7` | сроки токенов сброса/приглашений |
| `Auth__MaxFailedLoginAttempts`, `Auth__LockoutMinutes` | `5`, `15` | блокировка входа |
| `Auth__RefreshCookieSameSite` | `Lax` | `Lax` / `Strict` / `None` |
| `Auth__RefreshReuseGraceSeconds` | `15` | Окно (сек), в котором повторное предъявление только что ротированного refresh-токена считается гонкой вкладок, а не кражей (ADR-0003). `0` — выключить |
| `Auth__RefreshCookieSecure` | `true` | `false` только для локального HTTP |
| `Frontend__AllowedOrigins` | `[]` | CORS allowlist (с credentials) |
| `Frontend__AppUrl` | `http://localhost:5173` | URL admin-приложения для ссылок в письмах |
| `FileStorage__Provider` | `Local` | единственный провайдер в MVP |
| `FileStorage__LocalRoot`, `FileStorage__PublicBasePath` | `storage`, `/files` | каталог фото меню и URL-префикс |
| `RateLimiting__GlobalPermitPerMinute`, `__LoginPerMinute`, `__AuthPerMinute`, `__DemoRequestsPerHour` | `300`, `5`, `20`, `5` | лимиты |
| `Database__MigrateOnStartup` | `false` (`true` в Development) | применять миграции при старте |
| `Database__SeedOnStartup` | `true` | базовые идемпотентные сидеры: права и системные роли, тарифы/фичи, platform admin |
| `Seed__DemoData` | `false` (`true` в Development) | демо-организация — **только в Development** |
| `Seed__DemoPassword` | `Demo123!` | пароль демо-пользователей (Development) |
| `Seed__PlatformAdminPassword` | — | пароль `superadmin@respos.uz` вне Development |
| `Swagger__Enabled` | `false` | Swagger вне Development |
| `Housekeeping__Enabled`, `Housekeeping__IntervalMinutes` | `true`, `60` | фоновая очистка устаревших строк (каждый N минут, первый проход при старте) |
| `Housekeeping__IdempotencyRetentionHours` | `24` | удалять `idempotency_records` старше N часов |
| `Housekeeping__RefreshTokenRetentionDays`, `__ExpiredTokenRetentionDays` | `30`, `30` | refresh-токены, истёкшие/отозванные > N дней; токены сброса пароля и приглашения, истёкшие > N дней |
| `Housekeeping__ReadNotificationRetentionDays` | `90` | прочитанные уведомления старше N дней |
| `Http__UseHttpsRedirection` | `false` | HSTS + HTTPS-редирект вне Development (обычно делает прокси) |
| `Http__KnownProxies`, `Http__KnownNetworks` | пусто | доверенные прокси для `X-Forwarded-For/Proto` (IP / CIDR через запятую) |
| `Serilog__*` | compact JSON в stdout | логирование |
| `RESPOS_DESIGN_CONNECTION` | dev-БД `localhost:5433` | только для `dotnet ef` (design-time factory) |

Health checks: `GET /health/live` (процесс жив), `GET /health/ready` (включая БД) — использовать в настройках платформы.

## 5. Миграции БД (EF Core)

Правила ТЗ §18.5: понятные имена, проверка на чистой БД, не редактировать применённые production-миграции, анализ разрушительных изменений, **production-миграция только после бэкапа**, demo seed отдельно от production data.

Инструмент — локальный `dotnet-ef` 8.0.11 (`respos-backend/.config/dotnet-tools.json`). Design-time `AppDbContextFactory`
берёт строку подключения из `RESPOS_DESIGN_CONNECTION` (иначе dev-БД на 5433). Таблица истории — `__ef_migrations_history`.

```bash
cd respos-backend
dotnet tool restore
# создание (разработчик); имя — <Module>_<Change>
dotnet ef migrations add Orders_AddX -p src/Restaurant.Infrastructure -s src/Restaurant.Api -o Persistence/Migrations
# применение локально (в Development также автоматически при старте API)
dotnet ef database update -p src/Restaurant.Infrastructure -s src/Restaurant.Api
# идемпотентный SQL-скрипт для ревью и production
dotnet ef migrations script --idempotent -o migrate.sql -p src/Restaurant.Infrastructure -s src/Restaurant.Api
# или самодостаточный bundle
dotnet ef migrations bundle --self-contained -r linux-x64 -o efbundle -p src/Restaurant.Infrastructure -s src/Restaurant.Api
./efbundle --connection "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"
# применение к удалённой БД через dotnet ef
RESPOS_DESIGN_CONNECTION="Host=...;..." dotnet ef database update -p src/Restaurant.Infrastructure -s src/Restaurant.Api
```

Процедура production:
1. Ревью `migrate.sql` (DROP/ALTER с потерей данных — отдельное согласование).
2. Бэкап БД (снимок платформы или `pg_dump`), проверить, что он создан.
3. Применить скрипт (или migration bundle) **до** переключения трафика на новую версию API.
4. Задеплоить API, проверить `/health/ready` и smoke-сценарий (вход, создание заказа на демо-организации staging).
5. При неудаче — откат версии API; откат схемы — восстановлением из бэкапа или заранее подготовленным down-скриптом.

Автоприменение миграций при старте (`Database__MigrateOnStartup=true`) включено в `appsettings.Development.json` и в
compose-профиле `full`; в production по умолчанию выключено — миграции применяются отдельным шагом до старта API (User-Todo L4).
Флаг работает в любом окружении, если нужен auto-migrate (например, staging). Базовые сидеры (`Database__SeedOnStartup`)
идемпотентны и выполняются при каждом старте.

## 6. Резервное копирование и восстановление

- Ежедневный автоматический бэкап managed Postgres + хранение ≥ 7 дней (для пилота — желательно PITR).
- Для VPS: `pg_dump -Fc` по cron в отдельное хранилище (другой сервер/объектное хранилище), шифрование, ротация.
- **Раз в месяц тестовое восстановление** в отдельную БД с проверкой: число заказов/платежей, вход пользователя.
- Загруженные файлы (фото меню, `FileStorage__Provider=Local`) бэкапятся вместе с БД; на PaaS с эфемерным диском локальное хранилище не годится — нужен persistent volume или объектное хранилище.

```bash
pg_dump -Fc -h HOST -U USER -d respos -f respos_$(date +%F).dump
pg_restore -c -h HOST -U USER -d respos_restore respos_YYYY-MM-DD.dump
```

## 7. CORS, cookies, домены

- `Frontend__AllowedOrigins` — явный allowlist (production домены admin и landing, при необходимости preview-домены). Никаких `*` с credentials.
- CORS должен разрешать credentials (`AllowCredentials`) — refresh-cookie отправляется на `/api/v1/auth/refresh`.
- Refresh-cookie `refresh_token`: `HttpOnly; Secure; Path=/api/v1/auth`, `SameSite` из `Auth__RefreshCookieSameSite` (по умолчанию `Lax`; DECISIONS_v1_1 §10).
  **Рекомендуемый деплой — same-site**: `app.<домен>` (Vercel) и `api.<домен>` (backend), `SameSite=Lax`.
  Только если домены разные (например `*.vercel.app` и `api.onrender.com`) — `Auth__RefreshCookieSameSite=None` (+ `Secure`);
  браузеры с блокировкой сторонних cookies (Safari и др.) всё равно могут не отправлять такую cookie.
- SignalR: тот же origin в allowlist; токен в `?access_token=` — не логировать query string на прокси.

## 8. Секреты

- Не коммитить `.env`, ключи, пароли, connection strings production (проверено `.gitignore`).
- Секреты — в secret manager / переменных окружения платформы; доступ — у минимального круга людей.
- `Jwt__SigningKey`: ≥ 32 случайных байт, свой для каждого окружения; ротация → все пользователи перелогинятся.
- GitHub Actions: CI секретов не требует; для будущего CD — GitHub Environments с защитой.
- В логах и аудите — без паролей, токенов, строк подключения.

## 9. HTTPS

- Vercel выдаёт сертификаты автоматически (в т. ч. для своего домена).
- Backend: TLS на платформе / reverse proxy (Caddy — автоматический Let’s Encrypt; Nginx + certbot). Контейнер слушает HTTP `8080`; TLS и HSTS обычно обеспечивает прокси/платформа.
- `ForwardedHeaders` (`X-Forwarded-For`, `X-Forwarded-Proto`) включены всегда — реальный IP клиента нужен для rate limiting и аудита.
  Если `Http__KnownProxies`/`Http__KnownNetworks` пусты, стандартный список (только loopback) очищается и заголовки принимаются
  от любого отправителя (берётся только последний hop, `ForwardLimit=1`) — подходит для PaaS, где API доступен **только** через прокси
  платформы с динамическими IP. Если API доступен напрямую (VPS), укажите IP/сеть прокси.
- `Http__UseHttpsRedirection=true` включает `UseHsts` + `UseHttpsRedirection` вне Development. По умолчанию `false`, т. к. TLS
  терминируется на прокси и редирект внутри контейнера приводит к циклам/лишним хопам.
- Все ответы API содержат `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`.
- Доступ к Postgres — только по TLS (`SSL Mode=Require`) и только из сети backend.

## 10. Чек-лист перед пилотом

- [ ] Платформа backend и БД выбрана, тарифы/лимиты проверены (T3)
- [ ] Свой домен, `app.` и `api.` поддомены, HTTPS
- [ ] Production переменные заданы (`Jwt__SigningKey`, `Frontend__AllowedOrigins`, `Frontend__AppUrl`, `Seed__PlatformAdminPassword`), `Seed__DemoData` не включён
- [ ] Миграции применены (скрипт/bundle) после бэкапа
- [ ] Бэкапы включены и восстановление проверено
- [ ] CORS allowlist = только production домены
- [ ] Health checks подключены, алерт при падении
- [ ] E2E-сценарий (`scripts/e2e`, [E2E_RESULTS](../testing/E2E_RESULTS.md)) пройден на staging — с демо-организацией (вне Development демо-seed не создаётся, данные готовятся вручную)
- [ ] Метки «Демо» / «Не является фискальным чеком» видны; юридическая консультация (User-Todo C)
