using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Restaurant.Application.Abstractions.Integrations;

namespace Restaurant.Infrastructure.Integrations.Telegram;

/// <summary>
/// Telegram Bot API <c>POST /bot{token}/sendMessage</c> (typed HttpClient with timeout, default HTTP logging removed so
/// the token in the URL never reaches logs). 429 honours <c>parameters.retry_after</c>; 5xx/network are retried.
/// </summary>
public sealed partial class TelegramBotClient(HttpClient http, IntegrationRetry retry) : ITelegramSender
{
    public const int MaxTextLength = 4096;

    public Task<DeliveryResult> SendMessageAsync(string botToken, string chatId, string text, CancellationToken cancellationToken)
    {
        if (!TokenFormat().IsMatch(botToken))
        {
            return Task.FromResult(DeliveryResult.Fail("Invalid bot token format."));
        }

        // "./" keeps "bot123:ABC/..." relative (otherwise "bot123:" parses as a URI scheme).
        var body = new { chat_id = chatId, text = text.Length <= MaxTextLength ? text : text[..MaxTextLength], disable_web_page_preview = true };
        return retry.ExecuteAsync(
            async ct =>
            {
                using var response = await http.PostAsJsonAsync($"./bot{botToken}/sendMessage", body, ct);
                return response.IsSuccessStatusCode ? DeliveryResult.Success : await FailureAsync(response, botToken, ct);
            },
            message => IntegrationRetry.Scrub(message, botToken),
            cancellationToken);
    }

    private static async Task<DeliveryResult> FailureAsync(HttpResponseMessage response, string token, CancellationToken ct)
    {
        var description = $"HTTP {(int)response.StatusCode}";
        TimeSpan? retryAfter = null;
        try
        {
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            if (json.RootElement.TryGetProperty("description", out var d) && d.ValueKind == JsonValueKind.String)
            {
                description += ": " + d.GetString();
            }

            if (json.RootElement.TryGetProperty("parameters", out var p) && p.TryGetProperty("retry_after", out var ra) && ra.TryGetInt32(out var seconds))
            {
                retryAfter = TimeSpan.FromSeconds(seconds);
            }
        }
        catch (JsonException)
        {
            description += " (non-JSON response)";
        }

        retryAfter ??= response.Headers.RetryAfter?.Delta;
        var status = response.StatusCode;
        var retryable = status == HttpStatusCode.TooManyRequests || (int)status >= 500;
        return DeliveryResult.Fail(IntegrationRetry.Truncate(IntegrationRetry.Scrub("Telegram " + description, token)), retryable, retryAfter);
    }

    [GeneratedRegex(@"^\d{3,15}:[A-Za-z0-9_-]{20,100}$")]
    private static partial Regex TokenFormat();
}
