# RestaurantOS — ERD (часть 3): ограничения, индексы, инварианты

Сверено с `AppDbContextModelSnapshot.cs` (миграция `InitialCreate`). Обозначения scope: G — глобальная, O — `organization_id`,
B — `organization_id` + `branch_id`, C — дочерняя (через корень агрегата, без `organization_id`).

> Модель данных разделена на 3 файла: [ERD.md](ERD.md) (соглашения, Identity/SaaS, Floor, Menu, Orders & Kitchen) ·
> [ERD_INVENTORY_PAYMENTS.md](ERD_INVENTORY_PAYMENTS.md) (Inventory, Procurement, Payments, Notifications/Audit) ·
> [ERD_CONSTRAINTS.md](ERD_CONSTRAINTS.md) (scope, уникальные ограничения, удаление, индексы, инварианты, решённые вопросы).

## 9. Scope, уникальные ограничения, удаление

«UK» — unique index в БД. «(код)» — правило проверяется только приложением, индекса нет.

| Таблица | Scope | Уникальность | Удаление / FK |
|---|---|---|---|
| organizations | G | UK `slug` | не удаляется (`status = suspended/closed`) |
| branches | O | — | деактивация `is_active` |
| branch_settings | B | UK `branch_id` (PK — `id`) | **CASCADE** от branches |
| users | G | UK `email` | деактивация `status` |
| user_organizations | O | UK `(user_id, organization_id)` | `is_active = false` |
| roles | O | UK `(organization_id, code)` | DELETE только несистемной без пользователей |
| permissions | G | PK `code` | синхронизируется сидером |
| role_permissions | C (Role) | PK `(role_id, permission_code)` | **CASCADE** от roles и permissions |
| user_roles | O | PK `(user_id, role_id)` | DELETE при снятии роли |
| user_branch_accesses | O | PK `(user_id, branch_id)` | DELETE при снятии доступа |
| refresh_tokens | G (+`organization_id` nullable) | UK `token_hash` | отзыв `revoked_at`; очистки job-ом нет |
| user_invitations | O | UK `token_hash` | истекают (`expires_at`), одноразовые (`accepted_at`) |
| password_reset_tokens | G | UK `token_hash` | одноразовые (`used_at`) |
| plans | G | UK `code` | `is_active = false` |
| features | G | PK `code` | — |
| plan_features | C (Plan) | PK `(plan_id, feature_code)` | **CASCADE** от plans и features |
| subscriptions | O | — (одна активная — код) | история хранится |
| feature_flags | O / G | UK `(organization_id, feature_code)` (NULLs distinct — уникальность глобальных флагов БД не гарантирует) | DELETE |
| billing_events, demo_requests | O / G | — | хранятся |
| dining_areas | B | — | архив |
| dining_tables | B | UK `(branch_id, number)` WHERE `is_archived = false` | архив |
| table_reservations | B | — (пересечения — код, §10) | статус `cancelled` |
| kitchen_stations | B | — | архив / `is_active` |
| menu_categories, modifier_groups | O | — | архив |
| menu_items | O | — (SKU не уникален в БД) | архив |
| menu_item_variants | C (MenuItem) | — | архив; **CASCADE** от menu_items |
| menu_item_modifier_groups | C | PK `(menu_item_id, modifier_group_id)` | **CASCADE** от menu_items; RESTRICT от modifier_groups |
| modifier_options | C (Group) | — | архив; **CASCADE** от modifier_groups |
| menu_availabilities | C (MenuItem) | — | **CASCADE** от menu_items |
| orders | B | UK `(branch_id, business_date, number)` | не удаляются (`cancelled`) |
| order_items | C (Order) | — | статус `cancelled`; **CASCADE** от orders (технически) |
| order_item_modifiers | C (OrderItem) | — | **CASCADE** от order_items |
| order_status_history | C (Order) | — | append-only; **CASCADE** от orders |
| kitchen_tickets | B | — (индекс `(order_id, kitchen_station_id, number)` не уникальный) | статус `cancelled` |
| kitchen_ticket_items | C (Ticket) | — | **CASCADE** от kitchen_tickets |
| units_of_measure | O | UK `(organization_id, code)` | RESTRICT |
| unit_conversions | O | UK `(from_unit_id, to_unit_id)` | DELETE |
| ingredient_categories | O | — | архив |
| ingredients | O | — | архив |
| stock_balances | B | UK `(branch_id, ingredient_id)` | не удаляется |
| stock_movements | B | — | append-only |
| recipes | O | UK `(menu_item_id, variant_id, version)`; одна активная: UK `(menu_item_id)` WHERE `is_active AND variant_id IS NULL` + UK `(menu_item_id, variant_id)` WHERE `is_active AND variant_id IS NOT NULL` | история хранится |
| recipe_ingredients | C (Recipe) | — | **CASCADE** от recipes |
| inventory_consumptions | B | UK **`order_id`** (идемпотентность) | не удаляется |
| inventory_counts | B | — | completed не меняется |
| inventory_count_lines | C | UK `(inventory_count_id, ingredient_id)` | **CASCADE** от inventory_counts |
| suppliers | O | — | архив |
| purchase_orders | B | UK `(branch_id, number)` | `cancelled` |
| purchase_order_items | C (PO) | — | **CASCADE** от purchase_orders |
| cash_shifts | B | одна открытая на филиал: UK `(branch_id)` WHERE `status = 'open'` | не удаляется |
| payments | B | UK `(organization_id, idempotency_key)` | не удаляется (refund) |
| refunds | B | — | не удаляется |
| notifications | O (+`branch_id` nullable) | — | очистки job-ом нет |
| notification_reads | C | PK `(notification_id, user_id)` | **CASCADE** от notifications |
| audit_logs | O (nullable, без FK) | — | append-only |
| idempotency_records | G (по `user_id`) | UK `(key, user_id)` | TTL 24 ч: просроченная запись удаляется при повторном обращении с тем же ключом (фоновой очистки нет) |

Все остальные FK — `RESTRICT`. CHECK constraints и exclusion constraints в миграции нет.

## 10. Индексы для частых запросов (фактические)

- Каждая O/B-таблица: индекс `organization_id`; B-таблицы — ещё `(organization_id, branch_id)`.
- `orders`: `(branch_id, status)`, `(branch_id, opened_at)`, `table_id`, `waiter_id`.
- `order_items`: `order_id`, `menu_item_id`, `variant_id`, `kitchen_station_id`.
- `kitchen_tickets`: `(branch_id, status, created_at)`, `(order_id, kitchen_station_id, number)`; `kitchen_ticket_items`: `ticket_id`, `order_item_id`.
- `dining_tables`: `(branch_id, status)`, `dining_area_id`.
- `table_reservations`: `(table_id, starts_at)`, `(branch_id, starts_at)`. Пересечения проверяются в коде (полуинтервал
  `[starts_at, ends_at)`, `409 reservation.time_conflict`); exclusion constraint (`btree_gist`) — возможное усиление позже.
- `stock_movements`: `(branch_id, ingredient_id, created_at)`, `(branch_id, created_at)`, `(source_type, source_id)`.
- `payments`: `(branch_id, created_at)`, `order_id`, `cash_shift_id`; `refunds`: `payment_id`, `cash_shift_id`.
- `cash_shifts`: `(branch_id, opened_at)`; `purchase_orders`: `(branch_id, status)`, `supplier_id`.
- `audit_logs`: `(organization_id, created_at)`, `(entity_type, entity_id)`, `action`.
- `notifications`: `(organization_id, branch_id, created_at)`, `user_id`; `notification_reads`: `user_id`.
- `menu_items`: `(organization_id, category_id)`; `users`: UK `email`, `status`; `idempotency_records`: `created_at`.

## 11. Транзакционные инварианты

1. `stock_balances.quantity` меняется только вместе со вставкой `stock_movements` (одна транзакция, `balance_after` = новое значение).
2. Оплата: `payments` + `orders.paid_amount/status` + (при полной оплате) `inventory_consumptions` + `stock_movements` +
   `dining_tables.status` — один `SaveChanges` (обработчики доменных событий выполняются до commit, outbox нет; ADR-0006).
3. Поступление закупки: `purchase_order_items.received_quantity` + `stock_movements(receipt)` + `stock_balances` +
   `ingredients.cost_price` + статус PO — одна транзакция.
4. Номер заказа: `max(number)+1` в `(branch_id, business_date)`; при нарушении UK — перенумерация и повтор (до 5 попыток).
5. `kitchen_tickets.number` — номер отправки внутри заказа: `max(number)+1` по `order_id`, общий для тикетов одной отправки.

## 12. Вопросы / несоответствия контракту — статус

Все пункты исходного ревью закрыты контрактом v1.1 (`respos-contracts/DECISIONS_v1_1.md`, далее D) и реализацией.

| # | Вопрос | Статус |
|---|---|---|
| 1 | `Order.BusinessDate` отсутствовал | ✅ Решено (D §1): `orders.business_date date`, UK `(branch_id, business_date, number)` |
| 2 | `Refund.CashShiftId` / метод возврата | ✅ Решено (D §2): `refunds.cash_shift_id` (смена на момент возврата) и `refunds.method` (из платежа) |
| 3 | `MenuItemVariant` PriceDelta vs Price | ✅ Решено (D §5): только абсолютный `price` |
| 4 | `MenuItem.KitchenStationId` org vs branch | ⏳ Принято как ограничение MVP (D §7, User-Todo L3/Q2): org-level; per-branch настройки позже |
| 5 | `MenuItem.IsAvailable` org-уровень | ⏳ То же (D §7) |
| 6 | `MinQuantity` у Ingredient и StockBalance | ✅ Решено (D §5): только `stock_balances.min_quantity` |
| 7 | Дочерние таблицы без `OrganizationId` | ✅ Решено (D §6): scope через корень агрегата, без `organization_id` |
| 8 | `UserInvitation.RoleIds/BranchIds` без FK | ✅ Принято: `uuid[]`, целостность проверяется кодом при приёме приглашения |
| 9 | Разные семейства статусов (`served` у Order/Ticket, нет у TicketItem) | ✅ Решено (D §3): семейства различаются намеренно, есть таблица соответствия |
| 10 | Две области уникальности idempotency | ✅ Решено (D §8, ADR-0013): HTTP replay `(key, user_id)` + DB safety net `(organization_id, idempotency_key)` → `409 payment.duplicate` |
| 11 | `AuditLog.EntityId` — text | ✅ `varchar(64)` |
| 12 | Refund не возвращает ингредиенты | ✅ Решено (D §4, BR-10.9): не возвращает, статус `paid` не меняется |

Дополнительно: ограничения из ранней версии документа, которых в реальной БД **нет**, — уникальность SKU блюд/ингредиентов,
partial unique «одна активная подписка», exclusion constraint броней (пересечения проверяет код), CHECK-ограничения enum,
`NULLS NOT DISTINCT` для глобальных feature flags. При необходимости — отдельной миграцией.
