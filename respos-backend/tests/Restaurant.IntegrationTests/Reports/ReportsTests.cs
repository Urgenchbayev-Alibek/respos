using System.Net;
using System.Text;
using System.Text.Json;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Reports;

[Collection(ApiCollection.Name)]
public sealed class ReportsTests(ApiFactory factory) : ApiTestBase(factory)
{
    private static readonly DateOnly Day1 = new(2026, 10, 10);
    private static readonly DateOnly Day2 = new(2026, 10, 11);

    [Fact]
    public async Task Sales_report_counts_only_paid_orders_subtracts_refunds_and_uses_business_date()
    {
        var (org, _) = await SeedSalesAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var both = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/sales?from=2026-10-10&to=2026-10-11"));
        both.GetProperty("totalRevenue").GetDecimal().Should().Be(210_000m);
        both.GetProperty("ordersCount").GetInt32().Should().Be(3);
        both.GetProperty("averageCheck").GetDecimal().Should().Be(70_000m);
        var days = both.GetProperty("byDay").EnumerateArray().ToList();
        days.Select(d => d.GetProperty("date").GetString()).Should().Equal("2026-10-10", "2026-10-11");
        days[0].GetProperty("revenue").GetDecimal().Should().Be(160_000m);
        days[0].GetProperty("orders").GetInt32().Should().Be(2);
        days[1].GetProperty("revenue").GetDecimal().Should().Be(50_000m);

        var first = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/sales?from=2026-10-10&to=2026-10-10"));
        first.GetProperty("averageCheck").GetDecimal().Should().Be(80_000m);

        var empty = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/sales?from=2026-01-01&to=2026-01-01"));
        empty.GetProperty("totalRevenue").GetDecimal().Should().Be(0m);
        empty.GetProperty("averageCheck").GetDecimal().Should().Be(0m);
    }

    [Fact]
    public async Task Item_category_and_payment_method_reports_aggregate_server_side_in_branch_timezone()
    {
        var (org, menu) = await SeedSalesAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var top = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/top-items?from=2026-10-10&to=2026-10-11&limit=5"));
        top.EnumerateArray().Select(i => (i.GetProperty("name").GetString(), i.GetProperty("quantity").GetDecimal(), i.GetProperty("revenue").GetDecimal()))
            .Should().Equal(("Плов", 4m, 200_000m), ("=Чай", 3m, 30_000m));

        var categories = (await ReadJsonAsync(await client.GetAsync("/api/v1/reports/sales-by-category?from=2026-10-10&to=2026-10-11"))).EnumerateArray().ToList();
        categories.Should().ContainSingle();
        categories[0].GetProperty("categoryId").GetGuid().Should().Be(menu.CategoryId);
        categories[0].GetProperty("revenue").GetDecimal().Should().Be(230_000m);

        // Day 2 in Tashkent = [2026-10-10T19:00Z, 2026-10-11T19:00Z): the 19:00Z payment is in, the 18:59Z one is not.
        var day2 = await PaymentMethodsAsync(client, "2026-10-11");
        day2.Should().BeEquivalentTo(new Dictionary<string, (decimal, int)> { ["cash"] = (50_000m, 1), ["card"] = (-20_000m, 0) });
        var day1 = await PaymentMethodsAsync(client, "2026-10-10");
        day1.Should().BeEquivalentTo(new Dictionary<string, (decimal, int)> { ["cash"] = (100_000m, 1), ["card"] = (80_000m, 1) });
    }

    [Fact]
    public async Task Reports_validate_period_and_require_reports_permission()
    {
        var org = await CreateOrgWithUserAsync();
        var owner = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        (await owner.GetAsync("/api/v1/reports/sales?from=2026-10-11&to=2026-10-10")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.GetAsync("/api/v1/reports/nope/export?format=csv")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await owner.GetAsync("/api/v1/reports/sales/export?format=xlsx")).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var waiter = ClientWithBranch(await LoginAsAsync(await AddUserAsync(org, SystemRoles.Waiter)), org.BranchId);
        (await waiter.GetAsync("/api/v1/reports/sales")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await waiter.GetAsync("/api/v1/dashboard")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Csv_export_is_utf8_bom_text_csv_and_injection_safe()
    {
        var (org, _) = await SeedSalesAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var response = await client.GetAsync("/api/v1/reports/top-items/export?format=csv&from=2026-10-10&to=2026-10-11");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/csv");
        var bytes = await response.Content.ReadAsByteArrayAsync();
        bytes.Take(3).Should().Equal(0xEF, 0xBB, 0xBF);
        var lines = Encoding.UTF8.GetString(bytes[3..]).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        lines[0].Should().Be("menuItemId,name,quantity,revenue");
        lines.Should().Contain(l => l.EndsWith(",Плов,4.000,200000.00"));
        lines.Should().Contain(l => l.EndsWith(",'=Чай,3.000,30000.00"));
    }

    private static async Task<Dictionary<string, (decimal Amount, int Count)>> PaymentMethodsAsync(HttpClient client, string day)
    {
        var json = await ReadJsonAsync(await client.GetAsync($"/api/v1/reports/payment-methods?from={day}&to={day}"));
        return json.EnumerateArray().ToDictionary(
            m => m.GetProperty("method").GetString()!,
            m => (m.GetProperty("amount").GetDecimal(), m.GetProperty("count").GetInt32()));
    }

    /// <summary>
    /// Day 1: A (plov×2 = 100 000, cash, 08:00Z), B (tea×3 + plov = 80 000, card, 18:59Z = 23:59 local) refunded 20 000;
    /// Day 2: C (plov = 50 000, cash, 19:00Z of day 1 = 00:00 local day 2). Plus an unpaid order (ignored).
    /// </summary>
    private async Task<(TestOrg Org, TestMenu Menu)> SeedSalesAsync()
    {
        var org = await CreateOrgWithUserAsync();
        TestMenu? menu = null;
        await WithDbAsync(async (db, _) =>
        {
            menu = await SalesTestData.SeedMenuAsync(db, org, new DateTime(2026, 10, 10, 3, 0, 0, DateTimeKind.Utc));
            var data = new SalesTestData(org);
            data.PaidOrder(db, menu, Day1, Utc(2026, 10, 10, 8, 0), PaymentMethod.Cash, (menu.Plov, 2m));
            var (orderB, paymentB) = data.PaidOrder(db, menu, Day1, Utc(2026, 10, 10, 18, 59), PaymentMethod.Card, (menu.Tea, 3m), (menu.Plov, 1m));
            data.PaidOrder(db, menu, Day2, Utc(2026, 10, 10, 19, 0), PaymentMethod.Cash, (menu.Plov, 1m));
            data.OpenOrder(db, Day1, Utc(2026, 10, 10, 9, 0), (menu.Plov, 5m));
            data.Refund(db, menu, orderB, paymentB, 20_000m, Utc(2026, 10, 11, 5, 0));
            await db.SaveChangesAsync();
        });
        return (org, menu!);
    }

    private static DateTime Utc(int y, int m, int d, int h, int min) => new(y, m, d, h, min, 0, DateTimeKind.Utc);
}
