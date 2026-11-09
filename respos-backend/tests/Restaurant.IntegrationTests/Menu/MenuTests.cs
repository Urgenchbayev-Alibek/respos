using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Menu;

[Collection(ApiCollection.Name)]
public sealed class MenuTests(ApiFactory factory) : ApiTestBase(factory)
{
    private async Task<(TestOrg Org, HttpClient Client)> OwnerAsync()
    {
        var org = await CreateOrgWithUserAsync();
        return (org, ClientWithBranch(await LoginAsAsync(org.User), org.BranchId));
    }

    private static async Task<Guid> CreateCategoryAsync(HttpClient client, string name = "Горячее")
    {
        var response = await client.PostAsJsonAsync("/api/v1/menu/categories", new { name }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> CreateItemAsync(HttpClient client, Guid categoryId, string name, object? extra = null)
    {
        var body = new Dictionary<string, object?> { ["categoryId"] = categoryId, ["name"] = name, ["price"] = 45000.50m, ["prepTimeMinutes"] = 15 };
        foreach (var property in extra?.GetType().GetProperties() ?? [])
        {
            body[property.Name] = property.GetValue(extra);
        }

        var response = await client.PostAsJsonAsync("/api/v1/menu/items", body, Json);
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<JsonElement>(Json);
    }

    private static async Task<Guid> CreateGroupAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/v1/menu/modifier-groups", new
        {
            name = "Соусы", minSelect = 0, maxSelect = 2, isRequired = false,
            options = new[] { new { id = (Guid?)null, name = "Чесночный", priceDelta = 3000m }, new { id = (Guid?)null, name = "Острый", priceDelta = 2000m } },
        }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task Item_with_variants_and_modifiers_round_trips()
    {
        var (_, client) = await OwnerAsync();
        var categoryId = await CreateCategoryAsync(client);
        var groupId = await CreateGroupAsync(client);
        var item = await CreateItemAsync(client, categoryId, "Плов", new
        {
            nameUz = "Osh",
            variants = new[] { new { id = (Guid?)null, name = "0.5", price = 25000m, isDefault = false }, new { id = (Guid?)null, name = "1", price = 45000m, isDefault = true } },
            modifierGroupIds = new[] { groupId },
        });

        item.GetProperty("categoryName").GetString().Should().Be("Горячее");
        item.GetProperty("price").GetDecimal().Should().Be(45000.50m);
        item.GetProperty("variants").GetArrayLength().Should().Be(2);
        var group = item.GetProperty("modifierGroups").EnumerateArray().Single();
        group.GetProperty("maxSelect").GetInt32().Should().Be(2);
        group.GetProperty("options").GetArrayLength().Should().Be(2);

        var id = item.GetProperty("id").GetGuid();
        var fetched = await client.GetFromJsonAsync<JsonElement>($"/api/v1/menu/items/{id}", Json);
        fetched.GetProperty("nameUz").GetString().Should().Be("Osh");

        var list = await client.GetFromJsonAsync<JsonElement>($"/api/v1/menu/items?categoryId={categoryId}&search=пло", Json);
        list.GetProperty("totalCount").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task Modifier_group_min_max_is_validated()
    {
        var (_, client) = await OwnerAsync();
        var options = new[] { new { id = (Guid?)null, name = "A", priceDelta = 0m } };

        var minOverMax = await client.PostAsJsonAsync("/api/v1/menu/modifier-groups",
            new { name = "G", minSelect = 2, maxSelect = 1, isRequired = false, options }, Json);
        var requiredNoMin = await client.PostAsJsonAsync("/api/v1/menu/modifier-groups",
            new { name = "G", minSelect = 0, maxSelect = 1, isRequired = true, options }, Json);

        minOverMax.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        requiredNoMin.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadErrorCodeAsync(requiredNoMin)).Should().Be("validation.failed");
    }

    [Fact]
    public async Task Categories_reorder_and_archive_rules()
    {
        var (_, client) = await OwnerAsync();
        var a = await CreateCategoryAsync(client, "A");
        var b = await CreateCategoryAsync(client, "B");
        var c = await CreateCategoryAsync(client, "C");

        var reorder = await client.PutAsJsonAsync("/api/v1/menu/categories/reorder", new { ids = new[] { c, a, b } }, Json);
        reorder.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(reorder)).EnumerateArray().Select(x => x.GetProperty("id").GetGuid()).Should().Equal(c, a, b);

        var item = await CreateItemAsync(client, a, "Суп");
        var refused = await client.DeleteAsync($"/api/v1/menu/categories/{a}");
        refused.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(refused)).Should().Be("menu_category.has_items");

        await client.PostAsync($"/api/v1/menu/items/{item.GetProperty("id").GetGuid()}/archive", null);
        (await client.DeleteAsync($"/api/v1/menu/categories/{a}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var list = await client.GetFromJsonAsync<JsonElement>("/api/v1/menu/categories", Json);
        list.EnumerateArray().Select(x => x.GetProperty("id").GetGuid()).Should().Equal(c, b);
    }

    [Fact]
    public async Task Archive_keeps_history_and_used_variant_is_archived_not_deleted()
    {
        var (org, client) = await OwnerAsync();
        var categoryId = await CreateCategoryAsync(client);
        var item = await CreateItemAsync(client, categoryId, "Лагман", new
        {
            variants = new[] { new { id = (Guid?)null, name = "Большой", price = 40000m, isDefault = true } },
        });
        var itemId = item.GetProperty("id").GetGuid();
        var variantId = item.GetProperty("variants")[0].GetProperty("id").GetGuid();
        await WithDbAsync(async (db, _) =>
        {
            var now = DateTime.UtcNow;
            var order = Order.Create(org.OrganizationId, org.BranchId, OrderType.Takeaway, null, org.User.Id, 1, 1, DateOnly.FromDateTime(now), null, now);
            order.AddItem(OrderItem.Create(itemId, "Лагман", 40000m, 1m, variantId, "Большой"), new OrderPricingSettings(0, 0), null, now);
            db.Orders.Add(order);
            await db.SaveChangesAsync();
        });

        var update = await client.PutAsJsonAsync($"/api/v1/menu/items/{itemId}", new
        {
            categoryId, name = "Лагман", price = 42000m, prepTimeMinutes = 10, variants = Array.Empty<object>(),
        }, Json);
        update.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(update)).GetProperty("variants").GetArrayLength().Should().Be(0);
        await WithDbAsync(async (db, _) =>
            (await db.MenuItemVariants.SingleAsync(v => v.Id == variantId)).IsArchived.Should().BeTrue());

        (await client.PostAsync($"/api/v1/menu/items/{itemId}/archive", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var active = await client.GetFromJsonAsync<JsonElement>($"/api/v1/menu/items?categoryId={categoryId}", Json);
        active.GetProperty("totalCount").GetInt32().Should().Be(0);
        var withArchived = await client.GetFromJsonAsync<JsonElement>($"/api/v1/menu/items?categoryId={categoryId}&includeArchived=true", Json);
        withArchived.GetProperty("items")[0].GetProperty("isArchived").GetBoolean().Should().BeTrue();
        (await client.GetAsync($"/api/v1/menu/items/{itemId}")).StatusCode.Should().Be(HttpStatusCode.OK);
        await WithDbAsync(async (db, _) => (await db.OrderItems.CountAsync(i => i.MenuItemId == itemId)).Should().Be(1));
    }

    [Fact]
    public async Task Pos_menu_excludes_archived_unavailable_and_out_of_time_items()
    {
        var (_, client) = await OwnerAsync();
        var categoryId = await CreateCategoryAsync(client);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Tashkent"));
        var now = TimeOnly.FromDateTime(localNow);
        string T(TimeOnly t) => t.ToString("HH:mm:ss");

        await CreateItemAsync(client, categoryId, "Всегда");
        await CreateItemAsync(client, categoryId, "Сейчас", new
        {
            availability = new[] { new { dayOfWeek = (string?)null, startTime = T(now.AddHours(-1)), endTime = T(now.AddHours(1)) } },
        });
        await CreateItemAsync(client, categoryId, "Позже", new
        {
            availability = new[] { new { dayOfWeek = (string?)null, startTime = T(now.AddHours(2)), endTime = T(now.AddHours(3)) } },
        });
        var stopped = await CreateItemAsync(client, categoryId, "Стоп");
        await client.PostAsJsonAsync($"/api/v1/menu/items/{stopped.GetProperty("id").GetGuid()}/availability", new { isAvailable = false }, Json);
        var archived = await CreateItemAsync(client, categoryId, "Архив");
        await client.PostAsync($"/api/v1/menu/items/{archived.GetProperty("id").GetGuid()}/archive", null);
        await CreateCategoryAsync(client, "Пустая");

        var pos = await client.GetFromJsonAsync<JsonElement>("/api/v1/menu/pos", Json);

        var category = pos.EnumerateArray().Single();
        category.GetProperty("id").GetGuid().Should().Be(categoryId);
        category.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("name").GetString())
            .Should().BeEquivalentTo("Всегда", "Сейчас");
    }

    [Fact]
    public async Task Photo_upload_validates_type_and_size()
    {
        var (_, client) = await OwnerAsync();
        var item = await CreateItemAsync(client, await CreateCategoryAsync(client), "Фото");
        var url = $"/api/v1/menu/items/{item.GetProperty("id").GetGuid()}/photo";
        byte[] png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];

        var ok = await client.PostAsync(url, Multipart(png, "dish.png", "image/png"));
        ok.StatusCode.Should().Be(HttpStatusCode.OK);
        var photoUrl = (await ReadJsonAsync(ok)).GetProperty("photoUrl").GetString();
        photoUrl.Should().StartWith("/files/").And.EndWith(".png");
        (await CreateClient().GetAsync(photoUrl)).StatusCode.Should().Be(HttpStatusCode.OK);

        var fake = await client.PostAsync(url, Multipart("<svg/>"u8.ToArray(), "dish.png", "image/png"));
        fake.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadErrorCodeAsync(fake)).Should().Be("menu_item.invalid_photo");

        var big = new byte[2 * 1024 * 1024 + 1];
        png.CopyTo(big, 0);
        var tooBig = await client.PostAsync(url, Multipart(big, "dish.png", "image/png"));
        tooBig.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Waiter_reads_menu_but_cannot_change_it_and_other_tenants_get_404()
    {
        var (org, owner) = await OwnerAsync();
        var categoryId = await CreateCategoryAsync(owner);
        var itemId = (await CreateItemAsync(owner, categoryId, "Манты")).GetProperty("id").GetGuid();
        var waiter = ClientWithBranch(await LoginAsAsync(await AddUserAsync(org, SystemRoles.Waiter)), org.BranchId);

        (await waiter.GetAsync("/api/v1/menu/pos")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await waiter.PostAsJsonAsync("/api/v1/menu/categories", new { name = "X" }, Json)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await waiter.PostAsync($"/api/v1/menu/items/{itemId}/archive", null)).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var (_, stranger) = await OwnerAsync();
        var get = await stranger.GetAsync($"/api/v1/menu/items/{itemId}");
        get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(get)).Should().Be("menu_item.not_found");
        (await stranger.PostAsync($"/api/v1/menu/items/{itemId}/archive", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        var foreignCategory = await stranger.PostAsJsonAsync("/api/v1/menu/items",
            new { categoryId, name = "Hack", price = 1m, prepTimeMinutes = 1 }, Json);
        foreignCategory.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Kitchen_station_in_use_cannot_be_archived()
    {
        var (_, client) = await OwnerAsync();
        var created = await client.PostAsJsonAsync("/api/v1/kitchen-stations", new { name = "Горячий цех" }, Json);
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var stationId = (await ReadJsonAsync(created)).GetProperty("id").GetGuid();
        var item = await CreateItemAsync(client, await CreateCategoryAsync(client), "Шашлык", new { kitchenStationId = stationId });

        var refused = await client.DeleteAsync($"/api/v1/kitchen-stations/{stationId}");
        refused.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(refused)).Should().Be("kitchen_station.in_use");

        await client.PostAsync($"/api/v1/menu/items/{item.GetProperty("id").GetGuid()}/archive", null);
        (await client.DeleteAsync($"/api/v1/kitchen-stations/{stationId}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var stations = await client.GetFromJsonAsync<JsonElement>("/api/v1/kitchen-stations", Json);
        stations.GetArrayLength().Should().Be(0);
    }

    private static MultipartFormDataContent Multipart(byte[] bytes, string fileName, string contentType)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }
}
