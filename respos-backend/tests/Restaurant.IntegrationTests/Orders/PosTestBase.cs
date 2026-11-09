using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Menu;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Orders;

/// <summary>Menu/floor/kitchen data created directly in the DB for one test org (Menu/Floor APIs are separate modules).</summary>
public sealed record PosSeed(
    Guid Table1Id,
    Guid Table2Id,
    Guid HotStationId,
    Guid BarStationId,
    Guid PlovId,
    Guid PlovHalfVariantId,
    Guid TeaId,
    Guid SaladId,
    Guid LagmanId,
    Guid SpicyOptionId,
    Guid MildOptionId,
    Guid ArchivedId,
    Guid UnavailableId);

/// <summary>Shared helpers for order / kitchen / payment API tests.</summary>
public abstract class PosTestBase(ApiFactory factory) : ApiTestBase(factory)
{
    protected const decimal PlovPrice = 45000m;
    protected const decimal PlovHalfPrice = 25000m;
    protected const decimal TeaPrice = 8000m;
    protected const decimal SaladPrice = 20000m;
    protected const decimal LagmanPrice = 30000m;
    protected const decimal SpicyDelta = 2000m;

    /// <summary>Two tables, stations Hot (default, sort 0) and Bar; Plov→Hot (with half variant), Tea→Bar, Salad→no station,
    /// Lagman with a required sauce group; one archived and one unavailable item. Optional service/tax percents.</summary>
    protected async Task<PosSeed> SeedPosAsync(TestOrg org, decimal servicePercent = 0m, decimal taxPercent = 0m)
    {
        PosSeed? seed = null;
        await WithDbAsync(async (db, _) =>
        {
            var (orgId, branchId) = (org.OrganizationId, org.BranchId);
            var area = new DiningArea { OrganizationId = orgId, BranchId = branchId, Name = "Зал" };
            var t1 = new DiningTable { OrganizationId = orgId, BranchId = branchId, DiningAreaId = area.Id, Number = "1", Capacity = 4 };
            var t2 = new DiningTable { OrganizationId = orgId, BranchId = branchId, DiningAreaId = area.Id, Number = "2", Capacity = 2 };
            var bar = new KitchenStation { OrganizationId = orgId, BranchId = branchId, Name = "Бар", SortOrder = 1 };
            var hot = new KitchenStation { OrganizationId = orgId, BranchId = branchId, Name = "Горячий цех", SortOrder = 0 };
            var category = new MenuCategory { OrganizationId = orgId, Name = "Основное" };
            MenuItem Item(string name, decimal price, Guid? station) =>
                new() { OrganizationId = orgId, CategoryId = category.Id, Name = name, Price = price, KitchenStationId = station };
            var plov = Item("Плов", PlovPrice, hot.Id);
            var half = new MenuItemVariant { MenuItemId = plov.Id, Name = "0.5 порции", Price = PlovHalfPrice };
            var tea = Item("Чай", TeaPrice, bar.Id);
            var salad = Item("Салат", SaladPrice, null);
            var lagman = Item("Лагман", LagmanPrice, hot.Id);
            var sauce = new ModifierGroup { OrganizationId = orgId, Name = "Соус", MinSelect = 1, MaxSelect = 1, IsRequired = true };
            var spicy = new ModifierOption { GroupId = sauce.Id, Name = "Острый", PriceDelta = SpicyDelta };
            var mild = new ModifierOption { GroupId = sauce.Id, Name = "Неострый", PriceDelta = 0m, SortOrder = 1 };
            var archived = Item("Архивное", 1000m, null);
            archived.Archive(DateTime.UtcNow);
            var unavailable = Item("Стоп-лист", 1000m, null);
            unavailable.IsAvailable = false;

            db.AddRange(area, t1, t2, bar, hot, category, plov, half, tea, salad, lagman, sauce, spicy, mild, archived, unavailable);
            db.MenuItemModifierGroups.Add(new MenuItemModifierGroup { MenuItemId = lagman.Id, ModifierGroupId = sauce.Id });
            var settings = await db.BranchSettings.IgnoreQueryFilters().FirstAsync(s => s.BranchId == branchId);
            settings.ServiceChargePercent = servicePercent;
            settings.TaxPercent = taxPercent;
            await db.SaveChangesAsync();
            seed = new PosSeed(t1.Id, t2.Id, hot.Id, bar.Id, plov.Id, half.Id, tea.Id, salad.Id, lagman.Id, spicy.Id, mild.Id,
                archived.Id, unavailable.Id);
        });
        return seed!;
    }

    protected async Task<HttpClient> BranchClientAsync(TestOrg org, TestUser? user = null) =>
        ClientWithBranch(await LoginAsAsync(user ?? org.User), org.BranchId);

    protected static object Line(Guid menuItemId, decimal quantity = 1m, Guid? variantId = null, params Guid[] options) =>
        new { menuItemId, variantId, quantity, modifierOptionIds = options };

    protected static async Task<JsonElement> CreateOrderAsync(HttpClient client, Guid? tableId, params object[] items)
    {
        var response = await client.PostAsJsonAsync("/api/v1/orders",
            new { type = tableId is null ? "takeaway" : "dine_in", tableId, guestCount = 2, items }, Json);
        response.StatusCode.Should().Be(System.Net.HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    protected static Task<HttpResponseMessage> PostWithKeyAsync(HttpClient client, string url, object? body, string? key = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body ?? new { }, options: Json) };
        request.Headers.Add("Idempotency-Key", key ?? Guid.NewGuid().ToString());
        return client.SendAsync(request);
    }

    protected static Task<HttpResponseMessage> SendToKitchenAsync(HttpClient client, Guid orderId, Guid[]? itemIds = null, string? key = null) =>
        PostWithKeyAsync(client, $"/api/v1/orders/{orderId}/send-to-kitchen", new { itemIds }, key);

    protected static Task<HttpResponseMessage> PayAsync(HttpClient client, Guid orderId, decimal amount, string method = "cash", string? key = null) =>
        PostWithKeyAsync(client, "/api/v1/payments", new { orderId, method, amount }, key);

    protected static async Task<JsonElement> OpenShiftAsync(HttpClient client, decimal openingAmount = 0m)
    {
        var response = await client.PostAsJsonAsync("/api/v1/cash-shifts/open", new { openingAmount }, Json);
        response.StatusCode.Should().Be(System.Net.HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    protected static async Task<JsonElement> GetOrderAsync(HttpClient client, Guid orderId)
    {
        var response = await client.GetAsync($"/api/v1/orders/{orderId}");
        response.EnsureSuccessStatusCode();
        return await ReadJsonAsync(response);
    }

    protected static Guid Id(JsonElement element) => element.GetProperty("id").GetGuid();

    protected static Guid ItemId(JsonElement order, string name) =>
        order.GetProperty("items").EnumerateArray().First(i => i.GetProperty("name").GetString() == name).GetProperty("id").GetGuid();
}
