# Architecture Decision Records

Формат: Статус / Дата / Контекст / Решение / Альтернативы / Последствия.
Новое решение — новый файл `NNNN-kebab-title.md`; принятые ADR не переписываются, а заменяются новыми (`Superseded by`).

| № | Решение | Статус |
|---|---|---|
| [0001](0001-modular-monolith-clean-architecture.md) | Модульный монолит + Clean Architecture | Accepted |
| [0002](0002-multi-tenancy-shared-schema.md) | Multi-tenancy: общая схема, global query filters, `X-Branch-Id` | Accepted |
| [0003](0003-auth-jwt-refresh-cookie.md) | Auth: короткий JWT в памяти + ротируемый refresh в httpOnly cookie | Accepted |
| [0004](0004-rbac-permission-catalog.md) | RBAC: единый каталог permissions | Accepted |
| [0005](0005-signalr-notification-only.md) | SignalR только как канал уведомлений | Accepted |
| [0006](0006-inventory-consumption-on-payment.md) | Списание ингредиентов при полной оплате, идемпотентно | Accepted (допущение Q7) |
| [0007](0007-money-decimal-calculation.md) | Деньги: decimal и формула расчёта | Accepted (допущение Q12) |
| [0008](0008-payment-provider-adapter.md) | Адаптер платёжного провайдера, только ручной/демо | Accepted |
| [0009](0009-dotnet-8-upgrade-to-10.md) | .NET 8 сейчас, переход на .NET 10 LTS | Accepted, follow-up |
| [0010](0010-single-react-app-workspaces.md) | Одно React-приложение с workspaces + отдельный лендинг | Accepted |
| [0011](0011-no-mediatr-plain-handlers.md) | Без MediatR: `IHandler<TRequest,TResponse>` через DI scanning | Accepted |
| [0012](0012-platform-break-glass-access.md) | Платформенный break-glass доступ (30 мин, read-only, аудит) | Accepted |
| [0013](0013-idempotency-replay-store-and-db-keys.md) | Idempotency: HTTP replay store + DB unique keys | Accepted |
