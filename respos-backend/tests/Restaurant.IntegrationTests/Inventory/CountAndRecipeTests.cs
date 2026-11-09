using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Inventory;

[Collection(ApiCollection.Name)]
public sealed class CountAndRecipeTests(ApiFactory factory) : InventoryTestBase(factory)
{
    [Fact]
    public async Task Completing_inventory_count_creates_difference_movements_and_locks_the_count()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var rice = await SeedIngredientAsync(org, "Рис");
        var onion = await SeedIngredientAsync(org, "Лук");
        (await PostMovementAsync(client, rice, "receipt", 10m)).EnsureSuccessStatusCode();
        (await PostMovementAsync(client, onion, "receipt", 4m)).EnsureSuccessStatusCode();

        var created = await client.PostAsJsonAsync("/api/v1/stock/counts", new { comment = "Месячная" }, Json);
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var count = await ReadJsonAsync(created);
        var id = count.GetProperty("id").GetGuid();
        count.GetProperty("lines").EnumerateArray()
            .Single(l => l.GetProperty("ingredientId").GetGuid() == rice).GetProperty("expectedQty").GetDecimal().Should().Be(10m);

        var update = await client.PutAsJsonAsync($"/api/v1/stock/counts/{id}", new
        {
            lines = new[] { new { ingredientId = rice, countedQty = (decimal?)8m }, new { ingredientId = onion, countedQty = (decimal?)4m } },
        }, Json);
        update.StatusCode.Should().Be(HttpStatusCode.OK);

        var completed = await client.PostAsync($"/api/v1/stock/counts/{id}/complete", null);
        completed.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(completed)).GetProperty("status").GetString().Should().Be("completed");

        (await BalanceAsync(org, rice)).Should().Be(8m);
        var riceMovements = await MovementsAsync(rice);
        riceMovements.Should().ContainSingle(m => m.Type == StockMovementType.InventoryCount && m.Quantity == -2m && m.SourceId == id);
        (await MovementsAsync(onion)).Should().NotContain(m => m.Type == StockMovementType.InventoryCount);

        var again = await client.PutAsJsonAsync($"/api/v1/stock/counts/{id}", new { lines = new[] { new { ingredientId = rice, countedQty = 1m } } }, Json);
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(again)).Should().Be("inventory_count.completed");
        (await client.PostAsync($"/api/v1/stock/counts/{id}/complete", null)).StatusCode.Should().Be(HttpStatusCode.Conflict);

        await WithDbAsync(async (db, _) =>
            (await db.AuditLogs.AnyAsync(a => a.Action == "inventory_count.completed" && a.EntityId == id.ToString())).Should().BeTrue());
    }

    [Fact]
    public async Task Saving_a_recipe_creates_a_new_version_and_keeps_history()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var client = await LoginAsAsync(org.User);
        var rice = await SeedIngredientAsync(org, "Рис", costPrice: 20000m);
        var oil = await SeedIngredientAsync(org, "Масло", "l", costPrice: 25000m);
        var grams = await UnitIdAsync(org, "g");
        var ml = await UnitIdAsync(org, "ml");
        var (menuItemId, _) = await SeedMenuItemAsync(org);

        var v1 = await client.PostAsJsonAsync("/api/v1/recipes", new
        {
            menuItemId,
            ingredients = new[] { new { ingredientId = rice, quantity = 200m, unitId = grams } },
        }, Json);
        v1.StatusCode.Should().Be(HttpStatusCode.Created);
        var v1Body = await ReadJsonAsync(v1);
        v1Body.GetProperty("version").GetInt32().Should().Be(1);
        v1Body.GetProperty("estimatedCost").GetDecimal().Should().Be(4000m);

        var v2 = await client.PostAsJsonAsync("/api/v1/recipes", new
        {
            menuItemId,
            ingredients = new[] { new { ingredientId = rice, quantity = 250m, unitId = grams }, new { ingredientId = oil, quantity = 40m, unitId = ml } },
        }, Json);
        v2.StatusCode.Should().Be(HttpStatusCode.Created);
        var v2Body = await ReadJsonAsync(v2);
        v2Body.GetProperty("version").GetInt32().Should().Be(2);
        v2Body.GetProperty("isActive").GetBoolean().Should().BeTrue();
        v2Body.GetProperty("estimatedCost").GetDecimal().Should().Be(6000m);

        var active = await ReadJsonAsync(await client.GetAsync($"/api/v1/recipes?menuItemId={menuItemId}"));
        active.GetArrayLength().Should().Be(1);
        active[0].GetProperty("version").GetInt32().Should().Be(2);

        var history = await ReadJsonAsync(await client.GetAsync($"/api/v1/recipes/history?menuItemId={menuItemId}"));
        history.EnumerateArray().Select(r => (r.GetProperty("version").GetInt32(), r.GetProperty("isActive").GetBoolean()))
            .Should().Equal((2, true), (1, false));
        var old = await ReadJsonAsync(await client.GetAsync($"/api/v1/recipes/{v1Body.GetProperty("id").GetGuid()}"));
        old.GetProperty("ingredients").GetArrayLength().Should().Be(1);

        var litre = await UnitIdAsync(org, "pcs");
        var bad = await client.PostAsJsonAsync("/api/v1/recipes", new
        {
            menuItemId,
            ingredients = new[] { new { ingredientId = rice, quantity = 1m, unitId = litre } },
        }, Json);
        (await ReadErrorCodeAsync(bad)).Should().Be("unit.conversion_missing");
    }

    [Fact]
    public async Task Recipes_of_another_organization_are_not_visible()
    {
        var orgA = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var orgB = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var rice = await SeedIngredientAsync(orgA, "Рис");
        var (menuItemId, _) = await SeedMenuItemAsync(orgA);
        await SeedRecipeAsync(orgA, menuItemId, null, (rice, 0.2m, await UnitIdAsync(orgA, "kg")));

        var clientB = await LoginAsAsync(orgB.User);
        var list = await ReadJsonAsync(await clientB.GetAsync($"/api/v1/recipes?menuItemId={menuItemId}"));
        list.GetArrayLength().Should().Be(0);
        var save = await clientB.PostAsJsonAsync("/api/v1/recipes", new
        {
            menuItemId,
            ingredients = new[] { new { ingredientId = rice, quantity = 1m, unitId = await UnitIdAsync(orgB, "kg") } },
        }, Json);
        save.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
