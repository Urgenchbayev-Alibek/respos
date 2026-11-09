using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Reports;

[Collection(ApiCollection.Name)]
public sealed class DashboardTests(ApiFactory factory) : ApiTestBase(factory)
{
    [Fact]
    public async Task Dashboard_shows_today_in_branch_timezone_with_tables_stock_shift_and_demo_flag()
    {
        var org = await CreateOrgWithUserAsync();
        var now = DateTime.UtcNow;
        var today = BranchTime.LocalDate(now, BranchTime.Resolve("Asia/Tashkent"));
        await WithDbAsync(async (db, _) =>
        {
            var menu = await SalesTestData.SeedMenuAsync(db, org, now.AddHours(-1));
            var data = new SalesTestData(org);
            data.PaidOrder(db, menu, today, now, PaymentMethod.Cash, (menu.Plov, 1m), (menu.Tea, 1m));
            data.PaidOrder(db, menu, today, now, PaymentMethod.Card, (menu.Tea, 2m));
            data.PaidOrder(db, menu, today.AddDays(-1), now.AddDays(-1), PaymentMethod.Cash, (menu.Plov, 10m));
            data.OpenOrder(db, today, now, (menu.Plov, 1m));

            var area = new DiningArea { OrganizationId = org.OrganizationId, BranchId = org.BranchId, Name = "Зал" };
            db.AddRange(area,
                new DiningTable { OrganizationId = org.OrganizationId, BranchId = org.BranchId, DiningAreaId = area.Id, Number = "1", Capacity = 4, Status = TableStatus.Occupied },
                new DiningTable { OrganizationId = org.OrganizationId, BranchId = org.BranchId, DiningAreaId = area.Id, Number = "2", Capacity = 2 });

            var kg = await db.Units.IgnoreQueryFilters().FirstAsync(u => u.OrganizationId == org.OrganizationId && u.Code == "kg");
            var rice = new Ingredient { OrganizationId = org.OrganizationId, Name = "Рис", BaseUnitId = kg.Id };
            db.AddRange(rice, StockBalance.Create(org.OrganizationId, org.BranchId, rice.Id, minQuantity: 5m));
            await db.SaveChangesAsync();
        });
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var json = await ReadJsonAsync(await client.GetAsync("/api/v1/dashboard"));

        json.GetProperty("salesToday").GetDecimal().Should().Be(80_000m);
        json.GetProperty("ordersToday").GetInt32().Should().Be(2);
        json.GetProperty("averageCheck").GetDecimal().Should().Be(40_000m);
        json.GetProperty("activeOrders").GetInt32().Should().Be(1);
        json.GetProperty("tablesOccupied").GetInt32().Should().Be(1);
        json.GetProperty("tablesTotal").GetInt32().Should().Be(2);
        json.GetProperty("lowStockCount").GetInt32().Should().Be(1);
        json.GetProperty("topItems")[0].GetProperty("name").GetString().Should().Be("=Чай");
        json.GetProperty("currentShift").GetProperty("openedByName").GetString().Should().Be("Test User");
        json.GetProperty("isDemoData").GetBoolean().Should().BeFalse();

        await WithDbAsync(async (db, _) =>
        {
            await db.Organizations.Where(o => o.Id == org.OrganizationId).ExecuteUpdateAsync(s => s.SetProperty(o => o.IsDemo, true));
        });
        (await ReadJsonAsync(await client.GetAsync("/api/v1/dashboard"))).GetProperty("isDemoData").GetBoolean().Should().BeTrue();
    }
}
