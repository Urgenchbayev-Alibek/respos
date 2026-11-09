using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Infrastructure.Context;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Persistence;

/// <summary>Writes an audit row when stock gets low — proves handlers run inside the same SaveChanges.</summary>
public sealed class StockLowAuditProbeHandler(IAuditLogger audit) : IDomainEventHandler<StockLowDomainEvent>
{
    public const string Action = "test.stock_low_handled";

    public Task HandleAsync(StockLowDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        audit.Log(new AuditEntry(Action, nameof(StockBalance), domainEvent.IngredientId.ToString()) { BranchId = domainEvent.BranchId });
        return Task.CompletedTask;
    }
}

[Collection(ApiCollection.Name)]
public sealed class DomainEventDispatchTests(ApiFactory factory) : ApiTestBase(factory)
{
    [Fact]
    public async Task Domain_event_handlers_run_before_commit_in_the_same_unit_of_work()
    {
        var org = await CreateOrgWithUserAsync();
        Guid ingredientId = default;

        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var provider = scope.ServiceProvider;
            provider.GetRequiredService<RequestContext>().SetUser(org.User.Id, org.OrganizationId, false);
            var db = provider.GetRequiredService<Restaurant.Infrastructure.Persistence.Context.AppDbContext>();
            var unit = await db.Units.FirstAsync(u => u.Code == "kg");
            var ingredient = new Ingredient { Name = "Рис", BaseUnitId = unit.Id };
            ingredientId = ingredient.Id;
            var balance = StockBalance.Create(org.OrganizationId, org.BranchId, ingredient.Id, minQuantity: 5m);
            balance.Apply(Movement(org, ingredient.Id, 10m), allowNegative: false);
            balance.Apply(Movement(org, ingredient.Id, -6m), allowNegative: false);
            db.AddRange(ingredient, balance);

            await db.SaveChangesAsync();
        }

        await WithDbAsync(async (db, _) =>
        {
            var handled = await db.AuditLogs.AnyAsync(a => a.Action == StockLowAuditProbeHandler.Action && a.EntityId == ingredientId.ToString());
            handled.Should().BeTrue();
        });
    }

    private static StockMovement Movement(TestOrg org, Guid ingredientId, decimal quantity) => new()
    {
        OrganizationId = org.OrganizationId,
        BranchId = org.BranchId,
        IngredientId = ingredientId,
        Quantity = quantity,
        Type = StockMovementType.Adjustment,
        SourceType = StockMovementSource.Manual,
    };
}
