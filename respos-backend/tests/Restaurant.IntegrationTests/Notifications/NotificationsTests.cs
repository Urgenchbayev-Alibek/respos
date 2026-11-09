using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Procurement;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Infrastructure.Context;
using Restaurant.Infrastructure.Persistence.Context;
using Restaurant.IntegrationTests.Infrastructure;
using Restaurant.IntegrationTests.Reports;

namespace Restaurant.IntegrationTests.Notifications;

[Collection(ApiCollection.Name)]
public sealed class NotificationsTests(ApiFactory factory) : ApiTestBase(factory)
{
    [Fact]
    public async Task Order_events_notify_kitchen_users_of_the_branch_and_the_waiter_when_ready()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var cook = await AddUserAsync(org, SystemRoles.Cook);
        var stock = await AddUserAsync(org, SystemRoles.Stockkeeper);
        var otherBranchId = Guid.Empty;
        await WithDbAsync(async (db, sp) =>
        {
            otherBranchId = sp.GetRequiredService<OrganizationProvisioner>().CreateBranch(org.OrganizationId, "Second").Id;
            await db.SaveChangesAsync();
        });
        var otherCook = await AddUserAsync(org, SystemRoles.Cook, otherBranchId);

        // Send + ready in one unit of work (independent of the Orders/KDS API; both events are dispatched before commit).
        await AsUserAsync(org, org.User.Id, async db =>
        {
            var menu = await SalesTestData.SeedMenuAsync(db, org, DateTime.UtcNow);
            var order = new SalesTestData(org).OpenOrder(db, DateOnly.FromDateTime(DateTime.UtcNow), DateTime.UtcNow, (menu.Plov, 1m));
            order.SendItems(null, org.User.Id, DateTime.UtcNow);
            order.MarkItemReady(order.Items[0].Id, cook.Id, DateTime.UtcNow);
        });

        (await TypesFor(cook.Id)).Should().Equal(NotificationType.OrderNew);
        (await TypesFor(stock.Id)).Should().BeEmpty("no kitchen.read");
        (await TypesFor(otherCook.Id)).Should().BeEmpty("no access to the order branch");
        // The waiter (actor) gets no order_new for their own order, only order_ready.
        (await TypesFor(org.User.Id)).Should().Equal(NotificationType.OrderReady);
        await WithDbAsync(async (db, _) =>
        {
            var ready = await db.Notifications.IgnoreQueryFilters().SingleAsync(n => n.UserId == org.User.Id);
            ready.Title.Should().Be("Готово: Плов");
            ready.BranchId.Should().Be(org.BranchId);
        });
    }

    [Fact]
    public async Task Stock_low_and_purchase_received_notify_inventory_users()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var cashier = await AddUserAsync(org, SystemRoles.Cashier);
        await AsUserAsync(org, cashier.Id, async db =>
        {
            var kg = await db.Units.FirstAsync(u => u.Code == "kg");
            var rice = new Ingredient { Name = "Рис", BaseUnitId = kg.Id };
            var balance = StockBalance.Create(org.OrganizationId, org.BranchId, rice.Id, minQuantity: 5m);
            balance.Apply(Movement(org, rice.Id, 10m), allowNegative: false);
            balance.Apply(Movement(org, rice.Id, -7m), allowNegative: false);
            db.AddRange(rice, balance);

            var supplier = new Supplier { Name = "Агро" };
            var purchase = new PurchaseOrder { BranchId = org.BranchId, SupplierId = supplier.Id, Number = 7, Status = PurchaseOrderStatus.Received };
            db.AddRange(supplier, purchase);
            await db.SaveChangesAsync();
            foreach (var handler in ScopeServices!.GetServices<IDomainEventHandler<PurchaseReceivedDomainEvent>>())
            {
                await handler.HandleAsync(new PurchaseReceivedDomainEvent(purchase.Id, org.BranchId), default);
            }
        });

        (await TypesFor(org.User.Id)).Should().BeEquivalentTo([NotificationType.StockLow, NotificationType.PurchaseReceived]);
        (await TypesFor(cashier.Id)).Should().BeEmpty();
    }

    [Fact]
    public async Task Read_state_is_per_user_with_unread_count_and_read_all()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Cook);
        var other = await AddUserAsync(org, SystemRoles.Cook);
        var ids = new List<Guid>();
        Guid foreignId = default;
        await WithDbAsync(async (db, _) =>
        {
            for (var i = 0; i < 3; i++)
            {
                var n = new Restaurant.Domain.Entities.Notifications.Notification
                {
                    OrganizationId = org.OrganizationId, BranchId = org.BranchId, UserId = org.User.Id,
                    Type = NotificationType.OrderNew, Title = $"#{i}", CreatedAt = DateTime.UtcNow.AddMinutes(i),
                };
                ids.Add(n.Id);
                db.Add(n);
            }

            var foreign = new Restaurant.Domain.Entities.Notifications.Notification
            {
                OrganizationId = org.OrganizationId, UserId = other.Id, Type = NotificationType.System, Title = "x", CreatedAt = DateTime.UtcNow,
            };
            foreignId = foreign.Id;
            db.Add(foreign);
            await db.SaveChangesAsync();
        });
        var client = await LoginAsAsync(org.User);

        (await ReadJsonAsync(await client.GetAsync("/api/v1/notifications/unread-count"))).GetProperty("count").GetInt32().Should().Be(3);
        var read = await ReadJsonAsync(await client.PostAsync($"/api/v1/notifications/{ids[0]}/read", null));
        read.GetProperty("isRead").GetBoolean().Should().BeTrue();
        (await client.PostAsync($"/api/v1/notifications/{ids[0]}/read", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.PostAsync($"/api/v1/notifications/{foreignId}/read", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);

        var unread = await ReadJsonAsync(await client.GetAsync("/api/v1/notifications?unreadOnly=true"));
        unread.GetProperty("totalCount").GetInt32().Should().Be(2);
        unread.GetProperty("items")[0].GetProperty("title").GetString().Should().Be("#2");

        (await ReadJsonAsync(await client.PostAsync("/api/v1/notifications/read-all", null))).GetProperty("count").GetInt32().Should().Be(2);
        (await ReadJsonAsync(await client.GetAsync("/api/v1/notifications/unread-count"))).GetProperty("count").GetInt32().Should().Be(0);
        var all = await ReadJsonAsync(await client.GetAsync("/api/v1/notifications"));
        all.GetProperty("totalCount").GetInt32().Should().Be(3);

        var otherClient = await LoginAsAsync(other);
        (await ReadJsonAsync(await otherClient.GetAsync("/api/v1/notifications/unread-count"))).GetProperty("count").GetInt32().Should().Be(1);
    }

    private IServiceProvider? ScopeServices { get; set; }

    private static StockMovement Movement(TestOrg org, Guid ingredientId, decimal quantity) => new()
    {
        OrganizationId = org.OrganizationId,
        BranchId = org.BranchId,
        IngredientId = ingredientId,
        Quantity = quantity,
        Type = StockMovementType.Adjustment,
        SourceType = StockMovementSource.Manual,
    };

    /// <summary>Runs <paramref name="action"/> as <paramref name="userId"/> in the org, then saves (domain events dispatch).</summary>
    private async Task AsUserAsync(TestOrg org, Guid userId, Func<AppDbContext, Task> action)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        ScopeServices = scope.ServiceProvider;
        scope.ServiceProvider.GetRequiredService<RequestContext>().SetUser(userId, org.OrganizationId, false);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await action(db);
        await db.SaveChangesAsync();
    }

    private async Task<List<NotificationType>> TypesFor(Guid userId)
    {
        var types = new List<NotificationType>();
        await WithDbAsync(async (db, _) => types = await db.Notifications.IgnoreQueryFilters()
            .Where(n => n.UserId == userId).OrderBy(n => n.CreatedAt).Select(n => n.Type).ToListAsync());
        return types;
    }
}
