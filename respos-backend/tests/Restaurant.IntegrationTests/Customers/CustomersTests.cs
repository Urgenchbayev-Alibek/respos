using System.Net;
using System.Net.Http.Json;
using Restaurant.Domain.Constants;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Customers;

[Collection(ApiCollection.Name)]
public sealed class CustomersTests(ApiFactory factory) : CustomersTestBase(factory)
{
    [Fact]
    public async Task Phone_is_normalized_and_unique_per_organization()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var client = await BranchClientAsync(org);

        var created = await CreateCustomerAsync(client, "90 123-45-67", "Азиз", "VIP", " vip ", "Постоянный");
        var duplicate = await client.PostAsJsonAsync("/api/v1/customers", new { phone = "+998 (90) 123 45 67", name = "Другой" }, Json);
        var invalid = await client.PostAsJsonAsync("/api/v1/customers", new { phone = "12345", name = "Ошибка" }, Json);
        var otherOrg = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var sameInOtherOrg = await (await BranchClientAsync(otherOrg)).PostAsJsonAsync("/api/v1/customers",
            new { phone = "998901234567", name = "Азиз" }, Json);

        created.GetProperty("phone").GetString().Should().Be("+998901234567");
        created.GetProperty("tags").EnumerateArray().Select(t => t.GetString()).Should().Equal("vip", "постоянный");
        created.GetProperty("isVip").GetBoolean().Should().BeTrue();
        duplicate.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(duplicate)).Should().Be("customer.phone_taken");
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadErrorCodeAsync(invalid)).Should().Be("validation.failed");
        sameInOtherOrg.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Update_search_segments_and_delete()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var client = await BranchClientAsync(org);
        var aziz = await CreateCustomerAsync(client, "901234567", "Азиз Каримов");
        await CreateCustomerAsync(client, "937654321", "Malika", "vip");
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5));

        var update = await client.PutAsJsonAsync($"/api/v1/customers/{Id(aziz)}",
            new { phone = "901234567", name = "Азиз К.", birthday = today.AddYears(-30).ToString("yyyy-MM-dd"), gender = "male", notes = "у окна" }, Json);
        var byPhone = await ReadJsonAsync(await client.GetAsync("/api/v1/customers?search=1234"));
        var byName = await ReadJsonAsync(await client.GetAsync("/api/v1/customers?search=malika"));
        var vip = await ReadJsonAsync(await client.GetAsync("/api/v1/customers?segment=vip"));
        var birthday = await ReadJsonAsync(await client.GetAsync("/api/v1/customers?segment=birthday"));
        var regular = await ReadJsonAsync(await client.GetAsync("/api/v1/customers?segment=regular"));
        var newOnes = await ReadJsonAsync(await client.GetAsync("/api/v1/customers?segment=new&sort=name:asc"));

        update.StatusCode.Should().Be(HttpStatusCode.OK, await update.Content.ReadAsStringAsync());
        var updated = await ReadJsonAsync(update);
        updated.GetProperty("name").GetString().Should().Be("Азиз К.");
        updated.GetProperty("gender").GetString().Should().Be("male");
        updated.GetProperty("isBirthdayToday").GetBoolean().Should().BeTrue();
        Names(byPhone).Should().Equal("Азиз К.");
        Names(byName).Should().Equal("Malika");
        Names(vip).Should().Equal("Malika");
        Names(birthday).Should().Equal("Азиз К.");
        Names(regular).Should().BeEmpty();
        Names(newOnes).Should().Equal("Malika", "Азиз К.");

        (await client.DeleteAsync($"/api/v1/customers/{Id(aziz)}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await client.GetAsync($"/api/v1/customers/{Id(aziz)}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Stats_come_from_paid_orders_and_customer_with_orders_cannot_be_deleted()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        var customerId = Id(await CreateCustomerAsync(client, "901112233"));
        await PaidOrderForAsync(client, seed, customerId);
        var open = Id(await CreateOrderAsync(client, null, Line(seed.TeaId)));
        var attached = await AttachAsync(client, open, customerId);

        var card = await ReadJsonAsync(await client.GetAsync($"/api/v1/customers/{customerId}"));
        var orders = await ReadJsonAsync(await client.GetAsync($"/api/v1/customers/{customerId}/orders"));
        var delete = await client.DeleteAsync($"/api/v1/customers/{customerId}");

        attached.GetProperty("customer").GetProperty("id").GetGuid().Should().Be(customerId);
        attached.GetProperty("customer").GetProperty("phone").GetString().Should().Be("+998901112233");
        var stats = card.GetProperty("stats");
        stats.GetProperty("visits").GetInt32().Should().Be(1);
        stats.GetProperty("totalSpent").GetDecimal().Should().Be(PlovPrice);
        stats.GetProperty("averageCheck").GetDecimal().Should().Be(PlovPrice);
        stats.GetProperty("lastVisitAt").ValueKind.Should().Be(System.Text.Json.JsonValueKind.String);
        orders.GetProperty("totalCount").GetInt32().Should().Be(2);
        orders.GetProperty("items")[0].GetProperty("branchName").GetString().Should().Be("Main");
        delete.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(delete)).Should().Be("customer.has_history");

        var detached = await ReadJsonAsync(await client.DeleteAsync($"/api/v1/orders/{open}/customer"));
        detached.GetProperty("customer").ValueKind.Should().Be(System.Text.Json.JsonValueKind.Null);
    }

    [Fact]
    public async Task Permissions_are_enforced_for_guest_endpoints()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var owner = await BranchClientAsync(org);
        var customerId = Id(await CreateCustomerAsync(owner, "901112233"));
        var orderId = Id(await CreateOrderAsync(owner, null, Line(seed.TeaId)));
        var cook = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Cook));
        var cashier = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Cashier));
        var waiter = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Waiter));
        var accountant = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Accountant));

        (await cook.GetAsync("/api/v1/customers")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cashier.PostAsJsonAsync("/api/v1/customers", new { phone = "901110000", name = "X" }, Json)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cashier.PutAsJsonAsync("/api/v1/loyalty/settings", new { isEnabled = true, earnPercent = 1, maxRedeemPercent = 1, minOrderAmount = 0 }, Json))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await accountant.PostAsJsonAsync($"/api/v1/orders/{orderId}/customer", new { customerId }, Json)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await accountant.PostAsJsonAsync($"/api/v1/orders/{orderId}/loyalty/redeem", new { points = 1 }, Json)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cashier.GetAsync("/api/v1/customers?search=901")).StatusCode.Should().Be(HttpStatusCode.OK);
        await AttachAsync(cashier, orderId, customerId);
        await CreateCustomerAsync(waiter, "905556677", "Гость официанта");
    }

    [Fact]
    public async Task Other_tenants_customers_are_invisible_and_cannot_be_attached()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var foreignCustomer = Id(await CreateCustomerAsync(await BranchClientAsync(org), "901112233", "Чужой"));
        var other = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(other);
        var client = await BranchClientAsync(other);
        var orderId = Id(await CreateOrderAsync(client, null, Line(seed.TeaId)));

        var get = await client.GetAsync($"/api/v1/customers/{foreignCustomer}");
        var list = await ReadJsonAsync(await client.GetAsync("/api/v1/customers"));
        var ledger = await client.GetAsync($"/api/v1/customers/{foreignCustomer}/loyalty/transactions");
        var attach = await client.PostAsJsonAsync($"/api/v1/orders/{orderId}/customer", new { customerId = foreignCustomer }, Json);
        var update = await client.PutAsJsonAsync($"/api/v1/customers/{foreignCustomer}", new { phone = "901112233", name = "Взлом" }, Json);

        get.StatusCode.Should().Be(HttpStatusCode.NotFound);
        list.GetProperty("totalCount").GetInt32().Should().Be(0);
        ledger.StatusCode.Should().Be(HttpStatusCode.NotFound);
        attach.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(attach)).Should().Be("customer.not_found");
        update.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private static List<string?> Names(System.Text.Json.JsonElement page) =>
        page.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("name").GetString()).ToList();
}
