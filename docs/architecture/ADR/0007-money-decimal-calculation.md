# ADR-0007. Деньги: decimal и формула расчёта заказа

**Статус:** Accepted (параметры — допущение User-Todo Q12)
**Дата:** 2026-11-10

## Контекст

ТЗ §4.6: деньги только `decimal/numeric`, расчёт subtotal/discount/service charge/tax/total; snapshot цен в заказе.
Валюта по умолчанию UZS (на практике без копеек, но формат допускает 2 знака).

## Решение

- C# `decimal`; PostgreSQL `numeric(18,2)` для денег, `numeric(18,3)` для количеств, `numeric(5,2)` для процентов.
  JSON — number с ≤ 2 знаками. `float/double` запрещены.
- Валюта — `Organization.Currency` (default `UZS`), в суммах не хранится.
- Расчёт только на сервере (методы агрегата `Order` / доменный сервис), frontend показывает превью:

```
lineTotal      = (unitPrice + sum(modifier.priceDelta)) * quantity        // cancelled items excluded
subtotal       = sum(lineTotal)
discountAmount = fixed amount | round(subtotal * percent / 100, 2); <= subtotal
serviceCharge  = round((subtotal - discountAmount) * branch.serviceChargePercent / 100, 2)
tax            = round((subtotal - discountAmount + serviceCharge) * branch.taxPercent / 100, 2)  // сверху
total          = subtotal - discountAmount + serviceCharge + tax
paidAmount     = sum(completed payments) - sum(refunds)
remaining      = total - paidAmount
```

- Округление `MidpointRounding.AwayFromZero`, 2 знака; `lineTotal` тоже округляется до 2 знаков.
- `unitPrice` — snapshot цены варианта (абсолютная `MenuItemVariant.Price`) или блюда на момент добавления;
  `priceDelta` модификаторов — тоже snapshot.
- Пересчёт при каждом изменении позиций/скидки. Изменение, уменьшающее `total` ниже `paidAmount`, запрещено (422).

## Альтернативы

- **Целые минимальные единицы (long)** — надёжно, но неудобно для процентов и мультивалютности.
- **НДС включён в цену** — возможно (Q12); тогда `taxPercent = 0`, а налог выделяется отчётно — отдельный ADR.

## Последствия

- Одна формула в одном месте Domain, покрыта unit-тестами (округление, 100% скидка, 0% сборы, отменённые позиции).
- Отчёты используют сохранённые суммы заказа, а не пересчёт по текущему меню.
