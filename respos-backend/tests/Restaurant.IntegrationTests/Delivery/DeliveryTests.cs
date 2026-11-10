using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;
using Restaurant.IntegrationTests.Orders;

namespace Restaurant.IntegrationTests.Delivery;

[Collection(ApiCollection.Name)]
public sealed class DeliveryTests(ApiFactory factory) : PosTestBase(factory)
{
    private const decimal Fee = 12000m;

    [Fact]
    public async Task Delivery_runs_from_new_to_delivered_with_fee_in_totals_and_kitchen_auto_ready()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org, servicePercent: 10m);
        var owner = await BranchClientAsync(org);
        var cashier = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Cashier));
        var cook = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Cook));
        await SetDeliverySettingsAsync(owner, org, Fee);

        var courierResponse = await cashier.PostAsJsonAsync("/api/v1/delivery/couriers", new { name = "Бобур", phone = "90 111 22 33" }, Json);
        courierResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var courier = await ReadJsonAsync(courierResponse);
        courier.GetProperty("phone").GetString().Should().Be("+998901112233");

        var created = await cashier.PostAsJsonAsync("/api/v1/delivery/orders", new
        {
            customerName = "Алишер", customerPhone = "901234567", address = "ул. Навои, 5", entrance = "2", floor = "3",
            items = new[] { Line(seed.PlovId, 2m) },
        }, Json);
        created.StatusCode.Should().Be(HttpStatusCode.Created, await created.Content.ReadAsStringAsync());
        var delivery = await ReadJsonAsync(created);
        var orderId = delivery.GetProperty("orderId").GetGuid();
        delivery.GetProperty("status").GetString().Should().Be("new");
        delivery.GetProperty("customerPhone").GetString().Should().Be("+998901234567");
        delivery.GetProperty("deliveryFee").GetDecimal().Should().Be(Fee);
        delivery.GetProperty("total").GetDecimal().Should().Be((2 * PlovPrice * 1.1m) + Fee); // service on food only, fee on top

        var order = await GetOrderAsync(owner, orderId);
        order.GetProperty("type").GetString().Should().Be("delivery");
        order.GetProperty("deliveryFee").GetDecimal().Should().Be(Fee);
        order.GetProperty("total").GetDecimal().Should().Be(delivery.GetProperty("total").GetDecimal());

        (await StatusAsync(cashier, orderId, "on_the_way")).StatusCode.Should().Be(HttpStatusCode.Conflict);
        var accepted = await ReadJsonAsync(await StatusAsync(cashier, orderId, "accepted"));
        accepted.GetProperty("orderStatus").GetString().Should().Be("submitted");
        var ticket = (await ReadJsonAsync(await cook.GetAsync("/api/v1/kitchen/tickets"))).EnumerateArray()
            .Single(t => t.GetProperty("orderId").GetGuid() == orderId);
        (await cook.PostAsync($"/api/v1/kitchen/tickets/{Id(ticket)}/start", null)).EnsureSuccessStatusCode();
        (await cook.PostAsync($"/api/v1/kitchen/tickets/{Id(ticket)}/ready", null)).EnsureSuccessStatusCode();

        var ready = await GetDeliveryAsync(cashier, orderId);
        ready.GetProperty("status").GetString().Should().Be("ready");
        ready.GetProperty("readyAt").ValueKind.Should().Be(JsonValueKind.String);

        var noCourier = await StatusAsync(cashier, orderId, "on_the_way");
        noCourier.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(noCourier)).Should().Be("delivery.courier_required");
        var assigned = await cashier.PostAsJsonAsync($"/api/v1/delivery/orders/{orderId}/courier", new { courierId = Id(courier) }, Json);
        (await ReadJsonAsync(assigned)).GetProperty("courier").GetProperty("name").GetString().Should().Be("Бобур");
        (await StatusAsync(cashier, orderId, "on_the_way")).EnsureSuccessStatusCode();
        (await GetOrderAsync(owner, orderId)).GetProperty("status").GetString().Should().Be("served");
        var delivered = await ReadJsonAsync(await StatusAsync(cashier, orderId, "delivered"));
        delivered.GetProperty("allowedTransitions").GetArrayLength().Should().Be(0);

        var board = await ReadJsonAsync(await cashier.GetAsync("/api/v1/delivery/orders"));
        board.EnumerateArray().Should().Contain(d => d.GetProperty("orderId").GetGuid() == orderId);
        var filtered = await ReadJsonAsync(await cashier.GetAsync("/api/v1/delivery/orders?status=new,on_the_way"));
        filtered.EnumerateArray().Should().NotContain(d => d.GetProperty("orderId").GetGuid() == orderId);

        await OpenShiftAsync(cashier);
        (await PayAsync(cashier, orderId, delivery.GetProperty("total").GetDecimal())).StatusCode.Should().Be(HttpStatusCode.Created);
        (await GetOrderAsync(owner, orderId)).GetProperty("status").GetString().Should().Be("paid");
    }

    [Fact]
    public async Task Cancel_cancels_the_order_and_tickets_and_permissions_are_enforced()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Cashier);
        var seed = await SeedPosAsync(org);
        var cashier = await BranchClientAsync(org);
        var waiter = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Waiter));
        object Body(string phone, params object[] items) =>
            new { customerName = "Гость", customerPhone = phone, address = "Чиланзар", items };

        (await waiter.PostAsJsonAsync("/api/v1/delivery/orders", Body("+998 90 000 00 01", Line(seed.TeaId)), Json))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await waiter.GetAsync("/api/v1/delivery/orders")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await cashier.PostAsJsonAsync("/api/v1/delivery/orders", Body("12", Line(seed.TeaId)), Json))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await cashier.PostAsJsonAsync("/api/v1/delivery/orders", Body("+998 90 000 00 01"), Json))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var create = await cashier.PostAsJsonAsync("/api/v1/delivery/orders", Body("+998 90 000 00 01", Line(seed.TeaId)), Json);
        var orderId = (await ReadJsonAsync(create)).GetProperty("orderId").GetGuid();
        (await StatusAsync(cashier, orderId, "accepted")).EnsureSuccessStatusCode();
        (await ReadErrorCodeAsync(await StatusAsync(cashier, orderId, "cancelled"))).Should().Be("delivery.cancel_reason_required");

        var cancelled = await ReadJsonAsync(await StatusAsync(cashier, orderId, "cancelled", "клиент отказался"));
        cancelled.GetProperty("status").GetString().Should().Be("cancelled");
        cancelled.GetProperty("orderStatus").GetString().Should().Be("cancelled");
        await WithDbAsync(async (db, _) =>
            (await db.KitchenTickets.IgnoreQueryFilters().SingleAsync(t => t.OrderId == orderId)).Status.Should().Be(KitchenTicketStatus.Cancelled));
        (await StatusAsync(cashier, orderId, "accepted")).StatusCode.Should().Be(HttpStatusCode.Conflict);

        var other = await CreateOrgWithUserAsync(SystemRoles.Cashier);
        var stranger = await BranchClientAsync(other);
        (await stranger.GetAsync($"/api/v1/delivery/orders/{orderId}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Generic_order_endpoint_rejects_delivery_type()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);

        var response = await client.PostAsJsonAsync("/api/v1/orders", new { type = "delivery", guestCount = 1, items = new[] { Line(seed.TeaId) } }, Json);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Branch_slug_is_unique_across_organizations_and_listed()
    {
        var first = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var second = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var a = await BranchClientAsync(first);
        var b = await BranchClientAsync(second);
        var slug = await SetDeliverySettingsAsync(a, first, 0m);

        var branches = await ReadJsonAsync(await a.GetAsync("/api/v1/branches"));
        branches.EnumerateArray().Single(x => Id(x) == first.BranchId).GetProperty("slug").GetString().Should().Be(slug);
        var settings = await ReadJsonAsync(await b.GetAsync($"/api/v1/branches/{second.BranchId}/delivery-settings"));
        settings.GetProperty("slug").GetString().Should().StartWith("main-");

        var taken = await b.PutAsJsonAsync($"/api/v1/branches/{second.BranchId}/delivery-settings", new { slug = slug.ToUpperInvariant(), deliveryFee = 0m }, Json);
        taken.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(taken)).Should().Be("branch.slug_taken");
        var invalid = await b.PutAsJsonAsync($"/api/v1/branches/{second.BranchId}/delivery-settings", new { slug = "bad slug!", deliveryFee = 0m }, Json);
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await b.GetAsync($"/api/v1/branches/{first.BranchId}/delivery-settings")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private static async Task<string> SetDeliverySettingsAsync(HttpClient owner, TestOrg org, decimal fee)
    {
        var slug = $"cafe-{Guid.NewGuid():N}"[..20];
        var response = await owner.PutAsJsonAsync($"/api/v1/branches/{org.BranchId}/delivery-settings", new { slug, deliveryFee = fee }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        (await ReadJsonAsync(response)).GetProperty("deliveryFee").GetDecimal().Should().Be(fee);
        return slug;
    }

    private static Task<HttpResponseMessage> StatusAsync(HttpClient client, Guid orderId, string status, string? reason = null) =>
        client.PostAsJsonAsync($"/api/v1/delivery/orders/{orderId}/status", new { status, reason }, Json);

    private static async Task<JsonElement> GetDeliveryAsync(HttpClient client, Guid orderId)
    {
        var response = await client.GetAsync($"/api/v1/delivery/orders/{orderId}");
        response.EnsureSuccessStatusCode();
        return await ReadJsonAsync(response);
    }
}
