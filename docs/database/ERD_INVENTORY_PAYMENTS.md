# RestaurantOS — ERD (часть 2): Inventory, Procurement, Payments, Audit

Соглашения по именам (snake_case), типам, scope (G/O/B/C) и удалению — см. [ERD.md §0](ERD.md#0-общие-соглашения).
Сверено с `AppDbContextModelSnapshot.cs`.

> Модель данных разделена на 3 файла: [ERD.md](ERD.md) (соглашения, Identity/SaaS, Floor, Menu, Orders & Kitchen) ·
> [ERD_INVENTORY_PAYMENTS.md](ERD_INVENTORY_PAYMENTS.md) (Inventory, Procurement, Payments, Notifications/Audit) ·
> [ERD_CONSTRAINTS.md](ERD_CONSTRAINTS.md) (scope, уникальные ограничения, удаление, индексы, инварианты, решённые вопросы).

## 5. Inventory & Recipes

```mermaid
erDiagram
  units_of_measure ||--o{ unit_conversions : from_to
  units_of_measure ||--o{ ingredients : base_unit
  ingredient_categories |o--o{ ingredients : groups
  ingredients ||--o{ stock_balances : balance_per_branch
  ingredients ||--o{ stock_movements : moves
  menu_items ||--o{ recipes : versions
  menu_item_variants |o--o{ recipes : variant
  recipes ||--|{ recipe_ingredients : contains
  ingredients ||--o{ recipe_ingredients : used_in
  orders ||--o| inventory_consumptions : consumed_once
  inventory_counts ||--|{ inventory_count_lines : contains
  ingredients ||--o{ inventory_count_lines : counted

  units_of_measure {
    uuid id PK
    uuid organization_id FK
    varchar code "kg|g|l|ml|pcs"
    varchar name
    varchar kind "mass|volume|count"
  }
  unit_conversions {
    uuid id PK
    uuid organization_id FK
    uuid from_unit_id FK
    uuid to_unit_id FK
    numeric factor "18,6"
  }
  ingredient_categories {
    uuid id PK
    uuid organization_id FK
    varchar name
    bool is_archived
  }
  ingredients {
    uuid id PK
    uuid organization_id FK
    uuid category_id FK "nullable"
    uuid base_unit_id FK
    varchar name
    varchar sku
    numeric cost_price "per base unit"
    bool is_archived
  }
  stock_balances {
    uuid id PK
    uuid organization_id FK
    uuid branch_id FK
    uuid ingredient_id FK
    numeric quantity
    numeric min_quantity "only here (D §5)"
    xid xmin "concurrency"
  }
  stock_movements {
    uuid id PK
    uuid organization_id FK
    uuid branch_id FK
    uuid ingredient_id FK
    varchar type
    numeric quantity "signed, base unit"
    numeric balance_after
    numeric unit_cost
    varchar source_type "order|purchase|manual|inventory_count"
    uuid source_id
    varchar reason
    timestamptz created_at
  }
  recipes {
    uuid id PK
    uuid organization_id FK
    uuid menu_item_id FK
    uuid variant_id FK "nullable"
    int version
    timestamptz effective_from
    bool is_active
  }
  recipe_ingredients {
    uuid id PK
    uuid recipe_id FK
    uuid ingredient_id FK
    numeric quantity
    uuid unit_id FK
  }
  inventory_consumptions {
    uuid id PK
    uuid organization_id FK
    uuid branch_id FK
    uuid order_id FK,UK
    jsonb recipe_versions_json
    timestamptz created_at
  }
  inventory_counts {
    uuid id PK
    uuid organization_id FK
    uuid branch_id FK
    varchar status "draft|completed"
    varchar comment
    timestamptz completed_at
  }
  inventory_count_lines {
    uuid id PK
    uuid inventory_count_id FK
    uuid ingredient_id FK
    numeric expected_qty
    numeric counted_qty
  }
```

## 6. Procurement

```mermaid
erDiagram
  suppliers ||--o{ purchase_orders : supplies
  purchase_orders ||--|{ purchase_order_items : contains
  ingredients ||--o{ purchase_order_items : ordered
  units_of_measure ||--o{ purchase_order_items : unit

  suppliers {
    uuid id PK
    uuid organization_id FK
    varchar name
    varchar contact_person
    varchar phone
    varchar email
    varchar address
    varchar inn "optional"
    varchar notes
    bool is_archived
  }
  purchase_orders {
    uuid id PK
    uuid organization_id FK
    uuid branch_id FK
    uuid supplier_id FK
    int number "UK with branch_id"
    varchar status "draft|submitted|partially_received|received|cancelled"
    timestamptz expected_at
    numeric total
    varchar comment
  }
  purchase_order_items {
    uuid id PK
    uuid purchase_order_id FK
    uuid ingredient_id FK
    uuid unit_id FK
    numeric quantity
    numeric unit_price
    numeric received_quantity
  }
```

Поступление создаёт `stock_movements` (`type = receipt`, `source_type = purchase`, `source_id = purchase_order_id`).

## 7. Payments & Cash

```mermaid
erDiagram
  branches ||--o{ cash_shifts : has
  cash_shifts ||--o{ payments : collects
  cash_shifts ||--o{ refunds : refunds_in
  orders ||--o{ payments : paid_by
  payments ||--o{ refunds : refunded_by

  cash_shifts {
    uuid id PK
    uuid organization_id FK
    uuid branch_id FK
    uuid opened_by FK
    timestamptz opened_at
    numeric opening_amount
    uuid closed_by FK
    timestamptz closed_at
    numeric expected_cash_amount
    numeric actual_cash_amount
    numeric difference
    varchar status "open|closed"
    varchar comment
  }
  payments {
    uuid id PK
    uuid organization_id FK
    uuid branch_id FK
    uuid order_id FK
    uuid cash_shift_id FK
    varchar method "cash|card|other"
    numeric amount
    numeric refunded_amount
    varchar status "completed|partially_refunded|refunded"
    varchar provider "manual"
    varchar external_reference
    varchar idempotency_key "UK with organization_id"
    uuid created_by
  }
  refunds {
    uuid id PK
    uuid organization_id FK
    uuid branch_id FK
    uuid payment_id FK
    uuid cash_shift_id FK "shift open at refund time (D §2)"
    varchar method "copied from payment (D §2)"
    numeric amount
    varchar reason
    uuid created_by
  }
```

`paidAmount = Σ payments.amount − Σ refunds.amount` (статус платежа информационный); ожидаемая наличность смены =
`opening_amount + Σ cash payments смены − Σ cash refunds смены` (по `refunds.cash_shift_id`).

## 8. Notifications, Audit, Idempotency

```mermaid
erDiagram
  notifications ||--o{ notification_reads : read_by

  notifications {
    uuid id PK
    uuid organization_id FK
    uuid branch_id FK "nullable"
    uuid user_id "recipient, no FK"
    varchar type
    varchar title
    varchar body
    varchar link
    timestamptz created_at
  }
  notification_reads {
    uuid notification_id PK,FK
    uuid user_id PK "no FK"
    timestamptz read_at
  }
  audit_logs {
    uuid id PK
    uuid organization_id "nullable, no FK"
    uuid branch_id "nullable"
    uuid user_id "nullable"
    varchar action
    varchar entity_type
    varchar entity_id "varchar(64)"
    varchar correlation_id
    jsonb changes_json "sanitized"
    varchar ip_address
    timestamptz created_at
  }
  idempotency_records {
    uuid id PK
    varchar key "UK with user_id"
    uuid user_id
    varchar request_hash
    int response_status
    text response_body
    timestamptz created_at
  }
```

Уведомления — одна строка на получателя (`user_id`), без «рассылки по праву» в БД. `audit_logs` — append-only
(нет UPDATE/DELETE в коде); FK на пользователей/организации нет, чтобы журнал переживал изменения справочников.
