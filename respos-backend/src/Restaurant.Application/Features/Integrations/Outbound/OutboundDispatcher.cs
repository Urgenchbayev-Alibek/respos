using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Outbound;

/// <summary>
/// One dispatcher pass over due <c>pending</c> messages (all tenants). Each row is claimed with a conditional update
/// (lease on <c>NextAttemptAt</c>) so several API instances never send the same message twice.
/// </summary>
[ScopedService]
public sealed class OutboundDispatcher(IApplicationDbContext db, OutboundDelivery delivery, IClock clock)
{
    public static readonly TimeSpan Lease = TimeSpan.FromMinutes(5);

    public async Task<int> RunOnceAsync(int batchSize, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var due = await db.OutboundMessages
            .Where(m => m.Status == OutboundStatus.Pending && m.NextAttemptAt <= now)
            .OrderBy(m => m.NextAttemptAt)
            .Select(m => new { m.Id, m.NextAttemptAt })
            .Take(batchSize)
            .ToListAsync(cancellationToken);

        var processed = 0;
        foreach (var candidate in due)
        {
            var leaseUntil = now + Lease;
            var claimed = await db.OutboundMessages
                .Where(m => m.Id == candidate.Id && m.Status == OutboundStatus.Pending && m.NextAttemptAt == candidate.NextAttemptAt)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.NextAttemptAt, leaseUntil), cancellationToken);
            if (claimed == 0)
            {
                continue;
            }

            var message = await db.OutboundMessages.FirstAsync(m => m.Id == candidate.Id, cancellationToken);
            await delivery.DeliverAsync(message, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            processed++;
        }

        return processed;
    }

    /// <summary>Deletes finished messages and error logs older than <paramref name="retention"/>.</summary>
    public async Task<int> PurgeAsync(TimeSpan retention, CancellationToken cancellationToken)
    {
        var cutoff = clock.UtcNow - retention;
        var messages = await db.OutboundMessages
            .Where(m => m.Status != OutboundStatus.Pending && m.CreatedAt < cutoff)
            .ExecuteDeleteAsync(cancellationToken);
        var errors = await db.IntegrationErrorLogs.Where(e => e.CreatedAt < cutoff).ExecuteDeleteAsync(cancellationToken);
        return messages + errors;
    }
}
