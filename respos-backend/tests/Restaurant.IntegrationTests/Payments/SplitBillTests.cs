using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Payments;

[Collection(ApiCollection.Name)]
public sealed class SplitBillTests(ApiFactory factory) : F2TestBase(factory)
{
    [Fact]
    public async Task Equal_split_rounds_to_the_last_bill_and_paying_all_bills_marks_the_order_paid()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        var orderId = Id(await CreateOrderAsync(client, seed.Table1Id, Line(seed.SaladId, 5m))); // 100 000

        var split = await SplitAsync(client, orderId, new { mode = "equal", parts = 3 });

        split.GetProperty("isSplit").GetBoolean().Should().BeTrue();
        var bills = Bills(split);
        bills.Select(b => b.Amount).Should().Equal(33333.33m, 33333.33m, 33333.34m);
        split.GetProperty("bills")[0].GetProperty("mode").GetString().Should().Be("equal");

        var withoutBill = await PayAsync(client, orderId, 1000m);
        withoutBill.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(withoutBill)).Should().Be("payment.bill_required");
        var addItem = await client.PostAsJsonAsync($"/api/v1/orders/{orderId}/items", new { items = new[] { Line(seed.TeaId) } }, Json);
        addItem.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(addItem)).Should().Be("order.split_active");
        var overpay = await PayBillAsync(client, orderId, bills[0].Id, 33333.34m);
        (await ReadErrorCodeAsync(overpay)).Should().Be("payment.exceeds_due");

        foreach (var (billId, amount) in bills)
        {
            (await GetOrderAsync(client, orderId)).GetProperty("status").GetString().Should().NotBe("paid");
            var pay = await PayBillAsync(client, orderId, billId, amount);
            pay.StatusCode.Should().Be(HttpStatusCode.Created, await pay.Content.ReadAsStringAsync());
            (await ReadJsonAsync(pay)).GetProperty("billId").GetGuid().Should().Be(billId);
        }

        var paid = await GetOrderAsync(client, orderId);
        paid.GetProperty("status").GetString().Should().Be("paid");
        paid.GetProperty("paidAmount").GetDecimal().Should().Be(100000m);
        paid.GetProperty("bills").EnumerateArray().Should().OnlyContain(b => b.GetProperty("status").GetString() == "paid");
    }

    [Fact]
    public async Task Split_by_items_with_partial_quantity_distributes_service_charge_and_sums_to_total()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org, servicePercent: 10m);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        var order = await CreateOrderAsync(client, seed.Table1Id, Line(seed.PlovId, 2m), Line(seed.TeaId));
        var orderId = Id(order);
        order.GetProperty("total").GetDecimal().Should().Be(107800m);

        var split = await SplitAsync(client, orderId, new
        {
            mode = "items",
            bills = new[] { new { items = new[] { new { orderItemId = ItemId(order, "Плов"), quantity = 1m } } } },
        });

        var bills = Bills(split);
        bills.Select(b => b.Amount).Should().Equal(49500m, 58300m);
        split.GetProperty("bills")[1].GetProperty("items").GetArrayLength().Should().Be(2);
        split.GetProperty("items").GetArrayLength().Should().Be(2);

        (await PayBillAsync(client, orderId, bills[1].Id, 58300m, method: "card")).StatusCode.Should().Be(HttpStatusCode.Created);
        (await PayBillAsync(client, orderId, bills[0].Id, 49500m)).StatusCode.Should().Be(HttpStatusCode.Created);
        (await GetOrderAsync(client, orderId)).GetProperty("status").GetString().Should().Be("paid");
    }

    [Fact]
    public async Task Merge_back_works_without_payments_and_is_refused_after_one()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var seed = await SeedPosAsync(org);
        var waiter = await BranchClientAsync(org);
        var cashier = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Cashier));
        await OpenShiftAsync(cashier);
        var orderId = Id(await CreateOrderAsync(waiter, seed.Table1Id, Line(seed.SaladId, 2m)));

        await SplitAsync(waiter, orderId, new { mode = "custom", amounts = new[] { 15000m, 25000m } });
        var again = await waiter.PostAsJsonAsync($"/api/v1/orders/{orderId}/split", new { mode = "equal", parts = 2 }, Json);
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(again)).Should().Be("order.already_split");
        var merged = await waiter.DeleteAsync($"/api/v1/orders/{orderId}/split");
        merged.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(merged)).GetProperty("bills").GetArrayLength().Should().Be(0);

        var mismatch = await waiter.PostAsJsonAsync($"/api/v1/orders/{orderId}/split", new { mode = "custom", amounts = new[] { 1m, 2m } }, Json);
        (await ReadErrorCodeAsync(mismatch)).Should().Be("order.split_mismatch");
        var bills = Bills(await SplitAsync(waiter, orderId, new { mode = "equal", parts = 2 }));
        (await PayBillAsync(cashier, orderId, bills[0].Id, bills[0].Amount)).StatusCode.Should().Be(HttpStatusCode.Created);

        var refused = await waiter.DeleteAsync($"/api/v1/orders/{orderId}/split");
        refused.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(refused)).Should().Be("order.has_payments");
        await WithDbAsync(async (db, _) =>
            (await db.OrderBills.CountAsync(b => b.OrderId == orderId)).Should().Be(2));
    }

    [Fact]
    public async Task Split_requires_orders_split_permission()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Cook);
        var seed = await SeedPosAsync(org);
        var owner = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Owner));
        var orderId = Id(await CreateOrderAsync(owner, seed.Table1Id, Line(seed.TeaId)));
        var cook = await BranchClientAsync(org);

        var response = await cook.PostAsJsonAsync($"/api/v1/orders/{orderId}/split", new { mode = "equal", parts = 2 }, Json);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
