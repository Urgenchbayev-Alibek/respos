# Бизнес-правила RestaurantOS (MVP)

Источник: ТЗ (`TECHNICAL_SPECIFICATION.md`) + контракт `respos-contracts/` (v1 → v1.1 `DECISIONS_v1_1.md` → v1.2 `ENDPOINTS.md`).
Документ сверён с реализацией MVP (`respos-backend`, 2026-11-10): все бывшие пункты «не определено» закрыты по
`DECISIONS_v1_1.md` (ссылка **[D §n]**) или по фактическому поведению кода (ссылка **[impl]**).
При расхождении **контракт имеет приоритет**; изменения правил — через `respos-contracts/CHANGELOG.md`.
Пометка **[A: Qn]** — допущение, ожидающее решения владельца в `User-Todo.md`.

Коды ошибок — из `CONVENTIONS.md` (`409 order.invalid_status_transition` и т. д.).

---

## 1. Тенант, филиал, изоляция

- **BR-1.1** Все бизнес-данные принадлежат организации (`OrganizationId`). Филиальные данные дополнительно имеют `BranchId`.
- **BR-1.2** `OrganizationId` берётся только из access token (claim `org`); `BranchId` — только из заголовка `X-Branch-Id`, проверенного по `UserBranchAccess` (owner/admin — все филиалы своей организации).
- **BR-1.3** Значения `organizationId`/`branchId`/`userId` в теле запроса для скоупинга игнорируются.
- **BR-1.4** Нет tenant context → отказ (`401`/`403 tenant.branch_forbidden`).
- **BR-1.5** Чужой ID (другой организации/филиала) → `404` (никогда не раскрывать существование).
- **BR-1.6** Platform Super Admin не видит бизнес-данные ресторанов. Исключение — break-glass (`POST /platform/organizations/{id}/access`, право `platform.tenant-data.access`) с обязательной причиной: JWT на 30 мин с claim `tenant_access=read_only`, без refresh token, только org-права `*.read`, все филиалы, только `GET/HEAD`; каждая выдача — аудит `platform.tenant_access.granted` (ADR-0012) **[impl]**.
- **BR-1.7** Демо-организация помечается `Organization.IsDemo = true`; dashboard возвращает `isDemoData`, UI показывает «Демо-данные».

## 2. Пользователи, роли, права (RBAC)

- **BR-2.1** Права проверяются на backend (`[HasPermission]`) на каждом непубличном endpoint. Скрытие кнопок на frontend — только UX.
- **BR-2.2** Единый каталог прав: `Restaurant.Domain/Constants/Permissions.cs` и зеркало `respos-admin/src/shared/constants/permissions.ts`. Иных мест определения строк прав нет.
- **BR-2.3** Права пользователя = объединение прав его ролей в текущей организации. Для чувствительных операций права загружаются с сервера, а не берутся из токена.
- **BR-2.4** Системные роли (`owner, admin, manager, waiter, cook, cashier, stockkeeper, accountant`) создаются для каждой организации (`IsSystem = true`); их нельзя удалить. Пользовательскую роль можно удалить, только если у неё нет пользователей.
- **BR-2.5** Нельзя деактивировать/заблокировать самого себя и последнего владельца организации.
- **BR-2.6** Статусы пользователя: `invited → active → blocked ⇄ active`, `* → deactivated`. Заблокированный/деактивированный не может войти; при блокировке/деактивации все его refresh tokens отзываются **[impl]**. Статус пользователя глобальный (ограничение L1).
- **BR-2.7** Приглашение действует ограниченное время (`UserInvitation.ExpiresAt`), одноразовое (`AcceptedAt`). В MVP ссылка показывается администратору (email — заглушка) **[A: T6]**.
- **BR-2.8** Лимиты тарифа: создание филиала сверх `Plan.MaxBranches` → `422 plan.limit_exceeded`. То же для пользователей (`MaxUsers`) при `POST /users` и приглашении **[impl]**.

## 3. Аутентификация

- **BR-3.1** Пароль: минимум 8 символов, ≥1 буква и ≥1 цифра. Хранится только стойкий хеш.
- **BR-3.2** Access JWT — 15 минут, только в памяти браузера. Refresh token — httpOnly cookie, ротация при каждом `/auth/refresh`; повторное использование отозванного токена отзывает всё семейство (`FamilyId`). В БД — только SHA-256 хеш (ADR-0003).
- **BR-3.3** Rate limit входа: 5/мин на IP+email → `429 rate_limit.exceeded`. Блокировка аккаунта: 5 неудач подряд → 15 мин (`auth.account_locked`; настройки `Auth:MaxFailedLoginAttempts`, `Auth:LockoutMinutes`) **[D §12]**.
- **BR-3.4** `POST /auth/forgot-password` всегда отвечает `202`, не раскрывая существование аккаунта. Токен сброса одноразовый, ограничен по времени.

## 4. Столики и зоны

- **BR-4.1** Статусы столика: `available | occupied | reserved | unavailable`. Статус столика не заменяет статус заказа.
- **BR-4.2** Вручную (`POST /tables/{id}/status`) можно ставить только `available`/`unavailable` (иначе `400 table.invalid_status`). `occupied` ставится при создании dine-in заказа на стол и при `seat` брони. Статус `reserved` в MVP автоматически **не** выставляется — ближайшая подтверждённая бронь на сегодня показывается подсказкой `TableDto.nextReservation` **[D §12]**.
- **BR-4.3** Когда последний активный заказ стола оплачен, отменён или перенесён на другой стол, стол → `available` (если на нём нет другого активного заказа) **[impl]**.
- **BR-4.4** Номер стола уникален в филиале среди неархивных столов.
- **BR-4.5** Удаление стола/зоны = архивирование (`IsArchived`), если есть история заказов.
- **BR-4.6** Перенос заказа на другой стол — право `orders.transfer`, запись в аудит; только для `dine_in` (`422 order.not_dine_in`); целевой стол — неархивный, активный и не `unavailable` (`422 table.unavailable`); старый стол освобождается, новый → `occupied` **[impl]**.

## 5. Бронирования

- **BR-5.1** Статусы: `pending → confirmed → seated → completed`; `pending|confirmed → cancelled`; `pending|confirmed → no_show`. Прочие переходы → `409`.
- **BR-5.2** Для одного стола активные брони (`pending|confirmed|seated`) не пересекаются по полуинтервалу `[StartsAt, EndsAt)` → `409 reservation.time_conflict`. Соседние брони (конец = начало) допустимы.
- **BR-5.3** `EndsAt > StartsAt`; `GuestCount ≥ 1`. Превышение `Capacity` стола сервером не проверяется (не ошибка) **[impl]**.
- **BR-5.4** Бронь без стола (только `PreferredAreaId`) не участвует в проверке пересечений до назначения стола.
- **BR-5.5** Время хранится в UTC; дата в фильтрах (`date=YYYY-MM-DD`) интерпретируется в timezone филиала (default `Asia/Tashkent`).
- **BR-5.6** Подтверждение брони статус стола не меняет; `seat` — только из `confirmed` и только при назначенном столе (`reservation.table_required`), стол → `occupied`; `complete`/`no_show`/`cancel` → стол `available`, если на нём нет активного заказа. Фоновой проверки «окна брони» в MVP нет **[D §12]**.
- **BR-5.7** Детали брони (время, стол, гость) редактируются только в `pending|confirmed` (`reservation.not_editable`) **[impl]**.

## 6. Меню

- **BR-6.1** Меню — на уровне организации; категории/блюда/опции с историей не удаляются, а архивируются.
- **BR-6.2** Заказ хранит snapshot: название, вариант, цена, модификаторы (имя + `PriceDelta`). Изменение меню не меняет исторические заказы.
- **BR-6.3** Цена позиции: `UnitPrice = Variant.Price`, если выбран вариант (абсолютная цена), иначе `MenuItem.Price`.
- **BR-6.4** Модификаторы: число выбранных опций группы ∈ `[MinSelect, MaxSelect]`; `IsRequired` ⇒ `MinSelect ≥ 1`. Нарушение → `400 validation.failed`.
- **BR-6.5** В заказ нельзя добавить архивное, недоступное (`IsAvailable = false`) или вне `MenuAvailability` (время филиала) блюдо → `422 order.menu_item_unavailable` **[impl]**. `KitchenStationId` и `IsAvailable` — на уровне организации (ограничение L3) **[D §7]**.

## 7. Заказы — статусы и переходы

- **BR-7.1** Типы: `dine_in` (требует `TableId`), `takeaway` (без стола) **[A: Q1]**.
- **BR-7.2** Статусы заказа: `draft → submitted → in_progress → partially_ready → ready → served → paid`; `cancelled`.
- **BR-7.3** Статусы меняются только доменными методами; недопустимый переход → `409 order.invalid_status_transition`. Каждый переход пишется в `OrderStatusHistory`. `paid` и `cancelled` — терминальные; изменение закрытого заказа → `409 order.closed`.
- **BR-7.4** Статусы позиций: `new → sent → preparing → ready → served`; `cancelled`. Статусы заказа и позиций разделены.
- **BR-7.5** Нетерминальный статус заказа **пересчитывается из активных (не отменённых) позиций** после каждого изменения позиций (добавление, отправка, кухня, подача, отмена позиции) **[D §4]**: все `new` (ничего не отправлено) → `draft`; все `served` → `served`; все `ready|served` (≥1 `ready`) → `ready`; часть `ready|served` → `partially_ready`; любая `preparing` → `in_progress`; иначе (`sent`) → `submitted`.
- **BR-7.6** Добавление позиций разрешено до `paid`/`cancelled`. Новая позиция — `new`; заказ может «откатиться» (например `ready` → `partially_ready`/`in_progress`); recall тикета (`ready → in_progress`) — аналогично **[D §4]**.
- **BR-7.7** Отправка на кухню (`send-to-kitchen`, Idempotency-Key): все `new` позиции (или указанные; нет таких → `422 order.nothing_to_send`) группируются по станции → один `KitchenTicket` на станцию на отправку. Позиции без станции (или с неактивной станцией) → станция филиала по умолчанию (первая активная по `SortOrder`). `KitchenTicket.Number` — номер «раунда» отправки внутри заказа (1, 2, …), общий для тикетов одной отправки **[impl]**.
- **BR-7.8** Изменение позиции (`quantity`, `comment`) — только в статусе `new` (`409 order.item_not_editable`). Отмена позиции (причина обязательна): `new` — `orders.update` или `orders.cancel`; отправленной — только `orders.cancel` (иначе `403`), её позиция тикета отменяется. Отмена позиции, после которой `total < paidAmount`, → `422 order.has_payments` **[impl]**.
- **BR-7.9** Отмена заказа: из любого нетерминального статуса, право `orders.cancel`, причина обязательна, только если `paidAmount == 0` — иначе `422 order.has_payments` (сначала возврат). Отменяет открытые тикеты, освобождает стол **[D §4]**.
- **BR-7.10** Номер заказа — последовательный в филиале в пределах бизнес-дня: `Order.BusinessDate` (дата в timezone филиала), уникальность `(BranchId, BusinessDate, Number)`; при гонке номер пересчитывается и вставка повторяется. Отображается `#0042` **[D §1]**.
- **BR-7.11** Конкурентные изменения защищены `RowVersion` (`xmin`); конфликт → `409`.

## 8. Расчёт денег

- **BR-8.1** Деньги — `decimal(18,2)` / `numeric(18,2)`; количества — `decimal(18,3)`. `float/double` запрещены.
- **BR-8.2** Расчёт только на сервере (frontend может показывать предпросмотр, результат сервера главнее):

```
lineTotal      = (unitPrice + Σ modifier.priceDelta) × quantity      // отменённые позиции исключаются
subtotal       = Σ lineTotal
discountAmount = скидка (фикс. сумма или % от subtotal), ≤ subtotal
serviceCharge  = round((subtotal − discountAmount) × serviceChargePercent / 100, 2)
tax            = round((subtotal − discountAmount + serviceCharge) × taxPercent / 100, 2)
total          = subtotal − discountAmount + serviceCharge + tax
paidAmount     = Σ payment.amount − Σ refund.amount            // статус платежа информационный [D §2]
remainingAmount= total − paidAmount
```

- **BR-8.3** Округление: 2 знака, `MidpointRounding.AwayFromZero` (`Money.Round`/`Money.Percent`); `lineTotal` и `discountAmount` (в т. ч. процентная) также округляются до 2 знаков **[impl]**.
- **BR-8.4** `serviceChargePercent` и `taxPercent` — настройки филиала, по умолчанию 0%; налог начисляется сверху **[A: Q12]** (не выяснено, входит ли НДС в цены меню).
- **BR-8.5** Валюта — настройка организации (`UZS` по умолчанию). Формат отображения — единая функция `formatCurrency`.

## 9. Скидки

- **BR-9.1** Скидка на заказ: `none | amount | percent`, право `orders.discount.apply`, причина обязательна, запись в аудит.
- **BR-9.2** `percent ∈ [0, 100]`; `amount ≥ 0` (иначе `400 order.invalid_discount`); итоговая `discountAmount` ограничивается `subtotal`.
- **BR-9.3** Скидка на позицию и программы лояльности — вне MVP.
- **BR-9.4** Изменение скидки после частичной оплаты разрешено, если новый `total ≥ paidAmount`; иначе `400 order.invalid_discount`. На закрытом заказе — `409 order.closed` **[impl]**.

## 10. Платежи, частичная оплата, возвраты

- **BR-10.1** Способы: `cash | card | other` **[A: Q4]**. Провайдер в MVP — только `manual` (`ManualPaymentProvider`), UI: «Ручная отметка (демо)» **[A: Q5]**. Данные карт не хранятся.
- **BR-10.2** Платёж требует открытой кассовой смены филиала (`422 cash_shift.not_open`); `CashShiftId` записывается в платёж.
- **BR-10.3** `amount > 0` и `amount ≤ remainingAmount` (переплата → `422 payment.exceeds_due`; сдача для наличных считается на клиенте как подсказка).
- **BR-10.4** Частичная оплата разрешена: несколько платежей разными способами **[A: Q13]**. Разделение счёта по позициям — после MVP.
- **BR-10.5** `POST /payments` требует `Idempotency-Key`; повтор с тем же ключом тем же пользователем → тот же ответ (24 ч), без второго платежа. Тот же ключ у другого пользователя организации → `409 payment.duplicate` (unique `(OrganizationId, IdempotencyKey)`, ADR-0013).
- **BR-10.6** Когда `paidAmount == total`: заказ → `paid` (`ClosedAt`), стол → `available`, публикуется `OrderPaidDomainEvent` (триггер списания, §13). Всё — в одной транзакции; realtime-события — после commit.
- **BR-10.7** Оплата разрешена в любом нетерминальном статусе, включая `draft` (takeaway «сначала оплата»); `cancelled`/`paid` → `409 order.invalid_status_transition`. Тикеты оплаченного заказа продолжают обрабатываться кухней, подача позиций разрешена **[D §4]**.
- **BR-10.8** Возврат: право `payments.refund`, причина обязательна, `amount ≤ payment.amount − refundedAmount`, Idempotency-Key, аудит. Статус платежа → `partially_refunded | refunded`. Возврат записывается в **текущую открытую смену** (`Refund.CashShiftId`; нет смены → `422 cash_shift.not_open`) с методом исходного платежа (`Refund.Method`); `Order.PaidAmount` уменьшается **[D §2]**.
- **BR-10.9** Возврат не возвращает ингредиенты на склад (ADR-0006) и не меняет статус `paid` (MVP) **[D §4]**.
- **BR-10.10** Пречек (`/orders/{id}/receipt`) помечается «Не является фискальным чеком» **[A: Q6]**.

## 11. Кассовые смены

- **BR-11.1** В филиале одновременно открыта максимум **одна** смена. Повторное открытие → `409`.
- **BR-11.2** Открытие: `openingAmount ≥ 0`, право `cash-shifts.open`.
- **BR-11.3** Закрытие: право `cash-shifts.close`, ввод `actualCashAmount`.
  `expectedCash = openingAmount + Σ cash payments смены − Σ cash refunds смены`; `difference = actual − expected`. Возвраты учитываются в смене, где сделаны, а не в смене платежа **[D §2]**. Комментарий необязателен (до 1000 символов) **[impl]**.
- **BR-11.4** Закрытая смена не изменяется (`409 cash_shift.closed`). Закрытие смены при неоплаченных заказах разрешено (заказы не привязаны к смене) **[impl]**.

## 12. Склад: остатки и движения

- **BR-12.1** Остаток (`StockBalance`) меняется **только** вместе с `StockMovement` в одной транзакции. `BalanceAfter` фиксируется в движении.
- **BR-12.2** Типы движений: `receipt | consumption | write_off | adjustment | inventory_count | transfer_in | transfer_out`; `Quantity` — со знаком, в базовой единице ингредиента.
- **BR-12.3** Ручные движения (`write_off`, `adjustment`) не могут увести остаток в минус, если `AllowNegativeStock = false` → `409 stock.insufficient` **[A: Q8]**.
- **BR-12.4** Списание по продаже **может** увести в минус (продажа уже состоялась) → уведомление `stock_low` + аудит **[A: Q8]**.
- **BR-12.5** При остатке ≤ `MinQuantity` создаётся уведомление `stock_low` и событие `StockLow`.
- **BR-12.6** Единицы конвертируются через `UnitConversion.Factor` в базовую единицу; нет конверсии при сохранении рецептуры/закупки → `422 unit.conversion_missing` **[impl]**.
- **BR-12.7** Инвентаризация: `draft` (снимок `ExpectedQty`) → `completed`; при завершении для каждой строки с `CountedQty ≠ ExpectedQty` создаётся движение `inventory_count` на разницу. Завершённая не редактируется.
- **BR-12.8** Ручные корректировки требуют причины и права `inventory.adjust`; пишутся в аудит.

## 13. Рецептуры и списание ингредиентов

- **BR-13.1** Рецептура привязана к блюду (и опционально варианту); версии — новые строки; активна только одна версия на `(MenuItemId, VariantId)`. Старые версии хранятся.
- **BR-13.2** Событие списания — **полная оплата заказа** (`InventoryConsumptionTrigger = on_payment`, единственное значение в MVP) **[A: Q7]**. На других этапах (отправка, готовность) списание не выполняется.
- **BR-13.3** Идемпотентность: уникальный `InventoryConsumption.OrderId`. Повторная обработка события не создаёт новых движений (конфликт уникальности = «уже списано», не ошибка). Списание — в той же транзакции, что и платёж (обработчик доменного события до commit).
- **BR-13.4** Количество = `RecipeIngredient.Quantity × OrderItem.Quantity` (конвертация в базовую единицу), по активной на момент оплаты версии; версии фиксируются в `RecipeVersionsJson`. Изменение рецептуры не переписывает исторический расход.
- **BR-13.5** Выбор рецептуры: активная версия для варианта, иначе активная версия блюда без варианта. Отменённые позиции не списываются. Блюда без рецептуры и ингредиенты без конверсии единиц не списываются (без ошибки, warning в логе). Уход в минус при продаже — аудит `stock.negative_after_sale` **[impl]**.
- **BR-13.6** Модификаторы не влияют на списание в MVP **[impl]**.

## 14. Поставщики и закупки

- **BR-14.1** Статусы закупки: `draft → submitted → partially_received → received`; `draft|submitted → cancelled`. Прочие → `409`.
- **BR-14.2** Редактировать можно только `draft`.
- **BR-14.3** Приёмка (`purchases.receive`, Idempotency-Key): для каждой строки принятое количество > 0 (`400 purchase.invalid_receive_quantity`) и не больше остатка строки (`422 purchase.receive_exceeds_remaining`; пере-приёмки нет) **[impl]**; создаётся движение `receipt` (в базовой единице), обновляется `Ingredient.CostPrice` (последняя цена закупки за базовую единицу). Все строки приняты полностью → `received`, иначе `partially_received`.
- **BR-14.4** После приёмки создаётся уведомление `purchase_received`.
- **BR-14.5** Поставщик с историей закупок — только архивирование.

## 15. Кухня (KDS)

- **BR-15.1** Статусы тикета: `new → in_progress → ready → served`; `cancelled`. `recall`: `ready → in_progress`.
- **BR-15.2** Статусы позиции тикета: `new|preparing|ready|cancelled` (подача отслеживается только на `OrderItem`). Соответствие: ticket item `new` ↔ order item `sent`, `preparing` ↔ `preparing`, `ready` ↔ `ready`. Изменение тикета/позиции пересчитывает статус заказа (BR-7.5) **[D §3]**.
- **BR-15.3** Тикеты сортируются по `createdAt` (старые выше). Цвет таймера ожидания — см. `DESIGN_SYSTEM.md`.
- **BR-15.4** SignalR только уведомляет; после события и после каждого reconnect клиент перезапрашивает тикеты по REST.

## 16. Архивирование vs удаление

- **BR-16.1** Сущности, на которые ссылается история (блюда, категории, опции, столы, зоны, ингредиенты, поставщики, станции, пользователи), не удаляются физически — `IsArchived`/`IsActive = false`/`deactivated`.
- **BR-16.2** Физическое удаление разрешено только для объектов без истории (например, пользовательская роль без пользователей, `draft`-сущности без ссылок).
- **BR-16.3** Архивные объекты не показываются в рабочих списках (`includeArchived=false` по умолчанию), но отображаются в истории.
- **BR-16.4** `AuditLog`, `StockMovement`, `OrderStatusHistory`, `Payment`, `Refund` — append-only (не изменяются и не удаляются через API).

## 17. Аудит и уведомления

- **BR-17.1** Аудируются: вход/выход и неудачные входы, изменения пользователей/ролей/прав, отмена заказа/позиции, скидки, перенос, платежи, возвраты, смены, ручные складские движения, инвентаризация, приёмка, изменения настроек, действия platform admin и break-glass.
- **BR-17.2** Запись аудита: пользователь, организация, филиал, действие, сущность, ID, время, `CorrelationId`, безопасное описание (без паролей, токенов, платёжных секретов, избыточных ПДн).
- **BR-17.3** Уведомления: `order_new | order_status | order_ready | stock_low | purchase_received | integration_error | system`; прочитанность — на пользователя, одна строка на получателя. Получатели **[impl]**: `order_new` — сотрудники филиала с `kitchen.status.update` (кроме автора; официантам не шлётся); `order_ready` — официант заказа; `stock_low` — пользователи филиала с `inventory.read`; `purchase_received` — с `purchases.read` (кроме автора).

## 18. Идемпотентность критических команд

- **BR-18.1** `Idempotency-Key` обязателен для: `POST /payments`, `POST /payments/{id}/refunds`, `POST /orders/{id}/send-to-kitchen`, `POST /purchases/{id}/receive`.
- **BR-18.2** Ключ — UUID (нет/невалиден → `400 idempotency.key_required`). Тот же ключ + тот же пользователь + то же тело → сохранённый 2xx-ответ (24 ч) с заголовком `Idempotent-Replayed: true`. Тот же ключ с другим телом → `422 idempotency.key_reused`; параллельный дубль в процессе → `409 idempotency.in_progress` **[impl]**.
- **BR-18.3** Страховка на уровне БД: unique `Payment (OrganizationId, IdempotencyKey)`, unique `InventoryConsumption.OrderId` (ADR-0013) **[D §8]**.

---

## Сводка открытых вопросов, влияющих на правила

| Правило | Вопрос |
|---|---|
| BR-7.1 | Q1 — takeaway/delivery |
| BR-8.4, §9 | Q12 — налог, сервисный сбор, скидки |
| §10 | Q4, Q5, Q6, Q13 |
| BR-12.3/12.4 | Q8 — отрицательные остатки |
| §13 | Q7 — момент списания |
| BR-2.7 | T6 — email-провайдер |

Открытых пунктов «не определено» не осталось. Известные ограничения MVP — `User-Todo.md` §D; статус несоответствий модели данных — `docs/database/ERD_CONSTRAINTS.md` §12.
