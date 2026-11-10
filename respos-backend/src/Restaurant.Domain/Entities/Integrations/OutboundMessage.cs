using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Integrations;

/// <summary>
/// Queue row for an outgoing Telegram / SMS / e-mail message, delivered by the background dispatcher with retries.
/// Not tenant-filtered (platform e-mails have no organization) — queries always filter by OrganizationId explicitly.
/// Recipient and body live only in the encrypted <see cref="ProtectedPayload"/>; <see cref="RecipientMasked"/> and
/// <see cref="Summary"/> are safe to show.
/// </summary>
public class OutboundMessage : Entity
{
    public const int DefaultMaxAttempts = 5;
    public const int ErrorMaxLength = 500;

    public Guid? OrganizationId { get; set; }
    public Guid? BranchId { get; set; }
    public OutboundChannel Channel { get; set; }
    /// <summary>Event kind, e.g. <c>daily_summary</c>, <c>low_stock</c>, <c>password_reset</c>.</summary>
    public string Kind { get; set; } = string.Empty;
    public string RecipientMasked { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string ProtectedPayload { get; set; } = string.Empty;
    /// <summary>Unique when set: makes scheduled messages idempotent (e.g. one daily summary per branch and day).</summary>
    public string? DedupeKey { get; set; }
    public OutboundStatus Status { get; set; } = OutboundStatus.Pending;
    public int Attempts { get; set; }
    public int MaxAttempts { get; set; } = DefaultMaxAttempts;
    public DateTime NextAttemptAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SentAt { get; set; }

    public void MarkSent(DateTime utcNow)
    {
        Attempts++;
        Status = OutboundStatus.Sent;
        SentAt = utcNow;
        LastError = null;
    }

    public void MarkSkipped(string reason)
    {
        Status = OutboundStatus.Skipped;
        LastError = Truncate(reason);
    }

    /// <summary>Retryable failures are rescheduled with exponential backoff until <see cref="MaxAttempts"/>.</summary>
    public void MarkFailedAttempt(string error, bool retryable, DateTime utcNow, TimeSpan? retryAfter = null)
    {
        Attempts++;
        LastError = Truncate(error);
        if (!retryable || Attempts >= MaxAttempts)
        {
            Status = OutboundStatus.Failed;
            return;
        }

        Status = OutboundStatus.Pending;
        var backoff = TimeSpan.FromSeconds(30 * Math.Pow(2, Attempts - 1));
        NextAttemptAt = utcNow + (retryAfter is { } after && after > backoff ? after : backoff);
    }

    private static string Truncate(string value) => value.Length <= ErrorMaxLength ? value : value[..ErrorMaxLength];
}

/// <summary>Failed delivery / test of an integration (shown to the organization and in Platform → integration errors).</summary>
public class IntegrationErrorLog : Entity
{
    public const int MessageMaxLength = 1000;

    public Guid? OrganizationId { get; set; }
    public IntegrationType? IntegrationType { get; set; }
    public OutboundChannel? Channel { get; set; }
    public string Operation { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public Guid? OutboundMessageId { get; set; }
    public DateTime CreatedAt { get; set; }
}
