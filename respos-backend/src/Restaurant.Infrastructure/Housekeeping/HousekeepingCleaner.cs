using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Housekeeping;

public sealed record HousekeepingResult(
    int IdempotencyRecords,
    int RefreshTokens,
    int PasswordResetTokens,
    int Invitations,
    int Notifications);

/// <summary>
/// Deletes stale technical rows across ALL tenants (query filters are ignored explicitly; there is no tenant context in a background job).
/// Bulk <c>ExecuteDeleteAsync</c> — no entities are loaded or tracked.
/// </summary>
public sealed class HousekeepingCleaner(
    AppDbContext db,
    IClock clock,
    IOptions<HousekeepingOptions> options,
    ILogger<HousekeepingCleaner> logger)
{
    public async Task<HousekeepingResult> RunAsync(CancellationToken cancellationToken = default)
    {
        var o = options.Value;
        var now = clock.UtcNow;
        var idempotencyCutoff = now.AddHours(-o.IdempotencyRetentionHours);
        var refreshCutoff = now.AddDays(-o.RefreshTokenRetentionDays);
        var tokenCutoff = now.AddDays(-o.ExpiredTokenRetentionDays);
        var notificationCutoff = now.AddDays(-o.ReadNotificationRetentionDays);

        var result = new HousekeepingResult(
            await db.IdempotencyRecords.IgnoreQueryFilters()
                .Where(r => r.CreatedAt < idempotencyCutoff)
                .ExecuteDeleteAsync(cancellationToken),
            await db.RefreshTokens.IgnoreQueryFilters()
                .Where(t => t.ExpiresAt < refreshCutoff || (t.RevokedAt != null && t.RevokedAt < refreshCutoff))
                .ExecuteDeleteAsync(cancellationToken),
            await db.PasswordResetTokens.IgnoreQueryFilters()
                .Where(t => t.ExpiresAt < tokenCutoff)
                .ExecuteDeleteAsync(cancellationToken),
            await db.UserInvitations.IgnoreQueryFilters()
                .Where(i => i.ExpiresAt < tokenCutoff)
                .ExecuteDeleteAsync(cancellationToken),
            // notification_reads rows go with them (FK ON DELETE CASCADE).
            await db.Notifications.IgnoreQueryFilters()
                .Where(n => n.CreatedAt < notificationCutoff && n.Reads.Any())
                .ExecuteDeleteAsync(cancellationToken));

        logger.LogInformation(
            "Housekeeping deleted {IdempotencyRecords} idempotency records, {RefreshTokens} refresh tokens, {PasswordResetTokens} password reset tokens, {Invitations} invitations, {Notifications} read notifications",
            result.IdempotencyRecords, result.RefreshTokens, result.PasswordResetTokens, result.Invitations, result.Notifications);
        return result;
    }
}
