# Design System — RestaurantOS

Собственная лёгкая дизайн-система в `respos-admin/src/shared/ui/` (Button, Input, Modal, DataTable,
StatusBadge, ConfirmDialog, Toast …). Токены — CSS custom properties, единый источник
(например `src/shared/ui/tokens.css`). Значения ниже обязательны; новые цвета не вводить без правки этого файла.

## 1. Токены

### Цвета

| Токен | Значение | Назначение |
|---|---|---|
| `--color-primary` | `#E85D2A` | Saffron: главное действие, активный пункт меню |
| `--color-primary-hover` | `#CF4D1D` | Hover/pressed primary |
| `--color-primary-subtle` | `#FDEEE7` | Фон выделения, активная строка, selected chip |
| `--color-text` | `#0F172A` | Основной текст |
| `--color-text-muted` | `#475569` | Вторичный текст, подписи, плейсхолдеры (≥ 4.5:1 на белом) |
| `--color-border` | `#E2E8F0` | Границы, разделители |
| `--color-bg` | `#F8FAFC` | Фон страницы |
| `--color-surface` | `#FFFFFF` | Карточки, таблицы, модальные окна |
| `--color-success` | `#16A34A` | Готово, оплачено, свободно |
| `--color-warning` | `#D97706` | Ожидание, частично, низкий остаток |
| `--color-danger` | `#DC2626` | Ошибки, отмена, опасные действия |
| `--color-info` | `#2563EB` | В работе, информация, ссылки на сущности |
| `--color-kds-bg` | `#0B1220` | Фон KDS |
| `--color-kds-card` | `#111A2E` | Карточки заданий KDS |
| `--color-kds-text` | `#F8FAFC` | Текст на KDS (= `--color-bg`) |

Производные «subtle» фоны для бейджей и алертов — тон с прозрачностью 12%
(`color-mix(in srgb, var(--color-success) 12%, transparent)`), отдельных HEX не заводить.
Про контраст primary — см. `ACCESSIBILITY.md` §2 (белый текст на `#E85D2A` ≈ 3.5:1).

### Типографика

- Шрифт: **Inter** (`"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`), с кириллицей и
  узбекскими `oʻ`/`gʻ`. Цифры в таблицах и суммах — `font-variant-numeric: tabular-nums`.
- Базовый размер по workspace: `--font-base` = **14px** admin/stock/platform, **16px** waiter (и cashier на планшете),
  **20px** KDS (номера столов/заказов 28–32px).

| Токен | Размер / line-height | Вес | Применение |
|---|---|---|---|
| `--text-xs` | 12 / 16 | 500 | Бейджи, метки |
| `--text-sm` | 13 / 18 | 400 | Вторичный текст таблиц |
| `--text-md` | base / 1.45 | 400 | Основной текст |
| `--text-lg` | 18 / 26 | 600 | Заголовки карточек |
| `--text-xl` | 22 / 30 | 600 | Заголовок страницы |
| `--text-2xl` | 28 / 36 | 700 | KPI на dashboard, итог к оплате |

### Spacing (шаг 4px)

`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` · `--space-5: 20px` ·
`--space-6: 24px` · `--space-8: 32px` · `--space-10: 40px` · `--space-12: 48px`.
Внутренний отступ карточки — 16 (admin) / 20 (waiter, KDS). Гаттер страницы — 24 desktop, 16 mobile.

### Радиусы и тени

| Токен | Значение | Где |
|---|---|---|
| `--radius-sm` | 6px | Inputs, кнопки, бейджи |
| `--radius-md` | 10px | Карточки, dropdown, toasts |
| `--radius-lg` | 14px | Модальные окна, KDS-карточки, плитки столов |
| `--shadow-sm` | `0 1px 2px rgba(15,23,42,.06)` | Карточки |
| `--shadow-md` | `0 4px 12px rgba(15,23,42,.08)` | Dropdown, toasts |
| `--shadow-lg` | `0 12px 32px rgba(15,23,42,.16)` | Модальные окна |

### Размеры касания

- Минимальная цель касания **44×44px** везде, где возможен touch (waiter, cashier, KDS, mobile admin).
- KDS: кнопки статуса ≥ 56px по высоте. Плитки блюд у официанта ≥ 96×72px.
- Desktop-admin: кнопки 36px допустимы только в плотных таблицах при наличии мыши.

### Иконки и движение

Иконки — одна библиотека (outline, 20px, stroke 1.75), например `lucide-react`. Длительность переходов
100–250ms, кривые и длительности — только из токенов движения (см. ниже).

### Motion and polish

Полная спецификация движения, нажатий, фокуса и мобильных правил — [`MOTION_AND_POLISH.md`](MOTION_AND_POLISH.md).
Токены одинаковы в `respos-admin/src/shared/ui/theme/tokens.css` и `respos-landing/src/app/styles/global.css`:

| Токен | Значение | Где используется |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | появление, отпускание нажатия, всё, что вызвал пользователь |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | движение по экрану, пульсации |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | drawer, нижний лист |
| `--duration-press` | `100ms` | отпускание нажатия (само нажатие — всегда 0ms) |
| `--duration-fast` | `150ms` | hover-цвет, dropdown, popover, tooltip, переключатель |
| `--duration-base` | `200ms` | modal, toast, затемнение, аккордеон |
| `--duration-slow` | `250ms` | drawer, нижний лист |
| `--duration-exit` | `150ms` | анимированные выходы (toast, мобильное меню лендинга, закрытие FAQ) |
| `--duration-reveal` | `600ms` | только лендинг: hero и появление блоков при прокрутке |
| `--press-scale` / `-wide` / `-icon` | `0.97` / `0.985` / `0.95` | кнопки / широкие кнопки / иконки |
| `--stagger-step` | `40ms` (лендинг `80ms`) | шаг каскада |
| `--color-pressed` | 12% текста поверх поверхности | фон нажатого элемента |
| `--color-focus` | `#2563eb` / `#93c5fd` (dark) / `#ffffff` (KDS) | outline фокуса 2px (KDS 3px), offset 2px |

Правила:

- Частые действия (плитки блюд, количество, статусы KDS, клавиши оплаты, столики, горячие клавиши, поиск) —
  без анимации, только мгновенный отклик на нажатие. Модальные окна, drawer, toast, dropdown, вкладки —
  короткое стандартное движение. Открытие с клавиатуры — без анимации.
- Никогда `transition: all`, `ease-in`, `scale(0)`; движение — только `transform` и `opacity`.
- Hover-эффекты — под `@media (hover: hover) and (pointer: fine)`.
- `prefers-reduced-motion`: движение заменяется коротким затуханием, обратная связь остаётся.
- Фокус — `outline` (переживает forced-colors), не `box-shadow`; не анимируется.

## 2. Компоненты

### Button

| Вариант | Вид | Когда |
|---|---|---|
| `primary` | bg `--color-primary`, текст белый 600 | Одно главное действие на экране: «На кухню», «Принять оплату», «Сохранить» |
| `secondary` | bg surface, border `--color-border`, текст `--color-text` | Остальные действия |
| `ghost` | без фона, текст muted, hover bg `--color-bg` | Действия в строках таблиц, тулбары |
| `danger` | bg `--color-danger`, текст белый | Отмена заказа, возврат, удаление/архив (всегда через ConfirmDialog) |
| `link` | текст `--color-info`, underline при hover | Переходы к сущности |

Размеры: `sm` 32px (только desktop-таблицы), `md` 40px (default admin), `lg` 48px (waiter/cashier), `xl` 56px (KDS).
Состояния: default, hover (`--color-primary-hover`), focus-visible (кольцо 2px `--color-info` + offset 2px),
active, disabled (opacity .5, `cursor: not-allowed`, причина в tooltip), loading (spinner вместо иконки,
текст сохраняется, повторный клик блокируется — важно для оплат и «На кухню»).

### Inputs

Высота 40px (admin) / 48px (touch). Label сверху всегда (не только placeholder). Обязательные поля — `*`.
Ошибка — рамка `--color-danger` + текст под полем (`aria-describedby`). Денежные поля — выравнивание вправо,
`inputmode="decimal"`, суффикс валюты, разделитель тысяч при blur. Количество — шаг 0.001 для кг/л.
Select, Combobox (поиск блюд/ингредиентов), DatePicker/TimePicker в timezone филиала, Switch, Checkbox, Textarea.
Формы — React Hook Form + Zod; серверные ошибки `errors` из ProblemDetails раскладываются по полям.

### DataTable

- Заголовок: muted 12–13px uppercase-free, sticky. Строки 44px (admin), zebra нет, hover `--color-bg`.
- Числа и деньги — вправо, tabular-nums. Статусы — StatusBadge. Действия — ghost-кнопки/kebab-меню справа.
- Сортировка (`sort=field:dir`), фильтры над таблицей, поиск с debounce 300ms, пагинация снизу
  (`page`, `pageSize` 20/50/100, «Всего: N»). Фильтры отражаются в URL.
- На < 768px таблица превращается в список карточек (см. `RESPONSIVE_RULES.md`).

### Modal / ConfirmDialog

Ширина 480 (форма) / 720 (сложная форма); на mobile — full-screen sheet. Заголовок, тело, футер
(secondary слева «Отмена», primary/danger справа). Esc и клик по оверлею закрывают, если нет несохранённых
изменений. Фокус захватывается и возвращается на триггер.
ConfirmDialog для опасных операций: заголовок-вопрос, последствия, обязательное поле «Причина» (отмена заказа,
возврат, списание), кнопка danger с глаголом («Отменить заказ», а не «ОК»).

### Sidebar (admin, stock, platform)

Ширина 240px, свёрнутая — 64px (только иконки + tooltip). Фон surface, border справа. Сверху — логотип,
переключатель организации и филиала (`X-Branch-Id`). Группы: Операции (Dashboard, Заказы, Столы, Брони),
Меню и кухня, Склад, Финансы, Команда, Система. Активный пункт — фон `--color-primary-subtle`, текст и
полоса слева `--color-primary`. Пункты без прав не показываются. Waiter и KDS sidebar не имеют — нижний
tab bar (waiter) или только верхняя панель (KDS).

### Dashboard cards

KPI-карточка: подпись muted 13px, значение `--text-2xl` tabular-nums, сравнение/подпись внизу.
Карточки: «Продажи сегодня», «Заказы», «Средний чек», «Активные заказы», «Занятость столов» (n/m + прогресс),
«Низкие остатки» (warning, ссылка на склад), «Кассовая смена» (открыта/закрыта). Если `isDemoData` —
бейдж «Демо-данные» в углу каждой карточки. Списки «Популярные блюда» — топ-5 с количеством и выручкой.

### Toasts

Справа сверху (desktop), снизу по центру (mobile), до 3 одновременно, авто-скрытие 5s (ошибки — до закрытия).
Типы: success, info, warning, error (иконка + полоса слева цветом типа). Ошибка показывает `correlationId`
мелким шрифтом с кнопкой «Скопировать». Realtime-события официанту («Стол 7: Плов готов») — info-toast со звуком
(отключаемым) и действием «Открыть».

### StatusBadge

Форма: pill, высота 22px, `--radius-sm`, фон — subtle-тон статуса (12%), **точка-иконка цветом статуса и текст
`--color-text`** (так соблюдается контраст при любом тоне). На KDS — заливка карточки/полосы цветом статуса.

Тоны: `neutral` (slate `#475569`), `primary`, `info`, `warning`, `success`, `danger`.

#### Заказ (`Order.Status`)

| Код | Тон | RU | UZ |
|---|---|---|---|
| `draft` | neutral | Черновик | Qoralama |
| `submitted` | info | Отправлен | Yuborildi |
| `in_progress` | primary | Готовится | Tayyorlanmoqda |
| `partially_ready` | warning | Частично готов | Qisman tayyor |
| `ready` | success | Готов | Tayyor |
| `served` | info | Подан | Berildi |
| `paid` | success (solid) | Оплачен | To'langan |
| `cancelled` | danger | Отменён | Bekor qilingan |

#### Позиция заказа (`OrderItem.Status`)

| Код | Тон | RU | UZ |
|---|---|---|---|
| `new` | neutral | Новая | Yangi |
| `sent` | info | На кухне | Oshxonada |
| `preparing` | primary | Готовится | Tayyorlanmoqda |
| `ready` | success | Готова | Tayyor |
| `served` | info | Подана | Berildi |
| `cancelled` | danger | Отменена | Bekor qilingan |

#### Столик (`DiningTable.Status`)

| Код | Тон | RU | UZ |
|---|---|---|---|
| `available` | success | Свободен | Bo'sh |
| `occupied` | primary | Занят | Band |
| `reserved` | info | Забронирован | Bron qilingan |
| `unavailable` | neutral | Недоступен | Mavjud emas |

#### Кухонное задание (`KitchenTicket.Status`)

| Код | Тон | RU | UZ |
|---|---|---|---|
| `new` | info | Новое | Yangi |
| `in_progress` | primary | В работе | Jarayonda |
| `ready` | success | Готово | Tayyor |
| `served` | neutral | Выдано | Berildi |
| `cancelled` | danger | Отменено | Bekor qilingan |

KDS дополнительно подсвечивает **время ожидания**: < 10 мин — обычный, 10–20 мин — рамка warning,
> 20 мин — рамка danger (пороги — конфигурация, позже настройка филиала / `PrepTimeMinutes` блюда).

#### Бронирование (`TableReservation.Status`)

| Код | Тон | RU | UZ |
|---|---|---|---|
| `pending` | warning | Ожидает | Kutilmoqda |
| `confirmed` | info | Подтверждено | Tasdiqlangan |
| `seated` | primary | Гости за столом | Mehmonlar o'tirdi |
| `completed` | success | Завершено | Yakunlangan |
| `cancelled` | danger | Отменено | Bekor qilingan |
| `no_show` | neutral | Не пришли | Kelmadi |

#### Закупка (`PurchaseOrder.Status`)

| Код | Тон | RU | UZ |
|---|---|---|---|
| `draft` | neutral | Черновик | Qoralama |
| `submitted` | info | Отправлена | Yuborildi |
| `partially_received` | warning | Частично принята | Qisman qabul qilindi |
| `received` | success | Принята | Qabul qilindi |
| `cancelled` | danger | Отменена | Bekor qilingan |

#### Платёж и кассовая смена

| Сущность | Код | Тон | RU | UZ |
|---|---|---|---|---|
| Payment | `completed` | success | Проведён | O'tkazildi |
| Payment | `partially_refunded` | warning | Частичный возврат | Qisman qaytarildi |
| Payment | `refunded` | danger | Возвращён | Qaytarildi |
| CashShift | `open` | success | Смена открыта | Smena ochiq |
| CashShift | `closed` | neutral | Смена закрыта | Smena yopiq |
| Способ | `cash` / `card` / `other` | neutral | Наличные / Карта / Другое | Naqd / Karta / Boshqa |

Прочие: пользователь `active|invited|blocked|deactivated` → success/info/danger/neutral
(Активен/Приглашён/Заблокирован/Деактивирован — Faol/Taklif qilingan/Bloklangan/O'chirilgan);
остаток ниже минимума → warning «Мало» / «Kam», отрицательный → danger «Минус» / «Minus»;
интеграции → neutral «Демо» / «Demo», «Не подключено» / «Ulanmagan», «Запланировано» / «Rejalashtirilgan».

Маппинг `код → тон, i18n-ключ` хранится в одном месте (`src/shared/ui/StatusBadge/status-map.ts`),
ключи вида `status.order.in_progress`.

## 3. Состояния экранов

| Состояние | Правило |
|---|---|
| Loading | Skeleton той же формы, что контент (строки таблицы, KPI-карточки). Спиннер — только внутри кнопок. Не мигать: skeleton после 200ms. |
| Empty | Иконка, короткий заголовок, одна фраза пользы и primary-действие, если есть права («Добавьте первый столик»). Для пустого результата фильтра — «Ничего не найдено» + «Сбросить фильтры». |
| Error | Inline-alert danger с текстом по `code` из ProblemDetails, кнопка «Повторить», `correlationId`. 403 — «Нет доступа» без деталей; 404 — «Не найдено». Сетевая ошибка — баннер «Нет связи с сервером». |
| Success | Toast success для действий; для длинных форм — inline-подтверждение. После мутации — инвалидация запросов TanStack Query, без ручного патча состояния. |
| Conflict (409) | Специальные тексты: `order.invalid_status_transition` («Статус уже изменился — данные обновлены»), `reservation.time_conflict`, `payment.duplicate`, `stock.insufficient`; данные перезапрашиваются. |
| Realtime offline | Индикатор в шапке: зелёная точка «Онлайн» / жёлтая «Переподключение…» / красная «Нет связи». После reconnect — refetch. |

## 4. Локализация RU / UZ

- Библиотека **i18next** (`react-i18next`). Языки: `ru` (default), `uz` (узбекский **латиница**, `uz-Latn`),
  `en` — заготовка. Ресурсы по namespace на модуль: `common`, `orders`, `kitchen`, `inventory`, …
- Ключи — английские, иерархические: `orders.actions.sendToKitchen`, `status.table.available`,
  `errors.order.invalid_status_transition`. Никаких строк в JSX/TS, кроме ключей; lint-правило (например
  `i18next/no-literal-string`) по возможности.
- Язык выбирается: `User.preferredLanguage` → `Organization.defaultLanguage` → `ru`. Переключатель RU/UZ — в шапке
  и на экране входа. Тот же язык уходит в `Accept-Language`.
- Узбекская латиница: апостроф в `oʻ`, `gʻ` — использовать единообразно (рекомендуемый символ `ʻ` U+02BB,
  в простых текстах допустим `'`); выбрать один вариант при вычитке (Q11 — нужна вычитка носителем).
- Закладывать **+30% длины** текста: кнопки без фиксированной ширины, переносы в заголовках, `text-overflow: ellipsis`
  с `title` только для имён сущностей, не для действий.
- Плюрализация через i18next (`_one/_few/_many` для RU, `_one/_other` для UZ).
- Названия блюд/категорий — данные (`Name`, `NameUz`), не i18n: показывать `NameUz`, если язык `uz` и поле заполнено.
- **Деньги** — одна функция `formatCurrency` (`src/shared/lib/format-currency.ts`) на `Intl.NumberFormat`:
  пробел-разделитель тысяч, без копеек для UZS, если дробная часть 0. RU: `125 000 сум`, UZ: `125 000 so'm`.
  Валюта — из `currentOrganization.currency`, не хардкод.
- **Даты/время** — одна `formatDate` (`format-date.ts`): API отдаёт UTC (`Z`), отображение в `branch.timezone`
  (default `Asia/Tashkent`). Формат RU `10.11.2026 14:30`, UZ `10.11.2026 14:30`; 24-часовой формат; первый день недели — понедельник.
- **Ошибки:** frontend маппит `code` → ключ `errors.<code>`; если ключа нет — показывает `title` от сервера.
- Номер заказа — `#0042`, стол — «Стол 7» / «7-stol».
