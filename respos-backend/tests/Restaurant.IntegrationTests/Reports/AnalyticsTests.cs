using System.Net;
using System.Text;
using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Entities.Orders;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Reports;

[Collection(ApiCollection.Name)]
public sealed class AnalyticsTests(ApiFactory factory) : ApiTestBase(factory)
{
    private const string Period = "from=2026-10-10&to=2026-10-11";
    private static readonly DateOnly Day1 = new(2026, 10, 10); // Saturday
    private static readonly DateOnly Day2 = new(2026, 10, 11); // Sunday

    [Fact]
    public async Task Abc_classifies_items_by_revenue_quantity_and_margin_using_recipe_cost()
    {
        var (org, _) = await SeedAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var revenue = await ReadJsonAsync(await client.GetAsync($"/api/v1/reports/abc?{Period}&metric=revenue"));
        revenue.GetProperty("total").GetDecimal().Should().Be(230_000m);
        Classes(revenue).Should().Equal(("Плов", "A"), ("=Чай", "B"));

        var quantity = await ReadJsonAsync(await client.GetAsync($"/api/v1/reports/abc?{Period}&metric=quantity"));
        Classes(quantity).Should().Equal(("Плов", "A"), ("=Чай", "A"));

        // Margin: plov 200 000 − 4 × 5 000 = 180 000; tea 30 000 − 3 × 5 000 = 15 000 (cumulative before = 92.3 % → B).
        var margin = await ReadJsonAsync(await client.GetAsync($"/api/v1/reports/abc?{Period}&metric=margin"));
        var items = margin.GetProperty("items").EnumerateArray().ToList();
        items[0].GetProperty("cost").GetDecimal().Should().Be(20_000m);
        items[0].GetProperty("margin").GetDecimal().Should().Be(180_000m);
        items[1].GetProperty("margin").GetDecimal().Should().Be(15_000m);
        Classes(margin).Should().Equal(("Плов", "A"), ("=Чай", "B"));
    }

    [Fact]
    public async Task Food_cost_converts_recipe_units_to_the_base_unit_and_flags_dishes_above_threshold()
    {
        var (org, _) = await SeedAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var report = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/food-cost"));
        report.GetProperty("thresholdPercent").GetDecimal().Should().Be(35m);
        report.GetProperty("aboveThresholdCount").GetInt32().Should().Be(1);
        var rows = report.GetProperty("items").EnumerateArray().ToDictionary(r => r.GetProperty("name").GetString()!);
        rows["=Чай"].GetProperty("recipeCost").GetDecimal().Should().Be(5_000m);
        rows["=Чай"].GetProperty("foodCostPercent").GetDecimal().Should().Be(50m);
        rows["=Чай"].GetProperty("isAboveThreshold").GetBoolean().Should().BeTrue();
        rows["Плов"].GetProperty("recipeCost").GetDecimal().Should().Be(5_000m);
        rows["Плов"].GetProperty("foodCostPercent").GetDecimal().Should().Be(10m);
        rows["Плов"].GetProperty("marginPercent").GetDecimal().Should().Be(90m);

        var relaxed = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/food-cost?threshold=60"));
        relaxed.GetProperty("aboveThresholdCount").GetInt32().Should().Be(0);
        (await client.GetAsync("/api/v1/reports/food-cost?threshold=0")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Heatmap_buckets_by_local_weekday_and_hour_across_the_timezone_midnight()
    {
        var (org, _) = await SeedAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var json = await ReadJsonAsync(await client.GetAsync($"/api/v1/reports/heatmap?{Period}"));
        var cells = json.GetProperty("cells").EnumerateArray()
            .ToDictionary(c => (c.GetProperty("weekday").GetInt32(), c.GetProperty("hour").GetInt32()),
                c => (c.GetProperty("orders").GetInt32(), c.GetProperty("revenue").GetDecimal()));
        cells.Should().HaveCount(168);
        cells[(6, 13)].Should().Be((1, 100_000m));  // 08:00Z = 13:00 Saturday
        cells[(6, 23)].Should().Be((1, 60_000m));   // 18:59Z = 23:59 Saturday, 80 000 − 20 000 refund
        cells[(7, 0)].Should().Be((1, 50_000m));    // 19:00Z = 00:00 Sunday
        cells.Values.Sum(v => v.Item1).Should().Be(3);
        json.GetProperty("maxRevenue").GetDecimal().Should().Be(100_000m);
    }

    [Fact]
    public async Task Sales_summary_compares_with_the_previous_period_of_equal_length()
    {
        var (org, _) = await SeedAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var json = await ReadJsonAsync(await client.GetAsync("/api/v1/reports/sales-summary?from=2026-10-11&to=2026-10-11"));

        json.GetProperty("previousFrom").GetString().Should().Be("2026-10-10");
        json.GetProperty("previousTo").GetString().Should().Be("2026-10-10");
        json.GetProperty("current").GetProperty("revenue").GetDecimal().Should().Be(50_000m);
        json.GetProperty("previous").GetProperty("revenue").GetDecimal().Should().Be(160_000m);
        json.GetProperty("previous").GetProperty("refunds").GetDecimal().Should().Be(20_000m);
        json.GetProperty("previous").GetProperty("itemsSold").GetDecimal().Should().Be(6m);
        var deltas = json.GetProperty("deltas");
        deltas.GetProperty("revenue").GetDecimal().Should().Be(-68.8m);
        deltas.GetProperty("ordersCount").GetDecimal().Should().Be(-50m);
        deltas.GetProperty("itemsSold").GetDecimal().Should().Be(-83.3m);
        deltas.GetProperty("discountsAmount").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task Waiter_performance_and_discounts_cancellations_aggregate_per_waiter()
    {
        var (org, menu) = await SeedAsync();
        var waiter = await AddUserAsync(org, SystemRoles.Waiter);
        await WithDbAsync(async (db, _) =>
        {
            var data = new AnalyticsTestData(org, menu);
            var at = Utc(2026, 10, 10, 10);
            var discounted = data.NewOrder(waiter.Id, Day1, at, (menu.Plov, 2m));
            discounted.ApplyDiscount(DiscountType.Percent, 10m, OrderPricingSettings.None);
            data.Pay(db, discounted, at);
            var withCancelledLine = data.NewOrder(waiter.Id, Day1, at, (menu.Plov, 1m), (menu.Tea, 1m));
            withCancelledLine.CancelItem(withCancelledLine.Items[1].Id, "Гость передумал", OrderPricingSettings.None, waiter.Id, at);
            data.Pay(db, withCancelledLine, at);
            var cancelled = data.NewOrder(waiter.Id, Day2, at.AddDays(1), (menu.Plov, 1m));
            cancelled.Cancel("Ушли", waiter.Id, at.AddDays(1));
            db.Add(cancelled);
            await db.SaveChangesAsync();
        });
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var waiters = (await ReadJsonAsync(await client.GetAsync($"/api/v1/reports/waiters?{Period}"))).EnumerateArray().ToList();
        var row = waiters.Single(w => w.GetProperty("waiterId").GetGuid() == waiter.Id);
        row.GetProperty("ordersCount").GetInt32().Should().Be(2);
        row.GetProperty("revenue").GetDecimal().Should().Be(140_000m);
        row.GetProperty("averageCheck").GetDecimal().Should().Be(70_000m);
        row.GetProperty("itemsSold").GetDecimal().Should().Be(3m);
        row.GetProperty("cancelledOrders").GetInt32().Should().Be(1);
        row.GetProperty("cancelledItems").GetInt32().Should().Be(1);
        row.GetProperty("discountsAmount").GetDecimal().Should().Be(10_000m);
        row.GetProperty("tipsAmount").GetDecimal().Should().Be(0m);
        waiters.Single(w => w.GetProperty("waiterId").GetGuid() == org.User.Id).GetProperty("revenue").GetDecimal().Should().Be(210_000m);

        var report = await ReadJsonAsync(await client.GetAsync($"/api/v1/reports/discounts-cancellations?{Period}"));
        var discounts = report.GetProperty("discounts");
        discounts.GetProperty("ordersCount").GetInt32().Should().Be(1);
        discounts.GetProperty("amount").GetDecimal().Should().Be(10_000m);
        discounts.GetProperty("orders")[0].GetProperty("waiterName").GetString().Should().Be("Test User");
        var cancellations = report.GetProperty("cancellations");
        cancellations.GetProperty("ordersCount").GetInt32().Should().Be(1);
        cancellations.GetProperty("ordersAmount").GetDecimal().Should().Be(50_000m);
        cancellations.GetProperty("itemsCount").GetInt32().Should().Be(1);
        cancellations.GetProperty("itemsAmount").GetDecimal().Should().Be(10_000m);
        cancellations.GetProperty("byReason").EnumerateArray()
            .Select(r => (r.GetProperty("reason").GetString(), r.GetProperty("ordersCount").GetInt32(), r.GetProperty("itemsCount").GetInt32()))
            .Should().Equal(("Ушли", 1, 0), ("Гость передумал", 0, 1));
    }

    [Fact]
    public async Task Xlsx_export_returns_a_valid_workbook_for_every_report()
    {
        var (org, menu) = await SeedAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        string[] names =
        [
            "sales", "top-items", "sales-by-category", "payment-methods", "stock", "low-stock", "stock-movements", "cash-shifts",
            "sales-summary", "abc", "food-cost", "waiters", "heatmap", "discounts-cancellations", "z-report",
        ];

        foreach (var name in names)
        {
            var response = await client.GetAsync($"/api/v1/reports/{name}/export?format=xlsx&{Period}&shiftId={menu.ShiftId}");
            response.StatusCode.Should().Be(HttpStatusCode.OK, name);
            response.Content.Headers.ContentType!.MediaType.Should().Be("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            using var workbook = new XLWorkbook(new MemoryStream(await response.Content.ReadAsByteArrayAsync()));
            workbook.Worksheets.Should().NotBeEmpty(name);
        }

        var summary = await client.GetAsync($"/api/v1/reports/sales-summary/export?format=xlsx&{Period}&lang=en");
        using var book = new XLWorkbook(new MemoryStream(await summary.Content.ReadAsByteArrayAsync()));
        var sheet = book.Worksheet(1);
        sheet.Cell(1, 1).GetString().Should().Be("Sales summary");
        var revenueRow = sheet.RowsUsed().First(r => r.Cell(1).GetString() == "Revenue");
        revenueRow.Cell(2).GetValue<decimal>().Should().Be(210_000m);
        book.Worksheet(2).Name.Should().Be("By day");

        var top = await client.GetAsync($"/api/v1/reports/top-items/export?format=xlsx&{Period}");
        using var topBook = new XLWorkbook(new MemoryStream(await top.Content.ReadAsByteArrayAsync()));
        var cells = topBook.Worksheet(1).CellsUsed().Select(c => c.GetString()).ToList();
        cells.Should().Contain("=Чай").And.NotContain(c => c.StartsWith("'", StringComparison.Ordinal));
        topBook.Worksheet(1).CellsUsed().Should().NotContain(c => c.HasFormula);
    }

    [Fact]
    public async Task Pdf_export_is_print_ready_html_for_sales_summary_and_z_report_only()
    {
        var (org, menu) = await SeedAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var summary = await client.GetAsync($"/api/v1/reports/sales-summary/export?format=pdf&{Period}");
        summary.StatusCode.Should().Be(HttpStatusCode.OK);
        summary.Content.Headers.ContentType!.MediaType.Should().Be("text/html");
        summary.Headers.GetValues("Content-Security-Policy").Single().Should().StartWith("default-src 'none'");
        var html = Encoding.UTF8.GetString(await summary.Content.ReadAsByteArrayAsync());
        html.Should().Contain("<h1>Сводка продаж</h1>").And.NotContain("<script");
        html.Should().MatchRegex("210(&#160;|&#8239;| )000,00").And.Contain("<td>Продано позиций</td><td class=\"n\">7</td>");

        var z = await client.GetAsync($"/api/v1/reports/z-report/export?format=pdf&shiftId={menu.ShiftId}");
        z.StatusCode.Should().Be(HttpStatusCode.OK);
        Encoding.UTF8.GetString(await z.Content.ReadAsByteArrayAsync()).Should().Contain("Z-отчёт смены");

        var unsupported = await client.GetAsync($"/api/v1/reports/top-items/export?format=pdf&{Period}");
        unsupported.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadErrorCodeAsync(unsupported)).Should().Be("report.unsupported_format");
        (await client.GetAsync($"/api/v1/reports/z-report?shiftId={Guid.NewGuid()}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Export_requires_reports_export_while_viewing_needs_only_reports_read()
    {
        var org = await CreateOrgWithUserAsync();
        var manager = await AddUserAsync(org, SystemRoles.Manager);
        await WithDbAsync(async (db, _) =>
        {
            await db.RolePermissions
                .Where(p => p.RoleId == org.RoleIds[SystemRoles.Manager] && p.PermissionCode == Permissions.Reports.Export)
                .ExecuteDeleteAsync();
        });
        var client = ClientWithBranch(await LoginAsAsync(manager), org.BranchId);

        (await client.GetAsync("/api/v1/reports/sales-summary")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAsync("/api/v1/reports/abc")).StatusCode.Should().Be(HttpStatusCode.OK);
        foreach (var format in new[] { "csv", "xlsx", "pdf" })
        {
            (await client.GetAsync($"/api/v1/reports/sales-summary/export?format={format}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }

        var owner = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        (await owner.GetAsync("/api/v1/reports/sales-summary/export?format=csv")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Dashboard_overview_returns_period_kpis_with_deltas_sparkline_dishes_and_food_cost_alerts()
    {
        var org = await CreateOrgWithUserAsync();
        var now = DateTime.UtcNow;
        var today = BranchTime.LocalDate(now, BranchTime.Resolve("Asia/Tashkent"));
        await WithDbAsync(async (db, _) =>
        {
            var menu = await SalesTestData.SeedMenuAsync(db, org, now.AddDays(-2));
            await AnalyticsTestData.SeedRecipesAsync(db, org, menu);
            var data = new SalesTestData(org);
            data.PaidOrder(db, menu, today, now, PaymentMethod.Cash, (menu.Plov, 1m), (menu.Tea, 2m));
            data.PaidOrder(db, menu, today.AddDays(-1), now.AddDays(-1), PaymentMethod.Cash, (menu.Plov, 1m));
            await db.SaveChangesAsync();
        });
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var day = await ReadJsonAsync(await client.GetAsync("/api/v1/dashboard/overview?period=today"));
        day.GetProperty("current").GetProperty("revenue").GetDecimal().Should().Be(70_000m);
        day.GetProperty("previous").GetProperty("revenue").GetDecimal().Should().Be(50_000m);
        day.GetProperty("deltas").GetProperty("revenue").GetDecimal().Should().Be(40m);
        day.GetProperty("sparkline").GetArrayLength().Should().Be(24);
        day.GetProperty("sparkline").EnumerateArray().Sum(p => p.GetProperty("revenue").GetDecimal()).Should().Be(70_000m);
        day.GetProperty("topItems")[0].GetProperty("name").GetString().Should().Be("Плов");
        day.GetProperty("foodCostAlerts").GetProperty("items")[0].GetProperty("name").GetString().Should().Be("=Чай");

        var week = await ReadJsonAsync(await client.GetAsync("/api/v1/dashboard/overview?period=7d"));
        week.GetProperty("sparkline").GetArrayLength().Should().Be(7);
        week.GetProperty("current").GetProperty("revenue").GetDecimal().Should().Be(120_000m);
        (await client.GetAsync("/api/v1/dashboard/overview?period=1y")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private static IEnumerable<(string?, string?)> Classes(JsonElement report) =>
        report.GetProperty("items").EnumerateArray().Select(i => (i.GetProperty("name").GetString(), i.GetProperty("class").GetString()));

    /// <summary>Same sales as ReportsTests (A 100 000 @ 08:00Z, B 80 000 @ 18:59Z refunded 20 000, C 50 000 @ 19:00Z) + recipes.</summary>
    private async Task<(TestOrg Org, TestMenu Menu)> SeedAsync()
    {
        var org = await CreateOrgWithUserAsync();
        TestMenu? menu = null;
        await WithDbAsync(async (db, _) =>
        {
            menu = await SalesTestData.SeedMenuAsync(db, org, Utc(2026, 10, 10, 3));
            await AnalyticsTestData.SeedRecipesAsync(db, org, menu);
            var data = new SalesTestData(org);
            data.PaidOrder(db, menu, Day1, Utc(2026, 10, 10, 8), PaymentMethod.Cash, (menu.Plov, 2m));
            var (orderB, paymentB) = data.PaidOrder(db, menu, Day1, Utc(2026, 10, 10, 18, 59), PaymentMethod.Card, (menu.Tea, 3m), (menu.Plov, 1m));
            data.PaidOrder(db, menu, Day2, Utc(2026, 10, 10, 19), PaymentMethod.Cash, (menu.Plov, 1m));
            data.Refund(db, menu, orderB, paymentB, 20_000m, Utc(2026, 10, 11, 5));
            await db.SaveChangesAsync();
        });
        return (org, menu!);
    }

    private static DateTime Utc(int y, int m, int d, int h, int min = 0) => new(y, m, d, h, min, 0, DateTimeKind.Utc);
}
