# ADR-0002. Multi-tenancy: общая схема, global query filters, X-Branch-Id

**Статус:** Accepted
**Дата:** 2026-11-10

## Контекст

С первого дня несколько организаций (tenant) и филиалов (ТЗ §4.1, §14.1). Для MVP допустима одна БД с общей
схемой. Нельзя доверять `organizationId`/`branchId`/`userId` от клиента. Отсутствие tenant context = отказ.

## Решение

1. **Shared database, shared schema.** Каждая бизнес-таблица имеет `OrganizationId` (индекс), филиальная — ещё `BranchId`.
2. **Организация** берётся только из claim `org` access-токена (`ITenantContext.OrganizationId`).
   Смена организации — `POST /auth/switch-organization` с выпуском нового токена.
3. **Филиал** — только из заголовка `X-Branch-Id`. Проверка: филиал принадлежит организации и у пользователя есть
   `UserBranchAccess` (owner/admin — неявный доступ ко всем филиалам организации). Нет/чужой → 403 `tenant.branch_forbidden`.
4. **EF Core global query filters** на всех `ITenantScoped`: `OrganizationId == current`. Для `IBranchScoped`
   запросы явно фильтруют `BranchId == current` (branch-фильтр не глобальный: отчёты владельца могут агрегировать филиалы).
5. `OrganizationId`/`BranchId` проставляются `SaveChanges`-interceptor-ом из контекста; попытка записать сущность
   другого tenant → исключение.
6. Чужой ID в URL → **404** (существование не раскрывается).
7. `IgnoreQueryFilters()` разрешён только в Platform-фичах, auth (поиск пользователя по email) и seed; использование ревьюится.
8. Platform admin: токен без `org`, только агрегаты; доступ к данным — break-glass с причиной, read-only, 30 мин, аудит.

## Альтернативы

- **БД на tenant** — сильная изоляция, но миграции/бэкапы/стоимость × N; рано для MVP.
- **Схема на tenant** — сложнее EF-миграции и пул соединений.
- **PostgreSQL Row-Level Security** — defence-in-depth; можно добавить позже (через `SET app.organization_id`),
  но усложняет пул соединений и тесты.

## Последствия

- Дешёвая эксплуатация, одна миграция для всех.
- Ошибка в фильтре = утечка между tenant → обязательные интеграционные тесты изоляции (подмена ID, подмена
  `X-Branch-Id`, чужая организация) — см. TEST_PLAN.
- Уникальные индексы включают `OrganizationId`/`BranchId`, где уникальность в пределах tenant.
- Дочерние сущности без собственного `OrganizationId` (например, `OrderItem`) защищены только через родителя —
  запросы к ним всегда идут через агрегат.
- Возможен будущий переезд крупного клиента в отдельную БД (тот же код, другая connection string).
