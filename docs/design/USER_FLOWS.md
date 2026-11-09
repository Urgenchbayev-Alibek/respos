# User Flows

Сценарии согласованы с `respos-contracts/` (ENDPOINTS, REALTIME, CONVENTIONS). Эндпоинты указаны относительно `/api/v1`.

## 1. Вход и выбор рабочего пространства

```mermaid
flowchart TD
    A[Открыть приложение] --> B{Access token в памяти?}
    B -- нет --> C[POST /auth/refresh по httpOnly cookie]
    C -- 200 --> D[GET /auth/me]
    C -- 401 --> L[Экран входа]
    B -- да --> D
    L --> L1[Email + пароль, язык RU/UZ]
    L1 --> L2[POST /auth/login]
    L2 -- 401 --> L3[«Неверный email или пароль»] --> L1
    L2 -- 429 --> L4[«Слишком много попыток, подождите»] --> L1
    L2 -- 200 --> D
    D --> E{isPlatformAdmin и нет org?}
    E -- да --> P[/platform/organizations/]
    E -- нет --> F{Несколько организаций?}
    F -- да --> F1[Переключатель организации в шапке<br/>POST /auth/switch-organization]
    F1 --> G
    F -- нет --> G{Доступных филиалов > 1?}
    G -- да --> G1[Выбор филиала → X-Branch-Id]
    G -- нет --> H
    G1 --> H{Доступных workspace > 1?}
    H -- да --> H1[Экран выбора workspace:<br/>Админ · Официант · Кухня · Касса · Склад]
    H -- нет --> W[Workspace по умолчанию для роли]
    H1 --> W
```

Доступность workspace вычисляется по `permissions` из `MeDto`: Admin — `reports.read` или `settings.manage`,
Waiter — `orders.create`, KDS — `kitchen.read`, Cashier — `payments.create`, Stock — `inventory.read`.
Последний выбор workspace и филиала можно запомнить в `localStorage` (не секрет); токены — никогда.

## 2. Официант: заказ

```mermaid
flowchart TD
    A[/waiter: план зала/] --> B[Тап по свободному столу]
    B --> C[Гостей: 1-8 быстрые кнопки]
    C --> D[POST /orders type=dine_in → draft<br/>стол → occupied]
    D --> E[Экран заказа: категории / поиск]
    E --> F[Тап по блюду]
    F --> G{Обязательные модификаторы<br/>или варианты?}
    G -- да --> G1[Bottom sheet: вариант, модификаторы, комментарий] --> H
    G -- нет --> H[Позиция +1 в чеке, статус new]
    H --> E
    H --> I[«На кухню» primary]
    I --> J[POST /orders/:id/send-to-kitchen<br/>Idempotency-Key]
    J -- 200 --> K[Тикеты по станциям, заказ submitted,<br/>позиции sent]
    J -- 409 --> J1[Статус изменился → refetch]
    K --> M[SignalR OrderItemReady → toast «Стол 7: Плов готов»]
    M --> N[Отметить «Подано» → served]
    N --> O[Дозаказ: снова E → «На кухню» отправляет только new]
```

Открытый стол (occupied) открывает текущий заказ (`activeOrderId` из `TableDto`). Отмена отправленной
позиции требует `orders.cancel` и причину.

## 3. Кухня (KDS)

```mermaid
sequenceDiagram
    participant K as KDS
    participant API as REST API
    participant Hub as SignalR /hubs/restaurant
    K->>API: GET /kitchen/tickets?stationId=
    K->>Hub: connect (?access_token) + JoinKitchenStation(branchId, stationId)
    Hub-->>K: KitchenTicketCreated {ticketId}
    K->>API: GET /kitchen/tickets (refetch)
    Note over K: Новая карточка + звук, таймер ожидания
    K->>API: POST /kitchen/tickets/:id/start
    API-->>K: 200 (in_progress)
    K->>API: POST /kitchen/ticket-items/:id/ready (по позиции) или /tickets/:id/ready
    API->>Hub: OrderItemReady / OrderUpdated (после commit)
    Note over K,Hub: Потеря соединения → индикатор «Переподключение…»
    Hub-->>K: onreconnected
    K->>Hub: JoinKitchenStation снова
    K->>API: GET /kitchen/tickets (обязательно)
```

Ошибочно отмеченное готовым — `POST /kitchen/tickets/:id/recall` (ready → in_progress).

## 4. Оплата и списание ингредиентов

```mermaid
flowchart TD
    A[/cashier/] --> B{Открыта смена?<br/>GET /cash-shifts/current}
    B -- 204 --> B1[«Открыть смену»: сумма в кассе<br/>POST /cash-shifts/open] --> C
    B -- 200 --> C[Список заказов к оплате]
    C --> D[Выбрать заказ: позиции, скидка, итог, остаток]
    D --> E[Способ: Наличные / Карта / Другое<br/>сумма = остаток по умолчанию]
    E --> F[POST /payments + Idempotency-Key]
    F -- 409 payment.duplicate --> F1[Показать уже проведённый платёж]
    F -- 422 нет смены / сумма > остатка --> E
    F -- 200 --> G{PaidAmount == Total?}
    G -- нет: частичная оплата --> D
    G -- да --> H[Заказ paid, стол available]
    H --> I[OrderPaidDomainEvent]
    I --> J{InventoryConsumption с этим OrderId есть?}
    J -- да --> J1[Ничего не делать — идемпотентно]
    J -- нет --> K[По активным рецептурам: StockMovement consumption<br/>+ StockBalance в одной транзакции<br/>+ InventoryConsumption unique OrderId]
    K --> L{Остаток < min или < 0?}
    L -- да --> L1[Notification stock_low + StockLow SignalR + аудит]
```

Сдача для наличных считается на клиенте только для информации (переплата в MVP запрещена).
Возврат: `POST /payments/:id/refunds` (право `payments.refund`, причина обязательна, ConfirmDialog).
Повторное списание при возврате/повторной оплате не выполняется (Q7).

## 5. Приёмка закупки

```mermaid
flowchart TD
    A[/stock/purchases/] --> B[Новая закупка draft: поставщик, строки]
    B --> C[POST /purchases/:id/submit → submitted]
    C --> D[Поставка пришла: «Принять»]
    D --> E[Форма: по каждой строке принятое кол-во<br/>по умолчанию = заказано − принято]
    E --> F[POST /purchases/:id/receive + Idempotency-Key]
    F --> G[StockMovement receipt на каждую строку,<br/>обновить CostPrice]
    G --> H{Все строки приняты полностью?}
    H -- да --> I[received]
    H -- нет --> J[partially_received → можно принять остаток позже]
    G --> K[Notification purchase_received]
```

## 6. Бронирование

```mermaid
flowchart TD
    A[/admin/reservations или /waiter/] --> B[«Новая бронь»: дата, с-по, гостей, имя, телефон]
    B --> C[Выбрать стол или зону-предпочтение]
    C --> D[POST /reservations]
    D -- 409 reservation.time_conflict --> E[«Стол занят в это время» + подсветка пересечения<br/>предложить другой стол] --> C
    D -- 201 --> F[pending]
    F --> G[confirm → confirmed]
    G --> H[Гости пришли: seat → seated, стол occupied/заказ]
    G --> I[cancel причина / no-show]
    H --> J[complete → completed]
```

Пересечение проверяется на сервере для активных статусов `pending|confirmed|seated` по `[StartsAt, EndsAt)`.

## 7. Приглашение сотрудника

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin UI
    participant API
    actor Emp as Сотрудник
    Admin->>UI: Users → «Пригласить»: email, ФИО, роли, филиалы
    UI->>API: POST /users/invitations
    API-->>UI: { invitationId, inviteLink }
    Note over UI: Email — заглушка (T6): ссылка показывается админу<br/>с кнопкой «Скопировать» (только dev/demo)
    Admin-->>Emp: Передаёт ссылку
    Emp->>UI: /accept-invitation?token=
    UI->>API: POST /auth/accept-invitation { token, fullName, password }
    API-->>UI: 200 → вход
    Note over Admin,UI: Альтернатива: POST /users с временным паролем
```

## 8. Super Admin: создание организации

```mermaid
flowchart TD
    A[/platform/organizations/] --> B[«Создать организацию»]
    B --> C[Название, slug, валюта UZS,<br/>тариф, первый филиал,<br/>владелец: email, ФИО, пароль]
    C --> D[POST /platform/organizations]
    D -- 409 slug/email занят --> C
    D -- 201 --> E[Org + branch + системные роли + owner]
    E --> F[Строка в списке: тариф, статус подписки, филиалы, пользователи]
    F --> G[suspend / activate, смена тарифа, feature flags]
    F --> H[Доступ к данным: только break-glass<br/>POST /platform/organizations/:id/access с причиной → аудит]
```

Super Admin видит только агрегаты организаций, не бизнес-данные.
