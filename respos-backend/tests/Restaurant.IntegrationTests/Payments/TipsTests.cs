using System.Net;
using System.Net.Http.Json;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Payments;

[Collection(ApiCollection.Name)]
public sealed class TipsTests(ApiFactory factory) : F2TestBase(factory)
{
    [Fact]
    public async Task Tips_are_not_revenue_but_appear_in_shift_summary_and_tips_report_per_waiter()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        var shift = await OpenShiftAsync(client, 10000m);
        var orderId = Id(await CreateOrderAsync(client, seed.Table1Id, Line(seed.PlovId)));

        var pay = await PayBillAsync(client, orderId, null, PlovPrice, tipAmount: 5000m);
        pay.StatusCode.Should().Be(HttpStatusCode.Created, await pay.Content.ReadAsStringAsync());
        (await ReadJsonAsync(pay)).GetProperty("tipAmount").GetDecimal().Should().Be(5000m);
        var negative = await PayBillAsync(client, orderId, null, 1m, tipAmount: -1m);
        negative.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var order = await GetOrderAsync(client, orderId);
        order.GetProperty("status").GetString().Should().Be("paid");
        order.GetProperty("paidAmount").GetDecimal().Should().Be(PlovPrice);
        order.GetProperty("total").GetDecimal().Should().Be(PlovPrice);

        var sales = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/sales"));
        sales.GetProperty("totalRevenue").GetDecimal().Should().Be(PlovPrice);
        var methods = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/payment-methods"));
        methods.EnumerateArray().Sum(m => m.GetProperty("amount").GetDecimal()).Should().Be(PlovPrice);

        var current = await ReadJsonAsync(await client.GetAsync("/api/v1/cash-shifts/current"));
        current.GetProperty("tipsAmount").GetDecimal().Should().Be(5000m);
        current.GetProperty("cashTipsAmount").GetDecimal().Should().Be(5000m);
        current.GetProperty("cashPaymentsAmount").GetDecimal().Should().Be(PlovPrice);
        current.GetProperty("expectedCashAmount").GetDecimal().Should().Be(10000m + PlovPrice + 5000m);

        var close = await client.PostAsJsonAsync($"/api/v1/cash-shifts/{Id(shift)}/close", new { actualCashAmount = 60000m }, Json);
        var closed = await ReadJsonAsync(close);
        closed.GetProperty("difference").GetDecimal().Should().Be(0m);
        closed.GetProperty("tipsAmount").GetDecimal().Should().Be(5000m);

        var report = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/tips"));
        report.GetProperty("totalTips").GetDecimal().Should().Be(5000m);
        var row = report.GetProperty("rows")[0];
        row.GetProperty("waiterId").GetGuid().Should().Be(org.User.Id);
        row.GetProperty("tipsAmount").GetDecimal().Should().Be(5000m);
        row.GetProperty("paymentsCount").GetInt32().Should().Be(1);
    }
}
