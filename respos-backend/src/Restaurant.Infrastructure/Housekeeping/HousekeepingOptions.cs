namespace Restaurant.Infrastructure.Housekeeping;

/// <summary>Config section <c>Housekeeping</c>: periodic deletion of stale technical rows.</summary>
public sealed class HousekeepingOptions
{
    public const string SectionName = "Housekeeping";

    public bool Enabled { get; set; } = true;

    public int IntervalMinutes { get; set; } = 60;

    /// <summary>Idempotency records older than this are deleted (the replay window is 24h).</summary>
    public int IdempotencyRetentionHours { get; set; } = 24;

    /// <summary>Refresh tokens expired or revoked more than this many days ago.</summary>
    public int RefreshTokenRetentionDays { get; set; } = 30;

    /// <summary>Password reset tokens and invitations expired more than this many days ago.</summary>
    public int ExpiredTokenRetentionDays { get; set; } = 30;

    /// <summary>Notifications (with at least one read mark) created more than this many days ago.</summary>
    public int ReadNotificationRetentionDays { get; set; } = 90;
}
