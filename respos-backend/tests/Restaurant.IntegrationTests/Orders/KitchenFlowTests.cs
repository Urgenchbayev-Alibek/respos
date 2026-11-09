using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.Infrastructure.Context;
using Restaurant.Infrastructure.Persistence.Context;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Orders;

[Collection(ApiCollection.Name)]
public sealed class KitchenFlowTests(ApiFactory factory) : PosTestBase(factory)
{
    [Fact]
    public async Task Cook_progress_on_tickets_drives_item_and_order_statuses()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var cookUser = await AddUserAsync(org, SystemRoles.Cook);
        var seed = await SeedPosAsync(org);
        var waiter = await BranchClientAsync(org);
        var cook = await BranchClientAsync(org, cookUser);
        var order = await CreateOrderAsync(waiter, seed.Table1Id, Line(seed.PlovId), Line(seed.TeaId));
        var orderId = Id(order);
        (await SendToKitchenAsync(waiter, orderId)).EnsureSuccessStatusCode();

        var hot = await TicketsAsync(cook, $"?stationId={seed.HotStationId}");
        hot.Should().ContainSingle();
        var hotTicket = hot[0];
        hotTicket.GetProperty("orderNumber").GetInt32().Should().Be(order.GetProperty("number").GetInt32());
        hotTicket.GetProperty("tableNumber").GetString().Should().Be("1");
        hotTicket.GetProperty("stationName").GetString().Should().Be("Горячий цех");
        var barTicket = (await TicketsAsync(cook, $"?stationId={seed.BarStationId}")).Single();

        (await cook.PostAsync($"/api/v1/kitchen/tickets/{Id(hotTicket)}/start", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await StatusAsync(waiter, orderId)).Should().Be("in_progress");

        var ready = await cook.PostAsync($"/api/v1/kitchen/tickets/{Id(hotTicket)}/ready", null);
        (await ReadJsonAsync(ready)).GetProperty("status").GetString().Should().Be("ready");
        (await StatusAsync(waiter, orderId)).Should().Be("partially_ready");

        var barItemId = barTicket.GetProperty("items")[0].GetProperty("id").GetGuid();
        (await cook.PostAsync($"/api/v1/kitchen/ticket-items/{barItemId}/ready", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await StatusAsync(waiter, orderId)).Should().Be("ready");

        var recall = await cook.PostAsync($"/api/v1/kitchen/tickets/{Id(hotTicket)}/recall", null);
        (await ReadJsonAsync(recall)).GetProperty("status").GetString().Should().Be("in_progress");
        (await StatusAsync(waiter, orderId)).Should().Be("partially_ready");
        (await cook.PostAsync($"/api/v1/kitchen/tickets/{Id(hotTicket)}/ready", null)).EnsureSuccessStatusCode();

        (await cook.PostAsync($"/api/v1/kitchen/tickets/{Id(hotTicket)}/served", null)).EnsureSuccessStatusCode();
        var serveAll = await waiter.PostAsync($"/api/v1/orders/{orderId}/serve-all", null);
        (await ReadJsonAsync(serveAll)).GetProperty("status").GetString().Should().Be("served");

        (await TicketsAsync(cook, string.Empty)).Should().BeEmpty();
        var served = await TicketsAsync(cook, "?status=served");
        served.Should().HaveCount(2);
        (await cook.PostAsync($"/api/v1/kitchen/tickets/{Id(hotTicket)}/start", null)).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await waiter.PostAsync($"/api/v1/kitchen/tickets/{Id(hotTicket)}/start", null)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Cancel_order_is_blocked_by_payments_and_otherwise_frees_table_and_cancels_tickets()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        var paidOrder = Id(await CreateOrderAsync(client, seed.Table1Id, Line(seed.TeaId, 2m)));
        (await PayAsync(client, paidOrder, TeaPrice)).EnsureSuccessStatusCode();
        var orderId = Id(await CreateOrderAsync(client, seed.Table2Id, Line(seed.PlovId)));
        (await SendToKitchenAsync(client, orderId)).EnsureSuccessStatusCode();

        var blocked = await client.PostAsJsonAsync($"/api/v1/orders/{paidOrder}/cancel", new { reason = "гость ушёл" });
        var noReason = await client.PostAsJsonAsync($"/api/v1/orders/{orderId}/cancel", new { reason = "" });
        var cancelled = await client.PostAsJsonAsync($"/api/v1/orders/{orderId}/cancel", new { reason = "гость ушёл" });

        blocked.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(blocked)).Should().Be("order.has_payments");
        noReason.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await ReadJsonAsync(cancelled);
        body.GetProperty("status").GetString().Should().Be("cancelled");
        body.GetProperty("history").EnumerateArray().Last().GetProperty("reason").GetString().Should().Be("гость ушёл");
        await WithDbAsync(async (db, _) =>
        {
            (await db.DiningTables.IgnoreQueryFilters().SingleAsync(t => t.Id == seed.Table2Id)).Status.Should().Be(TableStatus.Available);
            (await db.DiningTables.IgnoreQueryFilters().SingleAsync(t => t.Id == seed.Table1Id)).Status.Should().Be(TableStatus.Occupied);
            (await db.KitchenTickets.IgnoreQueryFilters().SingleAsync(t => t.OrderId == orderId)).Status.Should().Be(KitchenTicketStatus.Cancelled);
            (await db.AuditLogs.IgnoreQueryFilters().AnyAsync(a => a.Action == "order.cancelled" && a.EntityId == orderId.ToString())).Should().BeTrue();
        });
    }

    [Fact]
    public async Task Concurrent_order_updates_are_detected_by_xmin()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var orderId = Id(await CreateOrderAsync(await BranchClientAsync(org), null, Line(seed.TeaId)));

        await using var scopeA = Factory.Services.CreateAsyncScope();
        await using var scopeB = Factory.Services.CreateAsyncScope();
        var dbA = Tenant(scopeA.ServiceProvider, org);
        var dbB = Tenant(scopeB.ServiceProvider, org);
        var a = await dbA.Orders.SingleAsync(o => o.Id == orderId);
        var b = await dbB.Orders.SingleAsync(o => o.Id == orderId);
        a.GuestCount = 3;
        await dbA.SaveChangesAsync();
        b.GuestCount = 5;

        await dbB.Invoking(db => db.SaveChangesAsync(default)).Should().ThrowAsync<DbUpdateConcurrencyException>();
    }

    private static AppDbContext Tenant(IServiceProvider services, TestOrg org)
    {
        services.GetRequiredService<RequestContext>().SetUser(org.User.Id, org.OrganizationId, false);
        return services.GetRequiredService<AppDbContext>();
    }

    private static async Task<List<JsonElement>> TicketsAsync(HttpClient client, string query)
    {
        var response = await client.GetAsync("/api/v1/kitchen/tickets" + query);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await ReadJsonAsync(response)).EnumerateArray().ToList();
    }

    private static async Task<string?> StatusAsync(HttpClient client, Guid orderId) =>
        (await GetOrderAsync(client, orderId)).GetProperty("status").GetString();
}
