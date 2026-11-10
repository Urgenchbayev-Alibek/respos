using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Integrations;

namespace Restaurant.Infrastructure.Integrations;

/// <summary>
/// In-request retry with exponential backoff for provider HTTP calls: retryable results (429 / 5xx / timeouts / network)
/// are retried up to <c>HttpMaxAttempts</c>; a server-requested wait longer than <c>HttpMaxInlineDelaySeconds</c> is
/// returned to the caller (the outbound queue reschedules). Network exceptions become retryable failures whose message
/// is passed through <c>scrub</c> (removes tokens from URLs).
/// </summary>
public sealed class IntegrationRetry
{
    private readonly IntegrationsOptions _options;
    private readonly Func<TimeSpan, CancellationToken, Task> _delay;

    public IntegrationRetry(IOptions<IntegrationsOptions> options)
        : this(options.Value, Task.Delay)
    {
    }

    public IntegrationRetry(IntegrationsOptions options, Func<TimeSpan, CancellationToken, Task> delay)
    {
        _options = options;
        _delay = delay;
    }

    public async Task<DeliveryResult> ExecuteAsync(
        Func<CancellationToken, Task<DeliveryResult>> attempt, Func<string, string> scrub, CancellationToken cancellationToken)
    {
        var maxAttempts = Math.Max(1, _options.HttpMaxAttempts);
        var maxInline = TimeSpan.FromSeconds(Math.Max(0, _options.HttpMaxInlineDelaySeconds));
        DeliveryResult result = DeliveryResult.Fail("Not attempted.", retryable: true);
        for (var n = 1; n <= maxAttempts; n++)
        {
            result = await SafeAttemptAsync(attempt, scrub, cancellationToken);
            if (result.Succeeded || !result.Retryable || n == maxAttempts)
            {
                return result;
            }

            var wait = result.RetryAfter ?? TimeSpan.FromMilliseconds(_options.HttpBaseDelayMilliseconds * Math.Pow(2, n - 1));
            if (wait > maxInline)
            {
                return result;
            }

            await _delay(wait, cancellationToken);
        }

        return result;
    }

    private static async Task<DeliveryResult> SafeAttemptAsync(
        Func<CancellationToken, Task<DeliveryResult>> attempt, Func<string, string> scrub, CancellationToken cancellationToken)
    {
        try
        {
            return await attempt(cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            return DeliveryResult.Fail(scrub("Network error: " + ex.Message), retryable: true);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return DeliveryResult.Fail("Timeout: the provider did not answer in time.", retryable: true);
        }
    }

    /// <summary>Removes every occurrence of <paramref name="secret"/> from <paramref name="text"/>.</summary>
    public static string Scrub(string text, string? secret) =>
        string.IsNullOrEmpty(secret) ? text : text.Replace(secret, "***", StringComparison.Ordinal);

    public static string Truncate(string text, int max = 300) => text.Length <= max ? text : text[..max];
}
