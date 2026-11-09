using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Orders;

[Collection(ApiCollection.Name)]
public sealed class OrdersTests(ApiFactory factory) : PosTestBase(factory)
{
    [Fact]
    public async Task Waiter_creates_dine_in_order_with_snapshots_totals_and_occupied_table()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var seed = await SeedPosAsync(org, servicePercent: 10m, taxPercent: 12m);
        var client = await BranchClientAsync(org);

        var order = await CreateOrderAsync(client, seed.Table1Id,
            Line(seed.PlovId, 2m, seed.PlovHalfVariantId), Line(seed.LagmanId, 1m, null, seed.SpicyOptionId));

        order.GetProperty("status").GetString().Should().Be("draft");
        order.GetProperty("number").GetInt32().Should().Be(1);
        order.GetProperty("tableNumber").GetString().Should().Be("1");
        var plov = order.GetProperty("items").EnumerateArray().First(i => i.GetProperty("name").GetString() == "Плов");
        plov.GetProperty("variantName").GetString().Should().Be("0.5 порции");
        plov.GetProperty("unitPrice").GetDecimal().Should().Be(PlovHalfPrice);
        plov.GetProperty("lineTotal").GetDecimal().Should().Be(2 * PlovHalfPrice);
        var lagman = order.GetProperty("items").EnumerateArray().First(i => i.GetProperty("name").GetString() == "Лагман");
        lagman.GetProperty("modifiers")[0].GetProperty("priceDelta").GetDecimal().Should().Be(SpicyDelta);
        var subtotal = 2 * PlovHalfPrice + LagmanPrice + SpicyDelta;                // 82 000
        order.GetProperty("subtotal").GetDecimal().Should().Be(subtotal);
        order.GetProperty("serviceChargeAmount").GetDecimal().Should().Be(8200m);
        order.GetProperty("taxAmount").GetDecimal().Should().Be(10824m);            // (82 000 + 8 200) × 12%
        order.GetProperty("total").GetDecimal().Should().Be(101024m);
        order.GetProperty("remainingAmount").GetDecimal().Should().Be(101024m);

        await WithDbAsync(async (db, _) =>
            (await db.DiningTables.IgnoreQueryFilters().SingleAsync(t => t.Id == seed.Table1Id)).Status.Should().Be(TableStatus.Occupied));
        (await CreateOrderAsync(client, null, Line(seed.TeaId))).GetProperty("number").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task Concurrent_orders_get_unique_sequential_numbers()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);

        var orders = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => CreateOrderAsync(client, null, Line(seed.TeaId))));

        orders.Select(o => o.GetProperty("number").GetInt32()).Should().BeEquivalentTo(Enumerable.Range(1, 6));
    }

    [Fact]
    public async Task Archived_or_unavailable_items_and_missing_required_modifiers_are_rejected()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);

        foreach (var itemId in new[] { seed.ArchivedId, seed.UnavailableId, Guid.NewGuid() })
        {
            var response = await client.PostAsJsonAsync("/api/v1/orders", new { type = "takeaway", guestCount = 1, items = new[] { Line(itemId) } }, Json);
            response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
            (await ReadErrorCodeAsync(response)).Should().Be("order.menu_item_unavailable");
        }

        var noSauce = await client.PostAsJsonAsync("/api/v1/orders", new { type = "takeaway", guestCount = 1, items = new[] { Line(seed.LagmanId) } }, Json);
        noSauce.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadErrorCodeAsync(noSauce)).Should().Be("validation.failed");
        var twoSauces = await client.PostAsJsonAsync("/api/v1/orders",
            new { type = "takeaway", guestCount = 1, items = new[] { Line(seed.LagmanId, 1m, null, seed.SpicyOptionId, seed.MildOptionId) } }, Json);
        twoSauces.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Partial_send_creates_one_ticket_per_station_and_defaults_items_without_station()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        var order = await CreateOrderAsync(client, seed.Table1Id, Line(seed.PlovId), Line(seed.TeaId), Line(seed.SaladId));
        var orderId = Id(order);

        var first = await SendToKitchenAsync(client, orderId, [ItemId(order, "Плов"), ItemId(order, "Чай")]);
        first.StatusCode.Should().Be(HttpStatusCode.OK, await first.Content.ReadAsStringAsync());
        var afterFirst = await ReadJsonAsync(first);
        afterFirst.GetProperty("status").GetString().Should().Be("submitted");
        afterFirst.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("name").GetString() == "Салат")
            .GetProperty("status").GetString().Should().Be("new");

        var second = await SendToKitchenAsync(client, orderId);
        second.StatusCode.Should().Be(HttpStatusCode.OK);

        await WithDbAsync(async (db, _) =>
        {
            var tickets = await db.KitchenTickets.IgnoreQueryFilters().Include(t => t.Items).Where(t => t.OrderId == orderId).ToListAsync();
            tickets.Should().HaveCount(3);
            tickets.Where(t => t.Number == 1).Select(t => t.KitchenStationId).Should().BeEquivalentTo([seed.HotStationId, seed.BarStationId]);
            tickets.Single(t => t.Number == 2).KitchenStationId.Should().Be(seed.HotStationId);
            tickets.Should().OnlyContain(t => t.Items.Count == 1 && t.Status == KitchenTicketStatus.New);
        });
    }

    [Fact]
    public async Task Send_to_kitchen_is_idempotent_per_key()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        var orderId = Id(await CreateOrderAsync(client, seed.Table1Id, Line(seed.PlovId), Line(seed.TeaId)));
        var key = Guid.NewGuid().ToString();

        var first = await SendToKitchenAsync(client, orderId, key: key);
        var replay = await SendToKitchenAsync(client, orderId, key: key);
        var newKey = await SendToKitchenAsync(client, orderId);

        first.StatusCode.Should().Be(HttpStatusCode.OK);
        replay.StatusCode.Should().Be(HttpStatusCode.OK);
        replay.Headers.GetValues("Idempotent-Replayed").Should().Equal("true");
        newKey.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(newKey)).Should().Be("order.nothing_to_send");
        await WithDbAsync(async (db, _) =>
            (await db.KitchenTickets.IgnoreQueryFilters().CountAsync(t => t.OrderId == orderId)).Should().Be(2));
    }

    [Fact]
    public async Task Waiter_needs_orders_cancel_to_cancel_a_sent_item()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var manager = await AddUserAsync(org, SystemRoles.Manager);
        var seed = await SeedPosAsync(org);
        var waiter = await BranchClientAsync(org);
        var order = await CreateOrderAsync(waiter, seed.Table1Id, Line(seed.PlovId), Line(seed.TeaId));
        var orderId = Id(order);
        (await SendToKitchenAsync(waiter, orderId, [ItemId(order, "Плов")])).EnsureSuccessStatusCode();

        var sent = await waiter.PostAsJsonAsync($"/api/v1/orders/{orderId}/items/{ItemId(order, "Плов")}/cancel", new { reason = "гость передумал" });
        var unsent = await waiter.PostAsJsonAsync($"/api/v1/orders/{orderId}/items/{ItemId(order, "Чай")}/cancel", new { reason = "ошибка" });
        var byManager = await (await BranchClientAsync(org, manager))
            .PostAsJsonAsync($"/api/v1/orders/{orderId}/items/{ItemId(order, "Плов")}/cancel", new { reason = "гость передумал" });

        sent.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReadErrorCodeAsync(sent)).Should().Be("auth.forbidden");
        unsent.StatusCode.Should().Be(HttpStatusCode.OK);
        byManager.StatusCode.Should().Be(HttpStatusCode.OK, await byManager.Content.ReadAsStringAsync());
        var result = await ReadJsonAsync(byManager);
        result.GetProperty("total").GetDecimal().Should().Be(0m);
        result.GetProperty("status").GetString().Should().Be("draft");
        await WithDbAsync(async (db, _) =>
        {
            var ticket = await db.KitchenTickets.IgnoreQueryFilters().Include(t => t.Items).SingleAsync(t => t.OrderId == orderId);
            ticket.Status.Should().Be(KitchenTicketStatus.Cancelled);
            (await db.AuditLogs.IgnoreQueryFilters().CountAsync(a => a.Action == "order_item.cancelled" && a.OrganizationId == org.OrganizationId))
                .Should().Be(2);
        });
    }

    [Fact]
    public async Task Other_organizations_order_is_not_found()
    {
        var orgA = await CreateOrgWithUserAsync();
        var orgB = await CreateOrgWithUserAsync();
        var seedB = await SeedPosAsync(orgB);
        var orderB = Id(await CreateOrderAsync(await BranchClientAsync(orgB), seedB.Table1Id, Line(seedB.PlovId)));
        var clientA = await BranchClientAsync(orgA);

        (await clientA.GetAsync($"/api/v1/orders/{orderB}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        var cancel = await clientA.PostAsJsonAsync($"/api/v1/orders/{orderB}/cancel", new { reason = "x" });
        cancel.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(cancel)).Should().Be("order.not_found");
        (await PostWithKeyAsync(clientA, $"/api/v1/orders/{orderB}/send-to-kitchen", new { })).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Discount_requires_permission_and_reason_and_is_audited()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var manager = await AddUserAsync(org, SystemRoles.Manager);
        var seed = await SeedPosAsync(org, servicePercent: 10m);
        var waiter = await BranchClientAsync(org);
        var orderId = Id(await CreateOrderAsync(waiter, seed.Table1Id, Line(seed.PlovId)));
        var managerClient = await BranchClientAsync(org, manager);

        (await waiter.PostAsJsonAsync($"/api/v1/orders/{orderId}/discount", new { type = "percent", value = 10, reason = "VIP" }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await managerClient.PostAsJsonAsync($"/api/v1/orders/{orderId}/discount", new { type = "percent", value = 10 }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var ok = await managerClient.PostAsJsonAsync($"/api/v1/orders/{orderId}/discount", new { type = "percent", value = 10, reason = "VIP" });

        var order = await ReadJsonAsync(ok);
        order.GetProperty("discountAmount").GetDecimal().Should().Be(4500m);
        order.GetProperty("serviceChargeAmount").GetDecimal().Should().Be(4050m);
        order.GetProperty("total").GetDecimal().Should().Be(44550m);
        await WithDbAsync(async (db, _) =>
            (await db.AuditLogs.IgnoreQueryFilters().AnyAsync(a => a.Action == "order.discount_applied" && a.EntityId == orderId.ToString()))
            .Should().BeTrue());
    }

    [Fact]
    public async Task Transfer_moves_the_order_and_updates_both_tables()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        var orderId = Id(await CreateOrderAsync(client, seed.Table1Id, Line(seed.TeaId)));

        var response = await client.PostAsJsonAsync($"/api/v1/orders/{orderId}/transfer", new { tableId = seed.Table2Id });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(response)).GetProperty("tableId").GetGuid().Should().Be(seed.Table2Id);
        await WithDbAsync(async (db, _) =>
        {
            var tables = await db.DiningTables.IgnoreQueryFilters().Where(t => t.BranchId == org.BranchId).ToDictionaryAsync(t => t.Id);
            tables[seed.Table1Id].Status.Should().Be(TableStatus.Available);
            tables[seed.Table2Id].Status.Should().Be(TableStatus.Occupied);
        });
        var paged = await ReadJsonAsync(await client.GetAsync($"/api/v1/orders?status=draft,in_progress&tableId={seed.Table2Id}&pageSize=5"));
        paged.GetProperty("totalCount").GetInt32().Should().Be(1);
        paged.GetProperty("items")[0].GetProperty("id").GetGuid().Should().Be(orderId);
        (await ReadJsonAsync(await client.GetAsync("/api/v1/orders?status=paid"))).GetProperty("totalCount").GetInt32().Should().Be(0);
        (await ReadJsonAsync(await client.GetAsync("/api/v1/orders/active"))).GetArrayLength().Should().Be(1);
    }
}
