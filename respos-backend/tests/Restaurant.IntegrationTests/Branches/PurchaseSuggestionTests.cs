using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;
using Restaurant.IntegrationTests.Inventory;

namespace Restaurant.IntegrationTests.Branches;

[Collection(ApiCollection.Name)]
public sealed class PurchaseSuggestionTests(ApiFactory factory) : InventoryTestBase(factory)
{
    [Fact]
    public async Task Suggestions_use_min_projected_consumption_and_open_orders_grouped_by_default_supplier()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var (kg, g) = (await UnitIdAsync(org, "kg"), await UnitIdAsync(org, "g"));
        var agro = await CreateSupplierAsync(client, "Агро");
        var meat = await CreateSupplierAsync(client, "Мясо");
        var rice = await SeedIngredientAsync(org, "Рис", costPrice: 30000m);
        var lamb = await SeedIngredientAsync(org, "Баранина", costPrice: 100000m);
        var onion = await SeedIngredientAsync(org, "Лук", costPrice: 4000m);
        var tea = await SeedIngredientAsync(org, "Чай", costPrice: 100m);

        var update = await client.PutAsJsonAsync($"/api/v1/ingredients/{rice}", new
        {
            name = "Рис", baseUnitId = kg, costPrice = 30000m, defaultSupplierId = agro,
        }, Json);
        update.StatusCode.Should().Be(HttpStatusCode.OK, await update.Content.ReadAsStringAsync());
        (await ReadJsonAsync(update)).GetProperty("defaultSupplierName").GetString().Should().Be("Агро");
        await StockAsync(org, rice, 4m, 10m, null);
        await StockAsync(org, lamb, 10m, 5m, meat);
        await StockAsync(org, onion, 1m, 3m, null);
        await StockAsync(org, tea, 1000m, 100m, agro);
        await ConsumeAsync(org, lamb, 14m, daysAgo: 3);
        await ConsumeAsync(org, lamb, 100m, daysAgo: 20); // outside the 14-day window
        var draft = await client.PostAsJsonAsync("/api/v1/purchases", new
        {
            supplierId = agro, items = new[] { new { ingredientId = rice, quantity = 2000m, unitId = g, unitPrice = 30m } },
        }, Json);
        draft.StatusCode.Should().Be(HttpStatusCode.Created);

        var suggestions = await ReadJsonAsync(await client.GetAsync("/api/v1/purchases/suggestions?coverageDays=7"));
        var groups = suggestions.GetProperty("groups").EnumerateArray().ToList();
        groups.Select(SupplierOf).Should().Equal(agro, meat, null);
        var riceLine = Line(groups[0], rice);
        riceLine.GetProperty("onOrderQuantity").GetDecimal().Should().Be(2m);
        riceLine.GetProperty("suggestedQuantity").GetDecimal().Should().Be(4m);
        riceLine.GetProperty("estimatedTotal").GetDecimal().Should().Be(120000m);
        var lambLine = Line(groups[1], lamb);
        lambLine.GetProperty("avgDailyConsumption").GetDecimal().Should().Be(1m);
        lambLine.GetProperty("targetQuantity").GetDecimal().Should().Be(12m);
        lambLine.GetProperty("suggestedQuantity").GetDecimal().Should().Be(2m);
        lambLine.GetProperty("lastPrice").GetDecimal().Should().Be(100000m);
        Line(groups[2], onion).GetProperty("suggestedQuantity").GetDecimal().Should().Be(2m);
        groups.SelectMany(gr => gr.GetProperty("lines").EnumerateArray()).Should().NotContain(l => l.GetProperty("ingredientId").GetGuid() == tea);

        var belowMinOnly = await ReadJsonAsync(await client.GetAsync("/api/v1/purchases/suggestions"));
        belowMinOnly.GetProperty("groups").EnumerateArray().Select(SupplierOf).Should().NotContain(meat, "lamb is above its minimum");
        (await client.GetAsync("/api/v1/purchases/suggestions?coverageDays=-1")).StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var applied = await client.PostAsJsonAsync("/api/v1/purchases/suggestions/apply", new
        {
            comment = "по предложению",
            lines = new object[]
            {
                new { ingredientId = rice, supplierId = agro, quantity = 4m },
                new { ingredientId = lamb, supplierId = meat, quantity = 2m, unitPrice = 95000m },
            },
        }, Json);
        applied.StatusCode.Should().Be(HttpStatusCode.Created, await applied.Content.ReadAsStringAsync());
        var created = (await ReadJsonAsync(applied)).EnumerateArray().ToList();
        created.Should().HaveCount(2);
        created.Should().OnlyContain(p => p.GetProperty("status").GetString() == "draft");
        created.Single(p => p.GetProperty("supplierId").GetGuid() == meat).GetProperty("total").GetDecimal().Should().Be(190000m);
        var riceItem = created.Single(p => p.GetProperty("supplierId").GetGuid() == agro).GetProperty("items")[0];
        riceItem.GetProperty("unitId").GetGuid().Should().Be(kg);
        riceItem.GetProperty("unitPrice").GetDecimal().Should().Be(30000m);

        var after = await ReadJsonAsync(await client.GetAsync("/api/v1/purchases/suggestions?coverageDays=7"));
        after.GetProperty("groups").EnumerateArray().SelectMany(gr => gr.GetProperty("lines").EnumerateArray())
            .Select(l => l.GetProperty("ingredientId").GetGuid()).Should().Equal(onion);
    }

    [Fact]
    public async Task Apply_is_all_or_nothing_and_tenant_scoped()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var good = await CreateSupplierAsync(client, "Хороший");
        var archived = await CreateSupplierAsync(client, "Архивный");
        (await client.PostAsync($"/api/v1/suppliers/{archived}/archive", null)).IsSuccessStatusCode.Should().BeTrue();
        var rice = await SeedIngredientAsync(org, "Рис", costPrice: 1000m);
        await StockAsync(org, rice, 0m, 5m, good);

        var refused = await client.PostAsJsonAsync("/api/v1/purchases/suggestions/apply", new
        {
            lines = new object[]
            {
                new { ingredientId = rice, supplierId = good, quantity = 5m },
                new { ingredientId = rice, supplierId = archived, quantity = 1m },
            },
        }, Json);
        refused.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(refused)).Should().Be("supplier.archived");
        await WithDbAsync(async (db, _) =>
            (await db.PurchaseOrders.IgnoreQueryFilters().CountAsync(p => p.OrganizationId == org.OrganizationId)).Should().Be(0));

        var other = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var stranger = ClientWithBranch(await LoginAsAsync(other.User), other.BranchId);
        (await ReadJsonAsync(await stranger.GetAsync("/api/v1/purchases/suggestions"))).GetProperty("groups").GetArrayLength().Should().Be(0);
        var foreign = await stranger.PostAsJsonAsync("/api/v1/purchases/suggestions/apply",
            new { lines = new[] { new { ingredientId = rice, supplierId = good, quantity = 1m } } }, Json);
        foreign.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private static Guid? SupplierOf(JsonElement group) =>
        group.GetProperty("supplierId").ValueKind == JsonValueKind.Null ? null : group.GetProperty("supplierId").GetGuid();

    private static JsonElement Line(JsonElement group, Guid ingredientId) =>
        group.GetProperty("lines").EnumerateArray().Single(l => l.GetProperty("ingredientId").GetGuid() == ingredientId);

    private static async Task<Guid> CreateSupplierAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/v1/suppliers", new { name }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await ReadJsonAsync(response)).GetProperty("id").GetGuid();
    }

    /// <summary>Balance + minimum in the main branch (written directly) and optionally the default supplier.</summary>
    private async Task StockAsync(TestOrg org, Guid ingredientId, decimal quantity, decimal min, Guid? supplierId)
    {
        await WithDbAsync(async (db, _) =>
        {
            var balance = StockBalance.Create(org.OrganizationId, org.BranchId, ingredientId, min);
            var movement = new StockMovement
            {
                OrganizationId = org.OrganizationId, BranchId = org.BranchId, IngredientId = ingredientId, Type = StockMovementType.Receipt,
                Quantity = quantity, SourceType = StockMovementSource.Manual, CreatedAt = DateTime.UtcNow,
            };
            balance.Apply(movement, allowNegative: false);
            db.StockBalances.Add(balance);
            db.StockMovements.Add(movement);
            if (supplierId is not null)
            {
                var ingredient = await db.Ingredients.IgnoreQueryFilters().FirstAsync(i => i.Id == ingredientId);
                ingredient.DefaultSupplierId = supplierId;
            }

            await db.SaveChangesAsync();
        });
    }

    private async Task ConsumeAsync(TestOrg org, Guid ingredientId, decimal quantity, int daysAgo)
    {
        await WithDbAsync(async (db, _) =>
        {
            db.StockMovements.Add(new StockMovement
            {
                OrganizationId = org.OrganizationId, BranchId = org.BranchId, IngredientId = ingredientId, Type = StockMovementType.Consumption,
                Quantity = -quantity, SourceType = StockMovementSource.Order, CreatedAt = Factory.Clock.UtcNow.AddDays(-daysAgo),
            });
            await db.SaveChangesAsync();
        });
    }
}
