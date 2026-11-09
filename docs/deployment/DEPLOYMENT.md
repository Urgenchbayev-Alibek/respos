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

# API в контейнере вместе с БД (профиль full; нужен respos-backend/Dockerfile)
docker compose -f infra/docker/docker-compose.yml --profile full up -d --build
```

Затем:

```bash
cd respos-backend && dotnet run --project src/Restaurant.Api   # http://localhost:5080/swagger
cd respos-admin   && npm install && npm run dev                 # http://localhost:5173
cd respos-landing && npm install && npm run dev                 # http://localhost:5174
```

Переменные — по образцу корневого `.env.example`; копию `.env` не коммитить. Demo seed (`Seed__DemoData=true`) — только в Development.

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
| `VITE_API_BASE_URL` | `https://api.example.com/api/v1` | admin, landing (форма заявки) |
| `VITE_HUB_URL` | `https://api.example.com/hubs/restaurant` | admin |

`VITE_*` попадают в браузерный бандл — **никаких секретов в них**. URL API не хардкодить.

**SPA rewrite** (React Router): в `respos-admin/vercel.json` (поддерживается агентом frontend) должна быть
fallback-перезапись всех путей на `index.html`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Проверить после деплоя: прямой переход на `/kds` и обновление страницы не дают 404; preview и production работают с нужным API.

## 4. Backend и PostgreSQL — варианты хостинга

Требования к платформе: .NET 8 (контейнер), **длительные WebSocket-соединения** (SignalR), HTTPS, переменные окружения/секреты, health checks, логи. Для БД: PostgreSQL 16, автоматические бэкапы и восстановление (PITR желательно), лимит подключений, регион, экспорт.

| Вариант | Плюсы | Что проверить перед выбором |
|---|---|---|
| PaaS с контейнерами (Render, Railway, Fly.io и т. п.) | быстрый старт из Dockerfile, managed Postgres | засыпание на бесплатном тарифе, поддержка WebSocket, лимиты, регион, цена бэкапов |
| Azure App Service + Azure Database for PostgreSQL | нативно для .NET, WebSockets, slots | стоимость, регион |
| VPS (в т. ч. дата-центры в Узбекистане) + Docker Compose + Caddy/Nginx | полный контроль, локализация данных | администрирование, бэкапы, мониторинг — на вас |

Выбор — за владельцем (User-Todo **T3**). Требования закона РУз о персональных данных (локализация данных граждан РУз) могут сделать хостинг в Узбекистане обязательным — нужна юридическая консультация (User-Todo, раздел C).

Минимальные переменные backend (production):

```env
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Host=...;Port=5432;Database=...;Username=...;Password=...;SSL Mode=Require
Jwt__Issuer=respos
Jwt__Audience=respos
Jwt__SigningKey=<случайные ≥ 32 байт, из secret manager>
Frontend__AllowedOrigins=https://app.example.com,https://example.com
FileStorage__Provider=Local
Seed__DemoData=false
```

Health checks: `GET /health/live` (процесс жив), `GET /health/ready` (включая БД) — использовать в настройках платформы.

## 5. Миграции БД (EF Core)

Правила ТЗ §18.5: понятные имена, проверка на чистой БД, не редактировать применённые production-миграции, анализ разрушительных изменений, **production-миграция только после бэкапа**, demo seed отдельно от production data.

```bash
# создание (разработчик)
cd respos-backend
dotnet tool restore            # если dotnet-ef подключён как local tool
dotnet ef migrations add AddReservations --project src/Restaurant.Infrastructure --startup-project src/Restaurant.Api
# применение локально
dotnet ef database update --project src/Restaurant.Infrastructure --startup-project src/Restaurant.Api
# идемпотентный SQL-скрипт для ревью и production
dotnet ef migrations script --idempotent -o migrate.sql --project src/Restaurant.Infrastructure --startup-project src/Restaurant.Api
```

Процедура production:
1. Ревью `migrate.sql` (DROP/ALTER с потерей данных — отдельное согласование).
2. Бэкап БД (снимок платформы или `pg_dump`), проверить, что он создан.
3. Применить скрипт (или migration bundle) **до** переключения трафика на новую версию API.
4. Задеплоить API, проверить `/health/ready` и smoke-сценарий (вход, создание заказа на демо-организации staging).
5. При неудаче — откат версии API; откат схемы — восстановлением из бэкапа или заранее подготовленным down-скриптом.

Автоприменение миграций при старте допускается только в Development **[?]** (решение backend).

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
- Refresh-cookie: `HttpOnly; Secure; SameSite=None` в production (ADR-0003). При разных регистрируемых доменах (например `*.vercel.app` и `api.onrender.com`) браузеры с блокировкой сторонних cookies (Safari и др.) могут не отправлять cookie → **рекомендуется один домен**: `app.<домен>` (Vercel) и `api.<домен>` (backend). Тогда cookie становится first-party.
- SignalR: тот же origin в allowlist; токен в `?access_token=` — не логировать query string на прокси.

## 8. Секреты

- Не коммитить `.env`, ключи, пароли, connection strings production (проверено `.gitignore`).
- Секреты — в secret manager / переменных окружения платформы; доступ — у минимального круга людей.
- `Jwt__SigningKey`: ≥ 32 случайных байт, свой для каждого окружения; ротация → все пользователи перелогинятся.
- GitHub Actions: CI секретов не требует; для будущего CD — GitHub Environments с защитой.
- В логах и аудите — без паролей, токенов, строк подключения.

## 9. HTTPS

- Vercel выдаёт сертификаты автоматически (в т. ч. для своего домена).
- Backend: TLS на платформе / reverse proxy (Caddy — автоматический Let’s Encrypt; Nginx + certbot). API за прокси должен учитывать `X-Forwarded-Proto` (ForwardedHeaders), включить HSTS в production.
- Доступ к Postgres — только по TLS (`SSL Mode=Require`) и только из сети backend.

## 10. Чек-лист перед пилотом

- [ ] Платформа backend и БД выбрана, тарифы/лимиты проверены (T3)
- [ ] Свой домен, `app.` и `api.` поддомены, HTTPS
- [ ] Production переменные заданы, `Seed__DemoData=false`
- [ ] Бэкапы включены и восстановление проверено
- [ ] CORS allowlist = только production домены
- [ ] Health checks подключены, алерт при падении
- [ ] E2E-сценарий (TEST_PLAN §5) пройден на staging
- [ ] Метки «Демо» / «Не является фискальным чеком» видны; юридическая консультация (User-Todo C)
