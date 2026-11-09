# ADR-0001. Модульный монолит + Clean Architecture

**Статус:** Accepted
**Дата:** 2026-11-10

## Контекст

ТЗ (§7) требует Clean Architecture и модульный монолит; микросервисы без доказанной необходимости запрещены.
Команда маленькая, MVP — один пилотный ресторан, но SaaS-основа (несколько организаций и филиалов) нужна сразу.

## Решение

- Один deployable backend `respos-backend` (ASP.NET Core) с проектами `Restaurant.Domain`, `Restaurant.Application`,
  `Restaurant.Infrastructure`, `Restaurant.Api` и тестами `Restaurant.UnitTests`, `Restaurant.IntegrationTests`.
- Зависимости: `Api → Application → Domain`; Infrastructure реализует абстракции Application.
- Модули (Identity, Organization, Branches, Floor, Reservations, Menu, Orders, Kitchen, Inventory, Procurement,
  Payments, Reporting, Notifications, Audit) — вертикальные папки `Features/<Module>` внутри слоёв.
- Межмодульные изменения — через доменные события или явные application-сервисы (см. SYSTEM_OVERVIEW §5).
- Одна БД, один DbContext, одна транзакция на команду.

## Альтернативы

- **Микросервисы** — распределённые транзакции (оплата + списание), отдельный деплой и мониторинг; избыточно для MVP.
- **Отдельный проект на каждый модуль** (`Restaurant.Orders.Application` …) — строже границы, но много boilerplate;
  можно перейти позже, если границы будут нарушаться.
- **Простой N-tier без Clean Architecture** — быстрее старт, но бизнес-логика уезжает в контроллеры; противоречит ТЗ.

## Последствия

- Простой деплой и отладка; транзакционная целостность «оплата → списание» без саги.
- Границы модулей держатся дисциплиной и code review; полезен архитектурный тест (NetArchTest или аналог) на
  направление зависимостей слоёв.
- Выделение модуля в сервис возможно позже благодаря событиям и абстракциям.
