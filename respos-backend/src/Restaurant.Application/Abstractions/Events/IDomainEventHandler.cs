using Restaurant.Domain.Common;

namespace Restaurant.Application.Abstractions.Events;

/// <summary>
/// Handles a domain event inside the SAME unit of work, before commit (found by assembly scanning).
/// Make changes through IApplicationDbContext but do NOT call SaveChangesAsync — the outer save commits atomically.
/// Throwing aborts the whole operation.
/// </summary>
public interface IDomainEventHandler<in TEvent>
    where TEvent : IDomainEvent
{
    Task HandleAsync(TEvent domainEvent, CancellationToken cancellationToken);
}
