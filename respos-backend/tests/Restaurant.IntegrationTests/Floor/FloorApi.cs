using System.Net.Http.Json;
using System.Text.Json;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Infrastructure.Persistence.Context;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Floor;

/// <summary>Small HTTP helpers for floor / reservation tests.</summary>
internal static class FloorApi
{
    public static async Task<Guid> CreateAreaAsync(HttpClient client, string name = "Зал")
    {
        var response = await client.PostAsJsonAsync("/api/v1/dining-areas", new { name }, ApiTestBase.Json);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(ApiTestBase.Json)).GetProperty("id").GetGuid();
    }

    public static Task<HttpResponseMessage> PostTableAsync(HttpClient client, Guid areaId, string number, int capacity = 4) =>
        client.PostAsJsonAsync("/api/v1/tables", new { number, capacity, areaId }, ApiTestBase.Json);

    public static async Task<Guid> CreateTableAsync(HttpClient client, Guid areaId, string number)
    {
        var response = await PostTableAsync(client, areaId, number);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(ApiTestBase.Json)).GetProperty("id").GetGuid();
    }

    public static async Task<JsonElement> GetTableAsync(HttpClient client, Guid tableId)
    {
        var tables = await client.GetFromJsonAsync<JsonElement>("/api/v1/tables", ApiTestBase.Json);
        return tables.EnumerateArray().Single(t => t.GetProperty("id").GetGuid() == tableId);
    }

    public static Task<HttpResponseMessage> PostReservationAsync(
        HttpClient client, Guid? tableId, DateTime startsAt, DateTime endsAt, string guestName = "Алишер") =>
        client.PostAsJsonAsync("/api/v1/reservations",
            new { tableId, guestName, guestPhone = "+998901112233", guestCount = 2, startsAt, endsAt, comment = "у окна" },
            ApiTestBase.Json);

    public static async Task<Guid> CreateReservationAsync(HttpClient client, Guid tableId, DateTime startsAt, DateTime endsAt)
    {
        var response = await PostReservationAsync(client, tableId, startsAt, endsAt);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(ApiTestBase.Json)).GetProperty("id").GetGuid();
    }

    /// <summary>Open dine-in order with one 50 000 line on the table (inserted directly).</summary>
    public static async Task<Order> AddOpenOrderAsync(AppDbContext db, TestOrg org, Guid tableId)
    {
        var now = DateTime.UtcNow;
        var order = Order.Create(org.OrganizationId, org.BranchId, OrderType.DineIn, tableId, org.User.Id, 2,
            Random.Shared.Next(1, 100_000), DateOnly.FromDateTime(now), null, now);
        var menuItemId = await MenuSeed.AddMenuItemAsync(db, org.OrganizationId);
        order.AddItem(OrderItem.Create(menuItemId, "Плов", 50_000m, 1m), new OrderPricingSettings(0m, 0m), null, now);
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return order;
    }
}

internal static class MenuSeed
{
    /// <summary>Category + item inserted directly for the org (no tenant context needed).</summary>
    public static async Task<Guid> AddMenuItemAsync(AppDbContext db, Guid organizationId, string name = "Плов")
    {
        var category = new Domain.Entities.Menu.MenuCategory { OrganizationId = organizationId, Name = "Seed " + Guid.NewGuid().ToString("N")[..6] };
        var item = new Domain.Entities.Menu.MenuItem { OrganizationId = organizationId, CategoryId = category.Id, Name = name, Price = 50_000m };
        db.MenuCategories.Add(category);
        db.MenuItems.Add(item);
        await db.SaveChangesAsync();
        return item.Id;
    }
}
