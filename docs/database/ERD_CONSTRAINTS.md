# RestaurantOS — ERD (часть 3): ограничения, индексы, инварианты

Обозначения scope: G — глобальная, O — OrganizationId, B — OrganizationId + BranchId, C — дочерняя (через родителя).

> Модель данных разделена на 3 файла: [ERD.md](ERD.md) (соглашения, Identity, Floor, Menu, Orders & Kitchen) ·
> [ERD_INVENTORY_PAYMENTS.md](ERD_INVENTORY_PAYMENTS.md) (Inventory, Procurement, Payments, Notifications/Audit) ·
> [ERD_CONSTRAINTS.md](ERD_CONSTRAINTS.md) (scope, уникальные ограничения, удаление, индексы, инварианты, вопросы).

## 9. Scope, уникальные ограничения, удаление

| Таблица | Scope | Уникальные ограничения | Удаление |
|---|---|---|---|
| Organizations | G | `Slug` | не удаляется (`Status = closed`) |
| RestaurantBranches | O | — (желательно `(OrganizationId, Name)`) | деактивация `IsActive` |
| BranchSettings | B | PK = `BranchId` | вместе с филиалом (не удаляется) |
| Users | G | `Email` (normalized lower) | деактивация `Status` |
| UserOrganizations | O | `(UserId, OrganizationId)` | `IsActive = false` |
| Roles | O | `(OrganizationId, Code)` | DELETE только не системной без пользователей |
| Permissions | G | PK `Code` | не удаляется |
| RolePermissions | C (Role) | PK `(RoleId, PermissionCode)` | **CASCADE** от Role |
| UserRoles | O | PK `(UserId, RoleId)` | DELETE при снятии роли |
| UserBranchAccess | O | PK `(UserId, BranchId)` | DELETE при снятии доступа |
| RefreshTokens | G (+OrganizationId?) | `TokenHash` | очистка просроченных job-ом |
| UserInvitations | O | `TokenHash`; `(OrganizationId, Email)` WHERE `AcceptedAt IS NULL` | истекают |
| PasswordResetTokens | G | `TokenHash` | очистка |
| Plans / Features | G | `Code` | `IsActive = false` |
| PlanFeatures | G | PK `(PlanId, FeatureId)` | CASCADE от Plan |
| Subscriptions | O | одна активная на org (partial unique `WHERE Status IN ('trial','active','past_due')`) | история хранится |
| FeatureFlags | O / G | `(OrganizationId, FeatureCode)` NULLS NOT DISTINCT | DELETE |
| DemoRequests | G | — | хранится |
| DiningAreas | B | — | архив (`IsActive = false`) |
| DiningTables | B | `(BranchId, Number)` WHERE `NOT IsArchived` | архив |
| TableReservations | B | без пересечений для активных (см. §10) | статус `cancelled` |
| KitchenStations | B | — | `IsActive = false` |
| MenuCategories | O | — | архив |
| MenuItems | O | `(OrganizationId, Sku)` WHERE `Sku IS NOT NULL AND NOT IsArchived` | архив |
| MenuItemVariants | C (MenuItem) | — | архив |
| ModifierGroups | O | — | DELETE, если не использован; иначе архив опций |
| MenuItemModifierGroups | C | PK `(MenuItemId, ModifierGroupId)` | CASCADE от MenuItem / ModifierGroup |
| ModifierOptions | C (Group) | — | архив |
| MenuAvailability | C (MenuItem) | — | CASCADE от MenuItem |
| Orders | B | `(BranchId, BusinessDate, Number)` | не удаляются (`cancelled`) |
| OrderItems | C (Order) | — | статус `cancelled`; CASCADE только технически от Order |
| OrderItemModifiers | C (OrderItem) | — | **CASCADE** от OrderItem |
| OrderStatusHistory | C (Order) | — | append-only |
| KitchenTickets | B | `(BranchId, OrderId, Number)` | статус `cancelled` |
| KitchenTicketItems | C (Ticket) | `(TicketId, OrderItemId)` | CASCADE от Ticket |
| UnitsOfMeasure | O | `(OrganizationId, Code)` | RESTRICT |
| UnitConversions | O | `(OrganizationId, FromUnitId, ToUnitId)` | DELETE |
| IngredientCategories | O | `(OrganizationId, Name)` | RESTRICT |
| Ingredients | O | `(OrganizationId, Sku)` WHERE `Sku IS NOT NULL AND NOT IsArchived` | архив |
| StockBalances | B | `(BranchId, IngredientId)` | не удаляется |
| StockMovements | B | — | append-only |
| Recipes | O | `(MenuItemId, VariantId, Version)`; одна активная: `(MenuItemId, VariantId)` WHERE `IsActive` NULLS NOT DISTINCT | история хранится |
| RecipeIngredients | C (Recipe) | `(RecipeId, IngredientId)` | **CASCADE** от Recipe |
| InventoryConsumptions | B | **`OrderId`** (идемпотентность) | не удаляется |
| InventoryCounts | B | — | draft можно удалить |
| InventoryCountLines | C | `(InventoryCountId, IngredientId)` | CASCADE от Count |
| Suppliers | O | — | архив |
| PurchaseOrders | B | `(BranchId, Number)` | draft — DELETE; иначе `cancelled` |
| PurchaseOrderItems | C (PO) | — | **CASCADE** от PurchaseOrder |
| CashShifts | B | одна открытая на филиал: `(BranchId)` WHERE `Status = 'open'` | не удаляется |
| Payments | B | `(OrganizationId, IdempotencyKey)` | не удаляется (refund) |
| Refunds | B | — | не удаляется |
| Notifications | O (+BranchId?) | — | очистка старых job-ом |
| NotificationReads | C | PK `(NotificationId, UserId)` | CASCADE от Notification |
| AuditLogs | O? | — | append-only |
| IdempotencyRecords | G (по UserId) | `(Key, UserId)` | TTL 24 ч, очистка job-ом |

`NULLS NOT DISTINCT` поддерживается PostgreSQL 15+ (у нас 16); в EF Core задаётся через raw SQL в миграции, если
Npgsql-провайдер не даёт fluent-API (`AreNullsDistinct(false)` — проверить версию провайдера).

## 10. Индексы для частых запросов

- Каждая O/B-таблица: индекс по `OrganizationId` (часто составной с `BranchId` первым полем после org).
- `Orders`: `(BranchId, Status)`, `(BranchId, OpenedAt)`, `(BranchId, TableId)` WHERE `Status NOT IN ('paid','cancelled')`,
  `(BranchId, WaiterId, OpenedAt)`.
- `OrderItems`: `(OrderId)`, `(MenuItemId)` (популярные блюда).
- `KitchenTickets`: `(BranchId, Status, CreatedAt)`, `(BranchId, KitchenStationId, Status)`.
- `TableReservations`: `(TableId, StartsAt, EndsAt)`, `(BranchId, StartsAt)`.
  Рекомендуется exclusion constraint как защита от гонок:
  `EXCLUDE USING gist (TableId WITH =, tstzrange(StartsAt, EndsAt, '[)') WITH &&) WHERE (Status IN ('pending','confirmed','seated') AND TableId IS NOT NULL)`
  (нужно расширение `btree_gist`; добавляется raw SQL в миграции). Ошибка constraint → 409 `reservation.time_conflict`.
- `StockMovements`: `(BranchId, IngredientId, CreatedAt)`, `(BranchId, SourceType, SourceId)`.
- `StockBalances`: unique `(BranchId, IngredientId)`; для «ниже минимума» — фильтр `Quantity < MinQuantity` по филиалу.
- `Payments`: `(BranchId, CreatedAt)`, `(OrderId)`, `(CashShiftId)`.
- `PurchaseOrders`: `(BranchId, Status)`, `(SupplierId)`.
- `AuditLogs`: `(OrganizationId, CreatedAt DESC)`, `(OrganizationId, EntityType, EntityId)`.
- `Notifications`: `(OrganizationId, BranchId, CreatedAt DESC)`.
- `Users`: unique `Email`; `MenuItems`: `(OrganizationId, CategoryId)`, поиск по имени — `pg_trgm` позднее при необходимости.

## 11. Транзакционные инварианты

1. `StockBalances.Quantity` меняется только вместе с вставкой `StockMovements` (одна транзакция, `BalanceAfter` = новое значение).
2. Оплата: `Payments` + `Orders.PaidAmount/Status` + (при полной оплате) `InventoryConsumptions` + `StockMovements` +
   `DiningTables.Status` — одна транзакция (или outbox, ADR-0006).
3. Поступление закупки: `PurchaseOrderItems.ReceivedQuantity` + `StockMovements(receipt)` + `StockBalances` +
   `Ingredients.CostPrice` + статус PO — одна транзакция.
4. Номер заказа: следующий `Number` в `(BranchId, BusinessDate)` — через `SELECT max+1` под advisory lock или
   отдельную таблицу счётчиков `OrderNumberSequences (BranchId, BusinessDate, LastNumber)`; уникальный индекс страхует.

## 12. Вопросы / несоответствия контракту

1. **`Order.BusinessDate` отсутствует в DOMAIN_MODEL**, но номер «sequential per branch per day» требует даты
   бизнес-дня (в timezone филиала) для уникального ключа и отчётов. Предлагается добавить колонку.
2. **`Refund.CashShiftId` отсутствует**, а закрытие смены считает `expected = opening + cash payments − cash refunds`.
   Возврат в другой смене, чем платёж, без этой колонки посчитается неверно. Также нужен `Refund.Method`/или правило «метод = метод платежа».
3. **`MenuItemVariant`**: в DOMAIN_MODEL «PriceDelta (or absolute Price — use `Price` absolute)» — двусмысленность;
   здесь принят абсолютный `Price`, в DTO `variants: {id,name,price}`. Стоит убрать `PriceDelta` из текста контракта.
4. **`MenuItem.KitchenStationId`** — меню org-scoped, а станции branch-scoped; при втором филиале нужна таблица
   соответствия `MenuItemStation (MenuItemId, BranchId, StationId)`. В MVP — как в контракте.
5. **`MenuItem.IsAvailable`** — org-уровень, тогда как «стоп-лист» обычно филиальный. Для мульти-филиала нужен branch-override.
6. **`StockBalance.MinQuantity` vs `Ingredient.MinQuantity`**: в контракте одновременно «MinQuantity (per branch → stored on
   StockBalance)» у Ingredient — здесь хранится только на `StockBalances`.
7. **Дочерние таблицы без `OrganizationId`** (OrderItems, RecipeIngredients, PurchaseOrderItems, …) — контракт говорит
   «Every business table has OrganizationId». Нужно решить: либо денормализовать `OrganizationId` во все дочерние
   (проще global filter), либо явно разрешить scope через родителя (здесь — **C**).
8. **`UserInvitation.RoleIds/BranchIds`** — массивы в одной колонке (jsonb/uuid[]) без FK; допустимо для приглашений,
   но целостность проверяется кодом.
9. **`OrderStatus` содержит `served`**, а ТЗ §4.6 перечисляет статусы без него — расширение, не конфликт; KitchenTicket
   тоже имеет `served`, а `KitchenTicketItem` — нет (зеркалит item без `served`/`sent`).
10. **`Payment.IdempotencyKey` unique per org** и **`IdempotencyRecord (Key, UserId)`** — две разные области
    уникальности; один и тот же ключ у разных пользователей одной организации на `POST /payments` даст 409 по таблице
    Payments, хотя IdempotencyRecord его пропустит. Нормально, но стоит описать поведение в контракте.
11. **`AuditLog.EntityId`** — `text` (не все сущности имеют Guid, напр. `Permission.Code`).
12. **Refund не возвращает ингредиенты** — допущение (ADR-0006), не отражено в контракте.
