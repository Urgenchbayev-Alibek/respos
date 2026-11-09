using System.Net;
using System.Net.Http.Json;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Inventory;

[Collection(ApiCollection.Name)]
public sealed class StockMovementTests(ApiFactory factory) : InventoryTestBase(factory)
{
    [Fact]
    public async Task Manual_movements_change_balance_together_with_movement_and_balance_after()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var rice = await SeedIngredientAsync(org, "Рис");
        var grams = await UnitIdAsync(org, "g");

        var receipt = await PostMovementAsync(client, rice, "receipt", 10m, unitCost: 28000m);
        receipt.StatusCode.Should().Be(HttpStatusCode.Created);
        (await ReadJsonAsync(receipt)).GetProperty("balanceAfter").GetDecimal().Should().Be(10m);

        var writeOff = await PostMovementAsync(client, rice, "write_off", 500m, grams);
        writeOff.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await ReadJsonAsync(writeOff);
        body.GetProperty("quantity").GetDecimal().Should().Be(-0.5m);
        body.GetProperty("balanceAfter").GetDecimal().Should().Be(9.5m);
        body.GetProperty("type").GetString().Should().Be("write_off");

        var adjustment = await PostMovementAsync(client, rice, "adjustment", -1.5m);
        adjustment.StatusCode.Should().Be(HttpStatusCode.Created);

        var movements = await MovementsAsync(rice);
        movements.Should().HaveCount(3);
        movements.Sum(m => m.Quantity).Should().Be(await BalanceAsync(org, rice));
        movements.Last().BalanceAfter.Should().Be(8m);
        movements.Should().OnlyContain(m => m.SourceType == StockMovementSource.Manual && m.CreatedBy == org.User.Id);

        var list = await ReadJsonAsync(await client.GetAsync($"/api/v1/stock/movements?ingredientId={rice}&type=write_off"));
        list.GetProperty("totalCount").GetInt32().Should().Be(1);

        var ingredients = await ReadJsonAsync(await client.GetAsync("/api/v1/ingredients?search=Рис"));
        var dto = ingredients.GetProperty("items")[0];
        dto.GetProperty("quantity").GetDecimal().Should().Be(8m);
        dto.GetProperty("costPrice").GetDecimal().Should().Be(28000m);
        dto.GetProperty("baseUnitCode").GetString().Should().Be("kg");
    }

    [Fact]
    public async Task Manual_write_off_cannot_go_negative_unless_branch_allows_it()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var oil = await SeedIngredientAsync(org, "Масло", "l");
        (await PostMovementAsync(client, oil, "receipt", 2m)).EnsureSuccessStatusCode();

        var blocked = await PostMovementAsync(client, oil, "write_off", 3m);
        blocked.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(blocked)).Should().Be("stock.insufficient");
        (await MovementsAsync(oil)).Should().HaveCount(1);
        (await BalanceAsync(org, oil)).Should().Be(2m);

        await SetAllowNegativeAsync(org, true);
        var allowed = await PostMovementAsync(client, oil, "write_off", 3m);
        allowed.StatusCode.Should().Be(HttpStatusCode.Created);
        (await BalanceAsync(org, oil)).Should().Be(-1m);
    }

    [Fact]
    public async Task Units_convert_directly_inversely_or_fail_with_conversion_missing()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var flour = await SeedIngredientAsync(org, "Мука");
        var kg = await UnitIdAsync(org, "kg");

        var unit = await client.PostAsJsonAsync("/api/v1/units", new { code = "bag", name = "Мешок", kind = "mass" }, Json);
        unit.StatusCode.Should().Be(HttpStatusCode.Created);
        var bag = (await ReadJsonAsync(unit)).GetProperty("id").GetGuid();

        // 1 kg = 0.04 bag (bag = 25 kg) → only the kg→bag row exists; bag→kg uses the inverse.
        var conversion = await client.PostAsJsonAsync("/api/v1/unit-conversions", new { fromUnitId = kg, toUnitId = bag, factor = 0.04m }, Json);
        conversion.StatusCode.Should().Be(HttpStatusCode.Created);

        var receipt = await PostMovementAsync(client, flour, "receipt", 2m, bag);
        receipt.StatusCode.Should().Be(HttpStatusCode.Created);
        (await ReadJsonAsync(receipt)).GetProperty("quantity").GetDecimal().Should().Be(50m);

        var litres = await UnitIdAsync(org, "l");
        var missing = await PostMovementAsync(client, flour, "receipt", 1m, litres);
        missing.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(missing)).Should().Be("unit.conversion_missing");

        var units = await ReadJsonAsync(await client.GetAsync("/api/v1/units"));
        units.EnumerateArray().Select(u => u.GetProperty("code").GetString()).Should().Contain(["kg", "bag"]);
    }

    [Fact]
    public async Task Waiter_cannot_post_movements_and_other_tenant_ingredients_are_invisible()
    {
        var orgA = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var orgB = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var secret = await SeedIngredientAsync(orgA, "Шафран A");
        var clientB = ClientWithBranch(await LoginAsAsync(orgB.User), orgB.BranchId);

        var foreign = await PostMovementAsync(clientB, secret, "receipt", 1m);
        foreign.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var listB = await ReadJsonAsync(await clientB.GetAsync("/api/v1/ingredients"));
        listB.GetProperty("totalCount").GetInt32().Should().Be(0);
        var setMin = await clientB.PutAsJsonAsync($"/api/v1/ingredients/{secret}/min-quantity", new { minQuantity = 1m }, Json);
        setMin.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var waiter = await AddUserAsync(orgA, SystemRoles.Waiter);
        var waiterClient = ClientWithBranch(await LoginAsAsync(waiter), orgA.BranchId);
        (await PostMovementAsync(waiterClient, secret, "receipt", 1m)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await MovementsAsync(secret)).Should().BeEmpty();
    }

    [Fact]
    public async Task Ingredient_crud_with_branch_min_quantity_and_low_stock_filter()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var kg = await UnitIdAsync(org, "kg");
        var category = await client.PostAsJsonAsync("/api/v1/ingredient-categories", new { name = "Овощи" }, Json);
        category.StatusCode.Should().Be(HttpStatusCode.Created);
        var categoryId = (await ReadJsonAsync(category)).GetProperty("id").GetGuid();

        var created = await client.PostAsJsonAsync("/api/v1/ingredients",
            new { name = "Морковь", sku = "CARROT", categoryId, baseUnitId = kg, costPrice = 6000m, minQuantity = 5m }, Json);
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await ReadJsonAsync(created);
        var id = dto.GetProperty("id").GetGuid();
        dto.GetProperty("categoryName").GetString().Should().Be("Овощи");
        dto.GetProperty("isLow").GetBoolean().Should().BeTrue();

        (await PostMovementAsync(client, id, "receipt", 10m)).EnsureSuccessStatusCode();
        var low = await ReadJsonAsync(await client.GetAsync("/api/v1/ingredients?lowStock=true"));
        low.GetProperty("totalCount").GetInt32().Should().Be(0);

        var min = await client.PutAsJsonAsync($"/api/v1/ingredients/{id}/min-quantity", new { minQuantity = 12m }, Json);
        (await ReadJsonAsync(min)).GetProperty("isLow").GetBoolean().Should().BeTrue();

        var grams = await UnitIdAsync(org, "g");
        var locked = await client.PutAsJsonAsync($"/api/v1/ingredients/{id}",
            new { name = "Морковь", sku = "CARROT", categoryId, baseUnitId = grams, costPrice = 6000m }, Json);
        (await ReadErrorCodeAsync(locked)).Should().Be("ingredient.base_unit_locked");

        (await client.PostAsync($"/api/v1/ingredients/{id}/archive", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await client.DeleteAsync($"/api/v1/ingredient-categories/{categoryId}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var active = await ReadJsonAsync(await client.GetAsync("/api/v1/ingredients"));
        active.GetProperty("totalCount").GetInt32().Should().Be(0);
    }
}
