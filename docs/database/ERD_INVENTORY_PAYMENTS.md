# RestaurantOS — ERD (часть 2): Inventory, Procurement, Payments, Audit

Соглашения по типам, scope (G/O/B/C) и удалению — см. [ERD.md §0](ERD.md#0-общие-соглашения).

> Модель данных разделена на 3 файла: [ERD.md](ERD.md) (соглашения, Identity, Floor, Menu, Orders & Kitchen) ·
> [ERD_INVENTORY_PAYMENTS.md](ERD_INVENTORY_PAYMENTS.md) (Inventory, Procurement, Payments, Notifications/Audit) ·
> [ERD_CONSTRAINTS.md](ERD_CONSTRAINTS.md) (scope, уникальные ограничения, удаление, индексы, инварианты, вопросы).

## 5. Inventory & Recipes

```mermaid
erDiagram
  UnitsOfMeasure ||--o{ UnitConversions : from
  UnitsOfMeasure ||--o{ Ingredients : base_unit
  IngredientCategories |o--o{ Ingredients : groups
  Ingredients ||--o{ StockBalances : balance_per_branch
  Ingredients ||--o{ StockMovements : moves
  MenuItems ||--o{ Recipes : versions
  MenuItemVariants |o--o{ Recipes : variant
  Recipes ||--|{ RecipeIngredients : contains
  Ingredients ||--o{ RecipeIngredients : used_in
  Orders ||--o| InventoryConsumptions : consumed_once
  InventoryCounts ||--|{ InventoryCountLines : contains
  Ingredients ||--o{ InventoryCountLines : counted

  UnitsOfMeasure {
    uuid Id PK
    uuid OrganizationId FK
    text Code "kg|g|l|ml|pcs"
    text Kind "mass|volume|count"
  }
  UnitConversions {
    uuid Id PK
    uuid OrganizationId FK
    uuid FromUnitId FK
    uuid ToUnitId FK
    numeric Factor
  }
  IngredientCategories {
    uuid Id PK
    uuid OrganizationId FK
    text Name
  }
  Ingredients {
    uuid Id PK
    uuid OrganizationId FK
    uuid CategoryId FK "nullable"
    uuid BaseUnitId FK
    text Name
    text Sku
    numeric CostPrice
    bool IsArchived
  }
  StockBalances {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid IngredientId FK
    numeric Quantity
    numeric MinQuantity
    xid RowVersion "xmin"
  }
  StockMovements {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid IngredientId FK
    text Type
    numeric Quantity "signed, base unit"
    numeric BalanceAfter
    numeric UnitCost
    text SourceType "order|purchase|manual|inventory_count"
    uuid SourceId
    text Reason
    timestamptz CreatedAt
  }
  Recipes {
    uuid Id PK
    uuid OrganizationId FK
    uuid MenuItemId FK
    uuid VariantId FK "nullable"
    int Version
    timestamptz EffectiveFrom
    bool IsActive
  }
  RecipeIngredients {
    uuid Id PK
    uuid RecipeId FK
    uuid IngredientId FK
    numeric Quantity
    uuid UnitId FK
  }
  InventoryConsumptions {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid OrderId FK,UK
    jsonb RecipeVersionsJson
    timestamptz CreatedAt
  }
  InventoryCounts {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    text Status "draft|completed"
  }
  InventoryCountLines {
    uuid Id PK
    uuid InventoryCountId FK
    uuid IngredientId FK
    numeric ExpectedQty
    numeric CountedQty
  }
```

## 6. Procurement

```mermaid
erDiagram
  Suppliers ||--o{ PurchaseOrders : supplies
  PurchaseOrders ||--|{ PurchaseOrderItems : contains
  Ingredients ||--o{ PurchaseOrderItems : ordered
  UnitsOfMeasure ||--o{ PurchaseOrderItems : unit

  Suppliers {
    uuid Id PK
    uuid OrganizationId FK
    text Name
    text Phone
    text Inn "optional"
    bool IsArchived
  }
  PurchaseOrders {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid SupplierId FK
    text Number
    text Status "draft|submitted|partially_received|received|cancelled"
    timestamptz ExpectedAt
    numeric Total
  }
  PurchaseOrderItems {
    uuid Id PK
    uuid PurchaseOrderId FK
    uuid IngredientId FK
    uuid UnitId FK
    numeric Quantity
    numeric UnitPrice
    numeric ReceivedQuantity
  }
```

Поступление создаёт `StockMovements` (`type = receipt`, `SourceType = purchase`, `SourceId = PurchaseOrderId`).

## 7. Payments & Cash

```mermaid
erDiagram
  RestaurantBranches ||--o{ CashShifts : has
  CashShifts ||--o{ Payments : collects
  Orders ||--o{ Payments : paid_by
  Payments ||--o{ Refunds : refunded_by

  CashShifts {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid OpenedBy FK
    timestamptz OpenedAt
    numeric OpeningAmount
    uuid ClosedBy FK
    timestamptz ClosedAt
    numeric ExpectedCashAmount
    numeric ActualCashAmount
    numeric Difference
    text Status "open|closed"
  }
  Payments {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid OrderId FK
    uuid CashShiftId FK
    text Method "cash|card|other"
    numeric Amount
    text Status "completed|refunded|partially_refunded"
    text Provider "manual"
    text ExternalReference
    text IdempotencyKey
    uuid CreatedBy FK
  }
  Refunds {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK
    uuid PaymentId FK
    uuid CashShiftId FK "proposed"
    numeric Amount
    text Reason
    uuid CreatedBy FK
  }
```

## 8. Notifications, Audit, Idempotency

```mermaid
erDiagram
  Notifications ||--o{ NotificationReads : read_by
  Users ||--o{ NotificationReads : reads
  Users |o--o{ AuditLogs : performed

  Notifications {
    uuid Id PK
    uuid OrganizationId FK
    uuid BranchId FK "nullable"
    uuid UserId FK "null = by permission"
    text Type
    text Title
    text Link
    timestamptz CreatedAt
  }
  NotificationReads {
    uuid NotificationId PK,FK
    uuid UserId PK,FK
    timestamptz ReadAt
  }
  AuditLogs {
    uuid Id PK
    uuid OrganizationId "nullable, no FK"
    uuid BranchId "nullable"
    uuid UserId "nullable"
    text Action
    text EntityType
    text EntityId
    text CorrelationId
    jsonb ChangesJson "sanitized"
    text IpAddress
    timestamptz CreatedAt
  }
  IdempotencyRecords {
    uuid Id PK
    text Key
    uuid UserId
    text RequestHash
    int ResponseStatus
    jsonb ResponseBody
    timestamptz CreatedAt
  }
```

`AuditLogs` — append-only (нет UPDATE/DELETE в коде; в prod можно отозвать права UPDATE/DELETE у роли приложения).
FK на пользователей/организации не ставятся, чтобы журнал переживал любые изменения справочников.

