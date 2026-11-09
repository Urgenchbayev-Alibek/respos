# ADR-0004. RBAC: единый каталог permissions

**Статус:** Accepted
**Дата:** 2026-11-10

## Контекст

ТЗ §3: RBAC, проверка на backend, единый каталог permissions. Ресторанам нужны свои роли поверх стандартных.
Platform Super Admin не должен иметь бесконтрольный доступ к данным ресторанов.

## Решение

- Каталог — `respos-contracts/PERMISSIONS.md`; в коде ровно два зеркала:
  `Restaurant.Domain/Constants/Permissions.cs` (nested static classes, `const string`) и
  `respos-admin/src/shared/constants/permissions.ts`. Больше нигде строки прав не объявляются.
- Таблица `Permission` (глобальная, синхронизируется из каталога при старте), `Role` (на организацию),
  `RolePermission`, `UserRole`.
- Системные роли `owner, admin, manager, waiter, cook, cashier, stockkeeper, accountant` сидируются в каждую
  организацию (`IsSystem = true`); организация может создавать свои роли.
- Проверка: `[HasPermission(Permissions.Orders.Create)]` → policy-based authorization; эффективные права вычисляются
  из `UserRole → RolePermission` текущей организации (кеш на запрос).
- Ресурсные проверки (tenant/филиал) — в handlers + global query filters (ADR-0002).
- Platform-права (`platform.*`) — только по `User.IsPlatformAdmin`, не через роли организации.
  `platform.tenant-data.access` — break-glass с причиной и аудитом.
- Защиты: нельзя деактивировать себя и последнего owner; системную роль и роль с пользователями нельзя удалить.

## Альтернативы

- **Только роли** (`[Authorize(Roles="manager")]`) — нельзя кастомизировать роли под ресторан.
- **ABAC / policy engine** (OPA и т. п.) — избыточно для MVP.
- **Права в JWT как источник истины** — не отзываются до истечения токена.

## Последствия

- Новое право = правка контракта + обоих зеркал + seed; изменение — в `respos-contracts/CHANGELOG.md`.
- Frontend скрывает UI по `MeDto.permissions` только для UX.
- Тесты: каждый защищённый эндпоинт → 403 без права (параметризованный тест по каталогу).
