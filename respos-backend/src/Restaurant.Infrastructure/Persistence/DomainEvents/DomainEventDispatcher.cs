using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Domain.Common;

namespace Restaurant.Infrastructure.Persistence.DomainEvents;

public interface IDomainEventDispatcher
{
    /// <summary>Collects and clears pending events from tracked entities, runs their handlers; returns the count.</summary>
    Task<int> DispatchPendingAsync(DbContext context, CancellationToken cancellationToken);
}

/// <summary>Runs all <see cref="IDomainEventHandler{TEvent}"/> implementations inside the current unit of work.</summary>
internal sealed class DomainEventDispatcher(IServiceProvider serviceProvider) : IDomainEventDispatcher
{
    private static readonly ConcurrentDictionary<Type, Func<IServiceProvider, IDomainEvent, CancellationToken, Task>> Invokers = new();

    public async Task<int> DispatchPendingAsync(DbContext context, CancellationToken cancellationToken)
    {
        var entities = context.ChangeTracker.Entries<Entity>()
            .Select(e => e.Entity)
            .Where(e => e.DomainEvents.Count > 0)
            .ToList();
        var events = entities.SelectMany(e => e.DomainEvents).ToList();
        entities.ForEach(e => e.ClearDomainEvents());

        foreach (var domainEvent in events)
        {
            var invoker = Invokers.GetOrAdd(domainEvent.GetType(), CreateInvoker);
            await invoker(serviceProvider, domainEvent, cancellationToken);
        }

        return events.Count;
    }

    private static Func<IServiceProvider, IDomainEvent, CancellationToken, Task> CreateInvoker(Type eventType)
    {
        var method = typeof(DomainEventDispatcher)
            .GetMethod(nameof(InvokeHandlersAsync), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!
            .MakeGenericMethod(eventType);
        return (Func<IServiceProvider, IDomainEvent, CancellationToken, Task>)Delegate.CreateDelegate(
            typeof(Func<IServiceProvider, IDomainEvent, CancellationToken, Task>), method);
    }

    private static async Task InvokeHandlersAsync<TEvent>(IServiceProvider provider, IDomainEvent domainEvent, CancellationToken ct)
        where TEvent : IDomainEvent
    {
        foreach (var handler in provider.GetServices<IDomainEventHandler<TEvent>>())
        {
            await handler.HandleAsync((TEvent)domainEvent, ct);
        }
    }
}
