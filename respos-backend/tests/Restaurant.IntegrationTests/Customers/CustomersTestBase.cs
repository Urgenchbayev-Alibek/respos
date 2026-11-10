using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Restaurant.IntegrationTests.Infrastructure;
using Restaurant.IntegrationTests.Orders;

namespace Restaurant.IntegrationTests.Customers;

/// <summary>Helpers for guest (CRM) and loyalty API tests (F1).</summary>
public abstract class CustomersTestBase(ApiFactory factory) : PosTestBase(factory)
{
    protected static async Task EnableLoyaltyAsync(
        HttpClient owner, decimal earnPercent = 10m, decimal maxRedeemPercent = 50m, decimal minOrderAmount = 0m, int? expiryDays = null)
    {
        var response = await owner.PutAsJsonAsync("/api/v1/loyalty/settings",
            new { isEnabled = true, earnPercent, maxRedeemPercent, minOrderAmount, pointsExpiryDays = expiryDays }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
    }

    protected static async Task<JsonElement> CreateCustomerAsync(HttpClient client, string phone, string name = "Азиз", params string[] tags)
    {
        var response = await client.PostAsJsonAsync("/api/v1/customers", new { phone, name, tags, marketingConsent = true }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    protected static async Task<JsonElement> AttachAsync(HttpClient client, Guid orderId, Guid customerId)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/orders/{orderId}/customer", new { customerId }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    protected static Task<HttpResponseMessage> RedeemAsync(HttpClient client, Guid orderId, decimal points) =>
        client.PostAsJsonAsync($"/api/v1/orders/{orderId}/loyalty/redeem", new { points }, Json);

    /// <summary>Pays the remaining amount in cash; returns the payment.</summary>
    protected static async Task<JsonElement> PayRemainingAsync(HttpClient client, Guid orderId)
    {
        var order = await GetOrderAsync(client, orderId);
        var response = await PayAsync(client, orderId, order.GetProperty("remainingAmount").GetDecimal());
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    protected static async Task<decimal> PointsAsync(HttpClient client, Guid customerId)
    {
        var response = await client.GetAsync($"/api/v1/customers/{customerId}");
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await ReadJsonAsync(response)).GetProperty("loyalty").GetProperty("points").GetDecimal();
    }

    protected static async Task<List<JsonElement>> LedgerAsync(HttpClient client, Guid customerId)
    {
        var response = await client.GetAsync($"/api/v1/customers/{customerId}/loyalty/transactions?pageSize=100");
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await ReadJsonAsync(response)).GetProperty("items").EnumerateArray().ToList();
    }

    /// <summary>A paid takeaway order (one Plov) for the customer — gives 10% = 4500 points with default settings.</summary>
    protected static async Task<Guid> PaidOrderForAsync(HttpClient client, PosSeed seed, Guid customerId)
    {
        var orderId = Id(await CreateOrderAsync(client, null, Line(seed.PlovId)));
        await AttachAsync(client, orderId, customerId);
        await PayRemainingAsync(client, orderId);
        return orderId;
    }
}
