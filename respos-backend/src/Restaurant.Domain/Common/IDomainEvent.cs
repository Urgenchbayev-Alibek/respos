namespace Restaurant.Domain.Common;

/// <summary>Marker for domain events. Dispatched inside the same unit of work, before commit.</summary>
public interface IDomainEvent
{
    DateTime OccurredAt { get; }
}

public abstract record DomainEvent : IDomainEvent
{
    public DateTime OccurredAt { get; init; } = DateTime.UtcNow;
}
