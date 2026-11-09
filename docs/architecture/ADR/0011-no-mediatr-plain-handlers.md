# ADR-0011. Без MediatR: простые handlers через DI scanning

**Статус:** Accepted (реализовано в `respos-backend`, см. `respos-backend/README.md` → «How to add a feature module»)
**Дата:** 2026-11-10

## Контекст

Application-слой строится на commands/queries. Типичный выбор — MediatR. ТЗ §18.4 требует обосновывать каждую новую
зависимость и избегать лишних абстракций. Дополнительный довод против MediatR — изменение модели лицензирования его
новых версий (актуальные условия перед повторным рассмотрением нужно проверять в официальном источнике; этот ADR их не утверждает).

## Решение (фактическое)

- Один интерфейс `IHandler<TRequest, TResponse>` (`Application/Common/Handlers/IHandler.cs`):
  `Task<Result<TResponse>> HandleAsync(TRequest request, CancellationToken ct)`. Разделения на `ICommandHandler`/`IQueryHandler` нет.
- Регистрация — собственное сканирование сборки Application рефлексией (`Application/DependencyInjection.cs`, без Scrutor):
  `AddHandlersFromAssembly` (handler регистрируется как сам класс и как `IHandler<,>`, scoped),
  `AddValidatorsFromAssembly` (FluentValidation), `AddDomainEventHandlersFromAssembly` (`IDomainEventHandler<TEvent>`),
  `AddFeatureServicesFromAssembly` (классы с `[ScopedService]` — общие помощники модулей).
- Контроллер получает конкретный handler через DI: `[FromServices] CancelOrderHandler h` → `OkOrProblem(await h.HandleAsync(...))`.
- Cross-cutting — не декораторы, а ASP.NET Core filters/middleware: глобальный `ValidationFilter` (FluentValidation для
  аргументов action), `[RequireBranch]`, `[RequireIdempotencyKey]`, `[HasPermission]`, `ExceptionHandlingMiddleware`.
  Транзакция = один `SaveChangesAsync` (или `ExecuteInTransactionAsync`); аудит — `IAuditLogger` в том же unit of work.
- Доменные события диспетчеризует `IDomainEventDispatcher` **внутри `SaveChanges`, до commit** (outbox нет);
  realtime-сообщения отправляются после успешного commit.

## Альтернативы

- **MediatR** — привычно, готовые pipeline behaviors; минусы — зависимость, лицензионный вопрос, неявная навигация.
- **Wolverine и другие mediator-библиотеки** — больше возможностей, чем нужно.
- **Сервисы-фасады на модуль** (`OrdersService`) — проще, но разрастаются в god classes (лимит 500 строк).

## Последствия

- Явная навигация «контроллер → handler», ноль дополнительных пакетов; новый use case не требует правки центральных файлов.
- Pipeline behaviors нет: всё сквозное — в filters/middleware/interceptors; правило «валидатор рядом с командой» обязательно.
- Обработчики доменных событий не должны вызывать `SaveChangesAsync`.
