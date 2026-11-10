using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Integrations;

namespace Restaurant.Infrastructure.Integrations;

/// <summary>Config section <c>Integrations</c> (no secrets here — per-organization secrets live encrypted in the DB).</summary>
public sealed class IntegrationsOptions
{
    public const string SectionName = "Integrations";

    /// <summary>Outbound dispatcher + daily summary background services.</summary>
    public bool BackgroundEnabled { get; set; } = true;
    public int DispatcherIntervalSeconds { get; set; } = 10;
    public int DispatcherBatchSize { get; set; } = 20;
    public int DailySummaryIntervalSeconds { get; set; } = 60;
    /// <summary>Finished outbound messages and error logs older than this are deleted.</summary>
    public int RetentionDays { get; set; } = 30;

    public string TelegramBaseUrl { get; set; } = "https://api.telegram.org/";
    public string EskizBaseUrl { get; set; } = "https://notify.eskiz.uz/";
    public int HttpTimeoutSeconds { get; set; } = 10;
    /// <summary>In-request attempts per delivery (the queue retries later with backoff).</summary>
    public int HttpMaxAttempts { get; set; } = 3;
    public int HttpBaseDelayMilliseconds { get; set; } = 500;
    /// <summary>Longer server-requested waits (Telegram 429 retry_after) are left to the queue.</summary>
    public int HttpMaxInlineDelaySeconds { get; set; } = 10;
}

/// <summary>
/// Config section <c>Integrations:Smtp</c> — platform-wide SMTP (set only via env, e.g. <c>Integrations__Smtp__Password</c>),
/// used for e-mails when the organization has no SMTP of its own (password reset is always platform-level).
/// </summary>
public sealed class PlatformSmtpOptions
{
    public const string SectionName = "Integrations:Smtp";

    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? FromEmail { get; set; }
    public string? FromName { get; set; } = "RestaurantOS";
}

internal sealed class PlatformSmtpSettings(IOptions<PlatformSmtpOptions> options) : IPlatformSmtpSettings
{
    public SmtpServer? Server
    {
        get
        {
            var o = options.Value;
            return string.IsNullOrWhiteSpace(o.Host) || string.IsNullOrWhiteSpace(o.FromEmail)
                ? null
                : new SmtpServer(o.Host.Trim(), o.Port, o.UseSsl, o.Username, o.Password, o.FromEmail.Trim(), o.FromName);
        }
    }
}
