using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Branches;
using Restaurant.IntegrationTests.Infrastructure;
using Restaurant.IntegrationTests.Orders;

namespace Restaurant.IntegrationTests.Delivery;

[Collection(ApiCollection.Name)]
public sealed class PublicMenuTests(ApiFactory factory) : PosTestBase(factory)
{
    [Fact]
    public async Task Public_menu_lists_only_available_items_of_that_branch_organization_with_etag()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        await SeedPosAsync(org);
        var other = await CreateOrgWithUserAsync(SystemRoles.Owner);
        await SeedPosAsync(other);
        var foreignName = $"Чужое-{Guid.NewGuid():N}";
        await WithDbAsync(async (db, _) =>
        {
            var hidden = new MenuCategory { OrganizationId = org.OrganizationId, Name = "Скрытая", IsActive = false };
            var foreignCategory = await db.MenuCategories.IgnoreQueryFilters().FirstAsync(c => c.OrganizationId == other.OrganizationId);
            db.AddRange(hidden,
                new MenuItem { OrganizationId = org.OrganizationId, CategoryId = hidden.Id, Name = "В скрытой", Price = 1m },
                new MenuItem { OrganizationId = other.OrganizationId, CategoryId = foreignCategory.Id, Name = foreignName, Price = 1m });
            await db.SaveChangesAsync();
        });
        var slug = await SlugAsync(org);
        var anonymous = CreateClient();

        var response = await anonymous.GetAsync($"/api/v1/public/menu/{slug.ToUpperInvariant()}");

        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        response.Headers.CacheControl!.Public.Should().BeTrue();
        var menu = await ReadJsonAsync(response);
        menu.GetProperty("branch").GetProperty("slug").GetString().Should().Be(slug);
        menu.GetProperty("currency").GetString().Should().Be("UZS");
        var names = menu.GetProperty("categories").EnumerateArray()
            .SelectMany(c => c.GetProperty("items").EnumerateArray()).Select(i => i.GetProperty("name").GetString()).ToList();
        names.Should().Contain(["Плов", "Чай", "Салат", "Лагман"]);
        names.Should().NotContain(["Архивное", "Стоп-лист", "В скрытой", foreignName]);
        var ids = menu.GetProperty("categories").EnumerateArray()
            .SelectMany(c => c.GetProperty("items").EnumerateArray()).Select(i => i.GetProperty("id").GetGuid()).ToList();
        await WithDbAsync(async (db, _) =>
            (await db.MenuItems.IgnoreQueryFilters().Where(i => ids.Contains(i.Id)).Select(i => i.OrganizationId).Distinct().ToListAsync())
            .Should().Equal(org.OrganizationId));
        var plov = menu.GetProperty("categories")[0].GetProperty("items").EnumerateArray().Single(i => i.GetProperty("name").GetString() == "Плов");
        plov.GetProperty("variants").GetArrayLength().Should().Be(1);

        var conditional = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/public/menu/{slug}");
        conditional.Headers.IfNoneMatch.Add(EntityTagHeaderValue.Parse(response.Headers.ETag!.Tag));
        (await anonymous.SendAsync(conditional)).StatusCode.Should().Be(HttpStatusCode.NotModified);

        var missing = await anonymous.GetAsync("/api/v1/public/menu/no-such-branch-slug");
        missing.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(missing)).Should().Be("public_menu.not_found");
    }

    [Fact]
    public async Task Public_menu_shows_the_branch_prices_and_stop_list_like_the_pos()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var branch2 = await BranchTestData.AddBranchAsync(Factory, org);
        var owner = await LoginAsAsync(org.User);
        async Task OverrideAsync(Guid itemId, object body) =>
            (await owner.PutAsJsonAsync($"/api/v1/menu/items/{itemId}/branches/{branch2}", body, Json))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        await OverrideAsync(seed.PlovId, new { priceOverride = 50000m, variantPrices = new[] { new { variantId = seed.PlovHalfVariantId, price = 27000m } } });
        await OverrideAsync(seed.TeaId, new { isAvailable = false, variantPrices = Array.Empty<object>() });
        await OverrideAsync(seed.UnavailableId, new { isAvailable = true, variantPrices = Array.Empty<object>() });

        var second = await PublicItemsAsync(branch2);
        var main = await PublicItemsAsync(org.BranchId);

        second["Плов"].GetProperty("price").GetDecimal().Should().Be(50000m, "the guest must see what the POS of this branch charges");
        second["Плов"].GetProperty("variants")[0].GetProperty("price").GetDecimal().Should().Be(27000m);
        second.Should().NotContainKey("Чай", "stop-listed in this branch");
        second.Should().ContainKey("Стоп-лист", "sold only in this branch");
        second.Should().NotContainKey("Архивное");
        main["Плов"].GetProperty("price").GetDecimal().Should().Be(PlovPrice);
        main["Плов"].GetProperty("variants")[0].GetProperty("price").GetDecimal().Should().Be(PlovHalfPrice);
        main.Should().ContainKey("Чай").And.NotContainKey("Стоп-лист");

        ClientWithBranch(owner, branch2);
        var pos = (await ReadJsonAsync(await owner.GetAsync("/api/v1/menu/pos"))).EnumerateArray()
            .SelectMany(c => c.GetProperty("items").EnumerateArray()).Single(i => i.GetProperty("id").GetGuid() == seed.PlovId);
        pos.GetProperty("price").GetDecimal().Should().Be(second["Плов"].GetProperty("price").GetDecimal());
    }

    [Fact]
    public async Task Call_waiter_notifies_branch_realtime_dedups_validates_table_and_is_rate_limited()
    {
        var recorder = new RecordingHubContext();
        await using var host = RecordingHubContext.CreateFactory(Factory, recorder);
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var seed = await SeedPosAsync(org);
        var slug = await SlugAsync(org);
        var anonymous = host.CreateClient();
        var url = $"/api/v1/public/menu/{slug}/call-waiter";

        var first = await anonymous.PostAsJsonAsync(url, new { tableNumber = "1", reason = "bill" }, Json);
        first.StatusCode.Should().Be(HttpStatusCode.Accepted, await first.Content.ReadAsStringAsync());
        var call = await ReadJsonAsync(first);
        call.GetProperty("status").GetString().Should().Be("active");
        recorder.Messages.Should().Contain(m => m.Target == $"branch:{org.BranchId}" && m.Method == "WaiterCalled");
        await WithDbAsync(async (db, _) =>
            (await db.Notifications.IgnoreQueryFilters().CountAsync(n => n.UserId == org.User.Id && n.Type == NotificationType.WaiterCalled))
            .Should().Be(1));

        var again = await ReadJsonAsync(await anonymous.PostAsJsonAsync(url, new { tableNumber = "1", reason = "bill" }, Json));
        Id(again).Should().Be(Id(call));
        var unknown = await anonymous.PostAsJsonAsync(url, new { tableNumber = "99", reason = "call" }, Json);
        unknown.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(unknown)).Should().Be("table.not_found");
        (await anonymous.PostAsJsonAsync(url, new { tableNumber = "1", reason = "call" }, Json)).StatusCode.Should().Be(HttpStatusCode.Accepted);
        var limited = await anonymous.PostAsJsonAsync(url, new { tableNumber = "1", reason = "call" }, Json);
        limited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await ReadErrorCodeAsync(limited)).Should().Be("rate_limit.exceeded");

        var waiter = ClientWithBranch(await LoginAsync(host, org.User), org.BranchId);
        var active = await ReadJsonAsync(await waiter.GetAsync("/api/v1/waiter-calls"));
        active.EnumerateArray().Select(c => c.GetProperty("tableId").GetGuid()).Should().Equal(seed.Table1Id, seed.Table1Id);
        var ack = await ReadJsonAsync(await waiter.PostAsync($"/api/v1/waiter-calls/{Id(call)}/acknowledge", null));
        ack.GetProperty("status").GetString().Should().Be("acknowledged");
        ack.GetProperty("acknowledgedByName").GetString().Should().Be("Test User");
        (await ReadJsonAsync(await waiter.GetAsync("/api/v1/waiter-calls"))).GetArrayLength().Should().Be(1);
        recorder.Messages.Should().Contain(m => m.Method == "WaiterCallUpdated");

        var stranger = await BranchClientAsync(await CreateOrgWithUserAsync(SystemRoles.Waiter));
        (await stranger.PostAsync($"/api/v1/waiter-calls/{Id(call)}/acknowledge", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private Task<string> SlugAsync(TestOrg org) => SlugAsync(org.BranchId);

    private async Task<string> SlugAsync(Guid branchId)
    {
        string? slug = null;
        await WithDbAsync(async (db, _) =>
            slug = await db.Branches.IgnoreQueryFilters().Where(b => b.Id == branchId).Select(b => b.Slug).SingleAsync());
        slug.Should().NotBeNullOrEmpty();
        return slug!;
    }

    private async Task<Dictionary<string, JsonElement>> PublicItemsAsync(Guid branchId)
    {
        var response = await CreateClient().GetAsync($"/api/v1/public/menu/{await SlugAsync(branchId)}");
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await ReadJsonAsync(response)).GetProperty("categories").EnumerateArray()
            .SelectMany(c => c.GetProperty("items").EnumerateArray())
            .ToDictionary(i => i.GetProperty("name").GetString()!);
    }

    private static async Task<HttpClient> LoginAsync(WebApplicationFactory<Program> host, TestUser user)
    {
        var client = host.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = user.Password }, Json);
        response.EnsureSuccessStatusCode();
        var token = (await ReadJsonAsync(response)).GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
