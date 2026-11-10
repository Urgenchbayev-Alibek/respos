using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.IntegrationTests.Infrastructure;
using Restaurant.IntegrationTests.Orders;

namespace Restaurant.IntegrationTests.Branches;

[Collection(ApiCollection.Name)]
public sealed class BranchMenuTests(ApiFactory factory) : PosTestBase(factory)
{
    [Fact]
    public async Task Branch_price_override_is_used_by_pos_menu_and_new_order_snapshot_and_station_override_routes_tickets()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var branch2 = await BranchTestData.AddBranchAsync(Factory, org);
        var b2Default = await BranchTestData.AddStationAsync(Factory, org, branch2, "Ф2 Холодный", 0);
        var b2Hot = await BranchTestData.AddStationAsync(Factory, org, branch2, "Ф2 Горячий", 1);
        var owner = await LoginAsAsync(org.User);

        var saved = await owner.PutAsJsonAsync($"/api/v1/menu/items/{seed.PlovId}/branches/{branch2}", new
        {
            priceOverride = 50000m,
            kitchenStationId = b2Hot,
            variantPrices = new[] { new { variantId = seed.PlovHalfVariantId, price = 27000m } },
        }, Json);
        saved.StatusCode.Should().Be(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync());
        var row = await ReadJsonAsync(saved);
        row.GetProperty("effectivePrice").GetDecimal().Should().Be(50000m);
        row.GetProperty("effectiveKitchenStationId").GetGuid().Should().Be(b2Hot);

        var matrix = await ReadJsonAsync(await owner.GetAsync($"/api/v1/menu/items/{seed.PlovId}/branches"));
        matrix.GetArrayLength().Should().Be(2);
        var main = matrix.EnumerateArray().Single(r => r.GetProperty("branchId").GetGuid() == org.BranchId);
        main.GetProperty("hasOverride").GetBoolean().Should().BeFalse();
        main.GetProperty("effectivePrice").GetDecimal().Should().Be(PlovPrice);

        ClientWithBranch(owner, branch2);
        var plovB2 = PosItem(await ReadJsonAsync(await owner.GetAsync("/api/v1/menu/pos")), seed.PlovId);
        plovB2.GetProperty("price").GetDecimal().Should().Be(50000m);
        plovB2.GetProperty("kitchenStationId").GetGuid().Should().Be(b2Hot);
        plovB2.GetProperty("variants")[0].GetProperty("price").GetDecimal().Should().Be(27000m);

        var order = await CreateOrderAsync(owner, null, Line(seed.PlovId), Line(seed.PlovId, 1m, seed.PlovHalfVariantId), Line(seed.TeaId));
        var prices = order.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("unitPrice").GetDecimal()).ToList();
        prices.Should().BeEquivalentTo([50000m, 27000m, TeaPrice]);
        (await SendToKitchenAsync(owner, Id(order))).StatusCode.Should().Be(HttpStatusCode.OK);
        var sent = await GetOrderAsync(owner, Id(order));
        var stations = sent.GetProperty("items").EnumerateArray()
            .ToDictionary(i => (i.GetProperty("name").GetString(), i.GetProperty("variantId").ValueKind == JsonValueKind.Null),
                i => i.GetProperty("stationId").GetGuid());
        stations[("Плов", true)].Should().Be(b2Hot);
        stations[("Чай", true)].Should().Be(b2Default, "the tea station belongs to the main branch → default station of branch 2");

        ClientWithBranch(owner, org.BranchId);
        var plovMain = PosItem(await ReadJsonAsync(await owner.GetAsync("/api/v1/menu/pos")), seed.PlovId);
        plovMain.GetProperty("price").GetDecimal().Should().Be(PlovPrice);
        var mainOrder = await CreateOrderAsync(owner, null, Line(seed.PlovId));
        mainOrder.GetProperty("items")[0].GetProperty("unitPrice").GetDecimal().Should().Be(PlovPrice);

        (await owner.DeleteAsync($"/api/v1/menu/items/{seed.PlovId}/branches/{branch2}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        ClientWithBranch(owner, branch2);
        PosItem(await ReadJsonAsync(await owner.GetAsync("/api/v1/menu/pos")), seed.PlovId)
            .GetProperty("price").GetDecimal().Should().Be(PlovPrice);
    }

    [Fact]
    public async Task Override_validation_rejects_foreign_station_variant_and_branch()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var branch2 = await BranchTestData.AddBranchAsync(Factory, org);
        var other = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var owner = await LoginAsAsync(org.User);

        var mainStation = await owner.PutAsJsonAsync($"/api/v1/menu/items/{seed.PlovId}/branches/{branch2}", new { kitchenStationId = seed.HotStationId }, Json);
        mainStation.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(mainStation)).Should().Be("kitchen_station.not_found");

        var variant = await owner.PutAsJsonAsync($"/api/v1/menu/items/{seed.TeaId}/branches/{branch2}",
            new { variantPrices = new[] { new { variantId = seed.PlovHalfVariantId, price = 1m } } }, Json);
        (await ReadErrorCodeAsync(variant)).Should().Be("menu_item.invalid_variant");

        var foreignBranch = await owner.PutAsJsonAsync($"/api/v1/menu/items/{seed.PlovId}/branches/{other.BranchId}", new { priceOverride = 1m }, Json);
        foreignBranch.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(foreignBranch)).Should().Be("branch.not_found");

        var negative = await owner.PutAsJsonAsync($"/api/v1/menu/items/{seed.PlovId}/branches/{branch2}", new { priceOverride = -1m }, Json);
        negative.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var otherOwner = await LoginAsAsync(other.User);
        (await otherOwner.GetAsync($"/api/v1/menu/items/{seed.PlovId}/branches")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await otherOwner.PutAsJsonAsync($"/api/v1/menu/items/{seed.PlovId}/branches/{other.BranchId}", new { priceOverride = 1m }, Json))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
        await WithDbAsync(async (db, _) =>
            (await db.BranchMenuItems.IgnoreQueryFilters().CountAsync(b => b.MenuItemId == seed.PlovId)).Should().Be(0));
    }

    [Fact]
    public async Task Branch_stop_list_toggle_hides_item_only_in_that_branch()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var branch2 = await BranchTestData.AddBranchAsync(Factory, org);
        var cook = await AddUserAsync(org, SystemRoles.Cook, org.BranchId, branch2);
        var waiter = await AddUserAsync(org, SystemRoles.Waiter, org.BranchId, branch2);
        var cookClient = ClientWithBranch(await LoginAsAsync(cook), branch2);
        var waiterClient = ClientWithBranch(await LoginAsAsync(waiter), branch2);

        (await waiterClient.PutAsJsonAsync($"/api/v1/menu/branch-availability/{seed.TeaId}", new { isAvailable = false }, Json))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var off = await cookClient.PutAsJsonAsync($"/api/v1/menu/branch-availability/{seed.TeaId}", new { isAvailable = false }, Json);
        off.StatusCode.Should().Be(HttpStatusCode.OK, await off.Content.ReadAsStringAsync());
        (await ReadJsonAsync(off)).GetProperty("effectiveIsAvailable").GetBoolean().Should().BeFalse();
        var on = await cookClient.PutAsJsonAsync($"/api/v1/menu/branch-availability/{seed.UnavailableId}", new { isAvailable = true }, Json);
        on.StatusCode.Should().Be(HttpStatusCode.OK);

        var posB2 = await ReadJsonAsync(await waiterClient.GetAsync("/api/v1/menu/pos"));
        PosIds(posB2).Should().NotContain(seed.TeaId).And.Contain(seed.UnavailableId);
        var rejected = await waiterClient.PostAsJsonAsync("/api/v1/orders", new { type = "takeaway", items = new[] { Line(seed.TeaId) } }, Json);
        rejected.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(rejected)).Should().Be("order.menu_item_unavailable");

        ClientWithBranch(waiterClient, org.BranchId);
        var posMain = await ReadJsonAsync(await waiterClient.GetAsync("/api/v1/menu/pos"));
        PosIds(posMain).Should().Contain(seed.TeaId).And.NotContain(seed.UnavailableId);
    }

    private static JsonElement PosItem(JsonElement pos, Guid menuItemId) =>
        pos.EnumerateArray().SelectMany(c => c.GetProperty("items").EnumerateArray()).Single(i => i.GetProperty("id").GetGuid() == menuItemId);

    private static List<Guid> PosIds(JsonElement pos) =>
        pos.EnumerateArray().SelectMany(c => c.GetProperty("items").EnumerateArray()).Select(i => i.GetProperty("id").GetGuid()).ToList();
}
