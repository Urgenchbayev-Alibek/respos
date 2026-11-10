using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Restaurant.IntegrationTests.Infrastructure;
using Restaurant.IntegrationTests.Orders;

namespace Restaurant.IntegrationTests.Payments;

/// <summary>F2 helpers: split, bill payments, provider intents and raw provider callbacks (fake credentials from ApiFactory).</summary>
public abstract class F2TestBase(ApiFactory factory) : PosTestBase(factory)
{
    protected const string PaymeKey = "test-payme-key";
    protected const string ClickSecret = "test-click-secret";
    protected const string ClickServiceId = "1001";

    protected static async Task<JsonElement> SplitAsync(HttpClient client, Guid orderId, object body)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/orders/{orderId}/split", body, Json);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    protected static Task<HttpResponseMessage> PayBillAsync(
        HttpClient client, Guid orderId, Guid? billId, decimal amount, decimal tipAmount = 0m, string method = "cash") =>
        PostWithKeyAsync(client, "/api/v1/payments", new { orderId, billId, method, amount, tipAmount });

    protected static IReadOnlyList<(Guid Id, decimal Amount)> Bills(JsonElement order) =>
        order.GetProperty("bills").EnumerateArray()
            .Select(b => (b.GetProperty("id").GetGuid(), b.GetProperty("amount").GetDecimal()))
            .ToList();

    protected static async Task EnableProviderAsync(HttpClient client, string code)
    {
        var response = await client.PutAsJsonAsync($"/api/v1/payments/providers/{code}", new { isEnabled = true }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
    }

    protected static async Task<JsonElement> CreateIntentAsync(HttpClient client, Guid orderId, string provider, decimal tipAmount = 0m, Guid? billId = null)
    {
        var response = await client.PostAsJsonAsync("/api/v1/payments/intents", new { orderId, billId, provider, tipAmount }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    /// <summary>Payme JSON-RPC call with Basic <c>Paycom:&lt;key&gt;</c> (null key → no Authorization header).</summary>
    protected async Task<JsonElement> PaymeAsync(string method, object parameters, string? key = PaymeKey)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/payments/providers/payme/callback")
        {
            Content = JsonContent.Create(new { jsonrpc = "2.0", id = 7, method, @params = parameters }),
        };
        if (key is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"Paycom:{key}")));
        }

        var response = await CreateClient().SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    protected static int PaymeError(JsonElement response) => response.GetProperty("error").GetProperty("code").GetInt32();

    /// <summary>Click Prepare (action 0) / Complete (action 1) form post, signed with <paramref name="secret"/>.</summary>
    protected async Task<JsonElement> ClickAsync(
        int action, string clickTransId, Guid intentId, string amount, string? prepareId = null, string secret = ClickSecret, int error = 0)
    {
        const string signTime = "2026-11-10 12:00:00";
        var sign = Md5(clickTransId + ClickServiceId + secret + intentId + (action == 1 ? prepareId : string.Empty) + amount + action + signTime);
        var fields = new Dictionary<string, string>
        {
            ["click_trans_id"] = clickTransId,
            ["service_id"] = ClickServiceId,
            ["click_paydoc_id"] = "555",
            ["merchant_trans_id"] = intentId.ToString(),
            ["amount"] = amount,
            ["action"] = action.ToString(),
            ["error"] = error.ToString(),
            ["error_note"] = error == 0 ? "Success" : "Failed",
            ["sign_time"] = signTime,
            ["sign_string"] = sign,
        };
        if (prepareId is not null)
        {
            fields["merchant_prepare_id"] = prepareId;
        }

        var response = await CreateClient().PostAsync("/api/v1/payments/providers/click/callback", new FormUrlEncodedContent(fields));
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    protected static long Tiyin(decimal amount) => (long)(amount * 100m);

    private static string Md5(string value) => Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
