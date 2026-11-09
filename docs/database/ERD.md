# RestaurantOS — ERD и модель данных

Источник истины по полям — `respos-contracts/DOMAIN_MODEL.md`. Здесь: связи, ключи, ограничения, индексы,
правила удаления и tenant scope. PostgreSQL 16, EF Core 8 (Npgsql). Имена таблиц — множественное число (`Orders`).


> Модель данных разделена на 3 файла: [ERD.md](ERD.md) (соглашения, Identity, Floor, Menu, Orders & Kitchen) ·
> [ERD_INVENTORY_PAYMENTS.md](ERD_INVENTORY_PAYMENTS.md) (Inventory, Procurement, Payments, Notifications/Audit) ·
> [ERD_CONSTRAINTS.md](ERD_CONSTRAINTS.md) (scope, уникальные ограничения, удаление, индексы, инварианты, вопросы).

## 0. Общие соглашения

| Что | Тип / правило |
|---|---|
| PK | `Id uuid` (генерируется приложением, `Guid.CreateVersion7()`/sequential — на выбор backend) |
| Деньги | `numeric(18,2)` |
| Количество | `numeric(18,3)` |
| Проценты | `numeric(5,2)` |
| Коэффициент конверсии | `numeric(18,6)` |
| Время | `timestamptz`, хранится UTC; date-only — `date` в timezone филиала |
| Enum | `text` со snake_case значением (как в API) + CHECK constraint |
| Concurrency | `RowVersion` = системная колонка `xmin` (Npgsql `UseXminAsConcurrencyToken`) — `Orders`, `StockBalances`, `CashShifts` |
| Аудит-поля | `CreatedAt, CreatedBy, UpdatedAt, UpdatedBy` (`AuditableEntity`) |
| Архив | `IsArchived bool, ArchivedAt timestamptz null` (`IArchivable`) |
| Tenant | `OrganizationId uuid not null` + индекс + EF global query filter; филиальные — ещё `BranchId uuid not null` |

**Удаление:** по умолчанию FK `ON DELETE RESTRICT`. `CASCADE` только для принадлежащих дочерних строк агрегата
(перечислены в [ERD_CONSTRAINTS.md §9](ERD_CONSTRAINTS.md)). Всё, на что ссылается история (меню, столы, ингредиенты, поставщики, пользователи, роли),
архивируется/деактивируется, а не удаляется. Физически удаляются только черновики без истории.

Обозначения scope: **G** — глобальная (без tenant), **O** — `OrganizationId`, **B** — `OrganizationId` + `BranchId`,
**C** — дочерняя строка, scope через родителя (собственный `OrganizationId` не обязателен, запросы — только через агрегат).

## 1. Identity / SaaS

```mermaid
erDiagram
  Organizations ||--o{ RestaurantBranches : has
  RestaurantBranches ||--|| BranchSettings : has
  Users ||--o{ UserOrganizations : member
  Organizations ||--o{ UserOrganizations : has
  Organizations ||--o{ Roles : defines
  Roles ||--o{ RolePermissions : grants
  Permissions ||--o{ RolePermissions : in
  Users ||--o{ UserRoles : has
  Roles ||--o{ UserRoles : assigned
  Users ||--o{ UserBranchAccess : can
  RestaurantBranches ||--o{ UserBranchAccess : allows
  Users ||--o{ RefreshTokens : owns
  Users ||--o{ PasswordResetTokens : requests
  Organizations ||--o{ UserInvitations : sends
  Plans ||--o{ PlanFeatures : includes
  Features ||--o{ PlanFeatures : in
  Plans ||--o{ Subscriptions : used_by
  Organizations ||--o{ Subscriptions : has
  Organizations |o--o{ FeatureFlags : overrides
  Organizations ||--o{ BillingEvents : has

  Organizations {
    uuid Id PK
    text Name
    text Slug UK
    text Currency "UZS"
    text DefaultLanguage "ru"
    text Status "active|suspended|closed"
    bool IsDemo
  }
  RestaurantBranches {
    uuid Id PK
    uuid OrganizationId FK
    text Name
    text Timezone "Asia/Tashkent"
    bool IsActive
  }
  BranchSettings {
    uuid BranchId PK,FK
    uuid OrganizationId FK
    numeric ServiceChargePercent
    numeric TaxPercent
    bool AllowNegativeStock
    text InventoryConsumptionTrigger "on_payment"
  }
  Users {
    uuid Id PK
    text Email UK "normalized lower"
    text PasswordHash
    text Status "active|invited|blocked|deactivated"
    bool IsPlatformAdmin
    int FailedLoginCount
    timestamptz LockoutUntil
  }
  UserOrganizations {
    uuid Id PK
    uuid UserId FK
    uuid OrganizationId FK
    bool IsActive
  }
  Roles {
    uuid Id PK
    uuid OrganizationId FK
    text Code
    bool IsSystem
  }
  Permissions {
    text Code PK
    text Module
  }
  RolePermissions {
    uuid RoleId PK,FK
    text PermissionCode PK,FK
  }
  UserRoles {
    uuid UserId PK,FK
    uuid RoleId PK,FK
    uuid OrganizationId FK
  }
  UserBranchAccess {
    uuid UserId PK,FK
    uuid BranchId PK,FK
    uuid OrganizationId FK
  }
  RefreshTokens {
    uuid Id PK
    uuid UserId FK
    uuid OrganizationId FK "nullable"
    text TokenHash UK "SHA-256"
    uuid FamilyId
    timestamptz ExpiresAt
    timestamptz RevokedAt
    uuid ReplacedByTokenId FK
  }
  UserInvitations {
    uuid Id PK
    uuid OrganizationId FK
    text Email
    jsonb RoleIds
    jsonb BranchIds
    text TokenHash UK
    timestamptz ExpiresAt
  }
  PasswordResetTokens {
    uuid Id PK
    uuid UserId FK
    text TokenHash UK
    timestamptz UsedAt
  }
  Plans {
    uuid Id PK
    text Code UK "starter|business|enterprise"
    int MaxBranches
    int MaxUsers
  }
  Features {
    uuid Id PK
    text Code UK
  }
  PlanFeatures {
    uuid PlanId PK,FK
    uuid FeatureId PK,FK
  }
  Subscriptions {
    uuid Id PK
    uuid OrganizationId FK
    uuid PlanId FK
    text Status
  }
  FeatureFlags {
    uuid Id PK
    uuid OrganizationId FK "null = global"
    text FeatureCode
    bool IsEnabled
  }
  BillingEvents {
    uuid Id PK
    uuid OrganizationId FK
  }
```

`DemoRequests` (G) — отдельная таблица без связей (заявки с лендинга).

## 2. Floor & Reservations

```mermaid
erDiagram
  RestaurantBranches ||--o{ DiningAreas : has
  DiningAreas ||--o{ DiningTables : contains
  DiningTables |o--o{ TableReservations : reserved
  DiningAreas |o--o{ TableReservations : preferred

  DiningAreas {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    text Name
    int SortOrder
    bool IsActive
  }
  DiningTables {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid DiningAreaId FK
    text Number
    int Capacity
    text Status "available|occupied|reserved|unavailable"
    bool IsArchived
    numeric PosX
    numeric PosY
  }
  TableReservations {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid TableId FK "nullable"
    uuid PreferredAreaId FK "nullable"
    text GuestName
    text GuestPhone
    int GuestCount
    timestamptz StartsAt
    timestamptz EndsAt
    text Status "pending|confirmed|seated|completed|cancelled|no_show"
  }
```

## 3. Menu & Kitchen stations

```mermaid
erDiagram
  MenuCategories ||--o{ MenuItems : groups
  MenuItems ||--o{ MenuItemVariants : has
  MenuItems ||--o{ MenuItemModifierGroups : uses
  ModifierGroups ||--o{ MenuItemModifierGroups : linked
  ModifierGroups ||--o{ ModifierOptions : has
  MenuItems ||--o{ MenuAvailability : schedule
  KitchenStations |o--o{ MenuItems : prepares
  RestaurantBranches ||--o{ KitchenStations : has

  MenuCategories {
    uuid Id PK
    uuid OrganizationId FK
    text Name
    text NameUz
    int SortOrder
    bool IsArchived
  }
  MenuItems {
    uuid Id PK
    uuid OrganizationId FK
    uuid CategoryId FK
    uuid KitchenStationId FK "nullable"
    text Name
    text NameUz
    numeric Price
    int PrepTimeMinutes
    text Sku
    bool IsAvailable
    bool IsArchived
  }
  MenuItemVariants {
    uuid Id PK
    uuid MenuItemId FK
    text Name
    numeric Price "absolute"
    bool IsDefault
    bool IsArchived
  }
  ModifierGroups {
    uuid Id PK
    uuid OrganizationId FK
    text Name
    int MinSelect
    int MaxSelect
    bool IsRequired
  }
  MenuItemModifierGroups {
    uuid MenuItemId PK,FK
    uuid ModifierGroupId PK,FK
  }
  ModifierOptions {
    uuid Id PK
    uuid GroupId FK
    text Name
    numeric PriceDelta
    bool IsArchived
  }
  MenuAvailability {
    uuid Id PK
    uuid MenuItemId FK
    int DayOfWeek "nullable"
    time StartTime
    time EndTime
  }
  KitchenStations {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    text Name
    int SortOrder
    bool IsActive
  }
```

## 4. Orders & Kitchen

```mermaid
erDiagram
  DiningTables |o--o{ Orders : serves
  Users ||--o{ Orders : waiter
  Orders ||--|{ OrderItems : contains
  OrderItems ||--o{ OrderItemModifiers : has
  Orders ||--o{ OrderStatusHistory : logs
  MenuItems ||--o{ OrderItems : snapshot_of
  Orders ||--o{ KitchenTickets : produces
  KitchenStations ||--o{ KitchenTickets : receives
  KitchenTickets ||--|{ KitchenTicketItems : contains
  OrderItems ||--o{ KitchenTicketItems : tracked_by

  Orders {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    date BusinessDate "branch tz"
    int Number
    text Type "dine_in|takeaway"
    uuid TableId FK "nullable"
    uuid WaiterId FK
    text Status
    numeric Subtotal
    text DiscountType "none|amount|percent"
    numeric DiscountValue
    numeric DiscountAmount
    numeric ServiceChargeAmount
    numeric TaxAmount
    numeric Total
    numeric PaidAmount
    timestamptz OpenedAt
    timestamptz ClosedAt
    xid RowVersion "xmin"
  }
  OrderItems {
    uuid Id PK
    uuid OrderId FK
    uuid MenuItemId FK
    uuid VariantId FK "nullable"
    text NameSnapshot
    text VariantNameSnapshot
    numeric UnitPrice
    numeric Quantity
    numeric LineTotal
    text Status "new|sent|preparing|ready|served|cancelled"
    uuid KitchenStationId FK
  }
  OrderItemModifiers {
    uuid Id PK
    uuid OrderItemId FK
    uuid ModifierOptionId FK
    text NameSnapshot
    numeric PriceDelta
  }
  OrderStatusHistory {
    uuid Id PK
    uuid OrderId FK
    text FromStatus
    text ToStatus
    uuid ChangedBy FK
    timestamptz ChangedAt
    text Reason
  }
  KitchenTickets {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid OrderId FK
    uuid KitchenStationId FK
    int Number
    text Status "new|in_progress|ready|served|cancelled"
    timestamptz CreatedAt
  }
  KitchenTicketItems {
    uuid Id PK
    uuid TicketId FK
    uuid OrderItemId FK
    text Status "new|preparing|ready|cancelled"
  }
```

