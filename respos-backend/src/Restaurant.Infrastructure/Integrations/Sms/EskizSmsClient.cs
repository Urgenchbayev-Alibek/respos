using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Restaurant.Application.Abstractions.Integrations;

namespace Restaurant.Infrastructure.Integrations.Sms;

/// <summary>
/// Eskiz.uz adapter: <c>POST api/auth/login</c> (email + password → bearer token, cached in memory ~29 days, keyed by a
/// hash of the credentials) and <c>POST api/message/sms/send</c> (<c>mobile_phone</c> 998XXXXXXXXX, <c>message</c>, <c>from</c>).
/// A 401 on send drops the cached token and logs in again once. Test-mode Eskiz accounts accept only fixed texts.
/// </summary>
public sealed class EskizSmsClient(HttpClient http, IntegrationRetry retry, IMemoryCache cache) : ISmsSender
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromDays(29);

    public async Task<DeliveryResult> SendAsync(EskizCredentials credentials, string phone, string text, CancellationToken cancellationToken)
    {
        var cacheKey = CacheKey(credentials);
        for (var round = 0; round < 2; round++)
        {
            var token = await TokenAsync(credentials, cacheKey, cancellationToken);
            if (token.Error is { } authError)
            {
                return authError;
            }

            var result = await retry.ExecuteAsync(
                ct => SendOnceAsync(token.Value!, credentials, phone, text, ct),
                message => Scrub(message, credentials, token.Value),
                cancellationToken);
            if (result.Error != Unauthorized)
            {
                return result;
            }

            cache.Remove(cacheKey);
        }

        return DeliveryResult.Fail("Eskiz rejected the token twice.");
    }

    private const string Unauthorized = "Eskiz HTTP 401";

    private async Task<DeliveryResult> SendOnceAsync(string token, EskizCredentials credentials, string phone, string text, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/message/sms/send")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["mobile_phone"] = phone.TrimStart('+'),
                ["message"] = text,
                ["from"] = credentials.From,
            }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await http.SendAsync(request, ct);
        if (response.IsSuccessStatusCode)
        {
            return DeliveryResult.Success;
        }

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            return DeliveryResult.Fail(Unauthorized);
        }

        return await FailureAsync("Eskiz", response, ct);
    }

    private async Task<(string? Value, DeliveryResult? Error)> TokenAsync(EskizCredentials credentials, string cacheKey, CancellationToken ct)
    {
        if (cache.TryGetValue(cacheKey, out string? cached) && cached is not null)
        {
            return (cached, null);
        }

        string? token = null;
        var result = await retry.ExecuteAsync(
            async attemptCt =>
            {
                using var content = new MultipartFormDataContent
                {
                    { new StringContent(credentials.Email), "email" },
                    { new StringContent(credentials.Password), "password" },
                };
                using var response = await http.PostAsync("api/auth/login", content, attemptCt);
                if (!response.IsSuccessStatusCode)
                {
                    return response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.UnprocessableEntity
                        ? DeliveryResult.Fail("Eskiz authentication failed: check e-mail and password.")
                        : await FailureAsync("Eskiz auth", response, attemptCt);
                }

                using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(attemptCt));
                token = json.RootElement.TryGetProperty("data", out var data) && data.TryGetProperty("token", out var t) ? t.GetString() : null;
                return token is { Length: > 0 } ? DeliveryResult.Success : DeliveryResult.Fail("Eskiz auth: no token in response.");
            },
            message => Scrub(message, credentials, null),
            ct);
        if (!result.Succeeded || token is null)
        {
            return (null, result.Succeeded ? DeliveryResult.Fail("Eskiz auth: no token in response.") : result);
        }

        cache.Set(cacheKey, token, TokenLifetime);
        return (token, null);
    }

    private static async Task<DeliveryResult> FailureAsync(string prefix, HttpResponseMessage response, CancellationToken ct)
    {
        var body = await response.Content.ReadAsStringAsync(ct);
        var detail = string.Empty;
        try
        {
            using var json = JsonDocument.Parse(body);
            if (json.RootElement.TryGetProperty("message", out var m))
            {
                detail = ": " + (m.ValueKind == JsonValueKind.String ? m.GetString() : m.GetRawText());
            }
        }
        catch (JsonException)
        {
            detail = " (non-JSON response)";
        }

        var status = (int)response.StatusCode;
        var retryable = status == 429 || status >= 500;
        return DeliveryResult.Fail(IntegrationRetry.Truncate($"{prefix} HTTP {status}{detail}"), retryable, response.Headers.RetryAfter?.Delta);
    }

    private static string Scrub(string message, EskizCredentials credentials, string? token) =>
        IntegrationRetry.Scrub(IntegrationRetry.Scrub(message, credentials.Password), token);

    private static string CacheKey(EskizCredentials credentials) =>
        "eskiz-token:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(credentials.Email + "\n" + credentials.Password)));
}
