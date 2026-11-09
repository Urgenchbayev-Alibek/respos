using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Domain.Events;

namespace Restaurant.Application.Features.Inventory.Consumption;

/// <summary>Queues the realtime <c>StockLow</c> branch event (sent after commit) when a balance crosses its minimum.</summary>
public sealed class StockLowRealtimeHandler(IApplicationDbContext db, IRealtimeNotifier realtime, IClock clock)
    : IDomainEventHandler<StockLowDomainEvent>
{
    public async Task HandleAsync(StockLowDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var name = db.Ingredients.Local.FirstOrDefault(i => i.Id == domainEvent.IngredientId)?.Name
            ?? await db.Ingredients.IgnoreQueryFilters()
                .Where(i => i.Id == domainEvent.IngredientId)
                .Select(i => i.Name)
                .FirstOrDefaultAsync(cancellationToken);
        realtime.ToBranch(domainEvent.BranchId, RealtimeEvents.StockLow, new
        {
            ingredientId = domainEvent.IngredientId,
            name,
            quantity = domainEvent.Quantity,
            minQuantity = domainEvent.MinQuantity,
            branchId = domainEvent.BranchId,
            occurredAt = clock.UtcNow,
        });
    }
}
