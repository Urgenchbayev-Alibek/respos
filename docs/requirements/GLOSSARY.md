# Глоссарий RestaurantOS (RU / UZ / EN)

Узбекский — латиница. Переводы UZ черновые, требуют вычитки носителем (User-Todo Q11).
Колонка «Код» — идентификатор в API/коде (enum snake_case или имя сущности).

## Платформа и организация

| RU | UZ | EN | Код | Пояснение |
|---|---|---|---|---|
| Организация | Tashkilot | Organization | `Organization` | Клиент SaaS (ресторанная компания), tenant |
| Филиал | Filial | Branch | `RestaurantBranch` | Отдельная точка ресторана |
| Тенант | Tenant | Tenant | `OrganizationId` | Граница изоляции данных |
| Тариф | Tarif | Plan | `Plan` | Starter / Business / Enterprise |
| Подписка | Obuna | Subscription | `Subscription` | Тариф организации и его статус |
| Флаг функции | Funksiya bayrog'i | Feature flag | `FeatureFlag` | Включение модуля для организации |
| Супер-админ платформы | Platforma super administratori | Platform super admin | `IsPlatformAdmin` | Управляет SaaS, не видит данные ресторанов |
| Экстренный доступ | Favqulodda kirish | Break-glass access | `platform.tenant-data.access` | Временный аудируемый доступ к данным тенанта |
| Заявка на демо | Demo so'rovi | Demo request | `DemoRequest` | Форма с лендинга |
| Демо-данные | Demo ma'lumotlar | Demo data | `IsDemo` | Сгенерированные данные, явно помечены |

## Пользователи и доступ

| RU | UZ | EN | Код |
|---|---|---|---|
| Пользователь / сотрудник | Foydalanuvchi / xodim | User / employee | `User` |
| Роль | Rol | Role | `Role` |
| Право (разрешение) | Ruxsat | Permission | `Permission` |
| Владелец | Egasi | Owner | `owner` |
| Администратор | Administrator | Admin | `admin` |
| Менеджер | Menejer | Manager | `manager` |
| Официант | Ofitsiant | Waiter | `waiter` |
| Повар | Oshpaz | Cook | `cook` |
| Кассир | Kassir | Cashier | `cashier` |
| Кладовщик | Omborchi | Stockkeeper | `stockkeeper` |
| Бухгалтер / аудитор | Buxgalter / auditor | Accountant / auditor | `accountant` |
| Приглашение | Taklifnoma | Invitation | `UserInvitation` |
| Рабочее место | Ish joyi | Workspace | — (Admin, Waiter, KDS, Cashier, Stock, Platform) |
| Журнал аудита | Audit jurnali | Audit log | `AuditLog` |

## Зал и бронирования

| RU | UZ | EN | Код |
|---|---|---|---|
| Зона (зал) | Zona (zal) | Dining area | `DiningArea` |
| Столик | Stol | Table | `DiningTable` |
| Свободен | Bo'sh | Available | `available` |
| Занят | Band | Occupied | `occupied` |
| Забронирован | Bron qilingan | Reserved | `reserved` |
| Недоступен | Mavjud emas | Unavailable | `unavailable` |
| Бронирование | Bron | Reservation | `TableReservation` |
| Ожидает подтверждения | Tasdiq kutilmoqda | Pending | `pending` |
| Подтверждено | Tasdiqlangan | Confirmed | `confirmed` |
| Гости рассажены | Mehmonlar o'tirdi | Seated | `seated` |
| Завершено | Yakunlangan | Completed | `completed` |
| Неявка | Kelmadi | No-show | `no_show` |

## Меню и кухня

| RU | UZ | EN | Код |
|---|---|---|---|
| Категория меню | Menyu toifasi | Menu category | `MenuCategory` |
| Блюдо | Taom | Menu item | `MenuItem` |
| Вариант (размер) | Variant (o'lcham) | Variant | `MenuItemVariant` |
| Группа модификаторов | Qo'shimchalar guruhi | Modifier group | `ModifierGroup` |
| Модификатор / добавка | Qo'shimcha | Modifier option | `ModifierOption` |
| Стоп-лист (недоступно) | Stop-list | Unavailable item | `IsAvailable=false` |
| Кухонная станция | Oshxona stansiyasi | Kitchen station | `KitchenStation` |
| Экран кухни (KDS) | Oshxona ekrani | Kitchen Display System | KDS |
| Кухонное задание (тикет) | Oshxona buyurtmasi (chipta) | Kitchen ticket | `KitchenTicket` |
| Время приготовления | Tayyorlash vaqti | Prep time | `PrepTimeMinutes` |

## Заказы

| RU | UZ | EN | Код |
|---|---|---|---|
| Заказ | Buyurtma | Order | `Order` |
| Позиция заказа | Buyurtma pozitsiyasi | Order item | `OrderItem` |
| В зале | Zalda | Dine-in | `dine_in` |
| С собой | Olib ketish | Takeaway | `takeaway` |
| Черновик | Qoralama | Draft | `draft` |
| Отправлен | Yuborilgan | Submitted | `submitted` |
| Готовится | Tayyorlanmoqda | In progress / preparing | `in_progress` / `preparing` |
| Частично готов | Qisman tayyor | Partially ready | `partially_ready` |
| Готов | Tayyor | Ready | `ready` |
| Подан | Berildi | Served | `served` |
| Оплачен | To'langan | Paid | `paid` |
| Отменён | Bekor qilingan | Cancelled | `cancelled` |
| Отправить на кухню | Oshxonaga yuborish | Send to kitchen | `send-to-kitchen` |
| Снимок (snapshot) | Nusxa | Snapshot | `NameSnapshot` |
| Перенос заказа | Buyurtmani ko'chirish | Transfer | `orders.transfer` |
| Пречек | Oldindan chek | Pre-check / guest bill | `receipt` (не фискальный) |

## Деньги и касса

| RU | UZ | EN | Код |
|---|---|---|---|
| Сумма без скидки | Oraliq summa | Subtotal | `subtotal` |
| Скидка | Chegirma | Discount | `discountAmount` |
| Сервисный сбор | Xizmat haqi | Service charge | `serviceChargeAmount` |
| Налог | Soliq | Tax | `taxAmount` |
| Итого | Jami | Total | `total` |
| Оплачено | To'langan | Paid amount | `paidAmount` |
| Остаток к оплате | To'lanishi kerak | Remaining | `remainingAmount` |
| Платёж | To'lov | Payment | `Payment` |
| Наличные | Naqd pul | Cash | `cash` |
| Карта | Karta | Card | `card` |
| Другое | Boshqa | Other | `other` |
| Возврат | Qaytarish | Refund | `Refund` |
| Кассовая смена | Kassa smenasi | Cash shift | `CashShift` |
| Сумма открытия | Ochilish summasi | Opening amount | `openingAmount` |
| Расхождение | Farq | Difference | `difference` |
| Ручная отметка (демо) | Qo'lda belgilash (demo) | Manual (demo) | provider `manual` |
| Фискальный чек / онлайн-ККМ | Fiskal chek / onlayn-NKM | Fiscal receipt / online cash register | вне MVP |
| сум | so'm | UZS | `UZS` |

## Склад и закупки

| RU | UZ | EN | Код |
|---|---|---|---|
| Ингредиент | Ingrediyent | Ingredient | `Ingredient` |
| Единица измерения | O'lchov birligi | Unit of measure | `UnitOfMeasure` |
| Остаток | Qoldiq | Stock balance | `StockBalance` |
| Минимальный остаток | Minimal qoldiq | Minimum quantity | `MinQuantity` |
| Движение запасов | Zaxira harakati | Stock movement | `StockMovement` |
| Поступление | Kirim | Receipt | `receipt` |
| Расход (списание по продаже) | Sarf | Consumption | `consumption` |
| Списание (порча) | Hisobdan chiqarish | Write-off | `write_off` |
| Корректировка | Tuzatish | Adjustment | `adjustment` |
| Инвентаризация | Inventarizatsiya | Stock count | `InventoryCount` |
| Рецептура (техкарта) | Retsept (texnologik karta) | Recipe | `Recipe` |
| Себестоимость | Tannarx | Cost price | `CostPrice` |
| Поставщик | Yetkazib beruvchi | Supplier | `Supplier` |
| ИНН | STIR | Tax ID (INN) | `Inn` |
| Закупка | Xarid | Purchase order | `PurchaseOrder` |
| Частично принято | Qisman qabul qilingan | Partially received | `partially_received` |
| Принято | Qabul qilingan | Received | `received` |

## Технические термины

| Термин | Значение |
|---|---|
| Idempotency-Key | Заголовок, гарантирующий, что повтор запроса не выполнит операцию дважды |
| Correlation ID | Сквозной идентификатор запроса в логах и ошибках |
| ProblemDetails | Формат ошибки RFC 7807 (`code`, `title`, `correlationId`) |
| Global query filter | Фильтр EF Core, автоматически ограничивающий запросы текущей организацией |
| SignalR | Канал realtime-уведомлений; не источник истины |
| RowVersion / `xmin` | Токен оптимистичной блокировки (PostgreSQL) |
| Domain event | Событие домена, например `OrderPaidDomainEvent` |
| Workspace | Раздел приложения под роль: Admin, Waiter, KDS, Cashier, Stock, Platform |
