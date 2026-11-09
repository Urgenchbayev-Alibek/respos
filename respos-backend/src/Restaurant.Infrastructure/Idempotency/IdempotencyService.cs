using Microsoft.EntityFrameworkCore;
using Npgsql;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Idempotency;
using Restaurant.Domain.Entities.Audit;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Idempotency;

/// <summary>
/// Reserve-then-complete idempotency store. The key is reserved with an INSERT (unique Key+UserId) before the
/// action runs, so concurrent duplicates get <see cref="IdempotencyState.InProgress"/>. Completion/abandon use
/// ExecuteUpdate/ExecuteDelete so they never flush unrelated tracked changes.
/// </summary>
internal sealed class IdempotencyService(AppDbContext db, IClock clock) : IIdempotencyService
{
    private static readonly TimeSpan Retention = TimeSpan.FromHours(24);

    public async Task<IdempotencyBeginResult> BeginAsync(string key, Guid userId, string requestHash, CancellationToken cancellationToken = default)
    {
        var now = clock.UtcNow;
        await db.IdempotencyRecords
            .Where(r => r.Key == key && r.UserId == userId && r.CreatedAt < now - Retention)
            .ExecuteDeleteAsync(cancellationToken);

        var existing = await FindAsync(key, userId, cancellationToken);
        if (existing is not null)
        {
            return Classify(existing, requestHash);
        }

        var record = new IdempotencyRecord { Key = key, UserId = userId, RequestHash = requestHash, CreatedAt = now };
        db.IdempotencyRecords.Add(record);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return new IdempotencyBeginResult(IdempotencyState.Started, record.Id, null, null);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            db.Entry(record).State = EntityState.Detached;
            var winner = await FindAsync(key, userId, cancellationToken);
            return winner is null
                ? new IdempotencyBeginResult(IdempotencyState.InProgress, Guid.Empty, null, null)
                : Classify(winner, requestHash);
        }
    }

    public Task CompleteAsync(Guid recordId, int responseStatus, string? responseBody, CancellationToken cancellationToken = default) =>
        db.IdempotencyRecords.Where(r => r.Id == recordId).ExecuteUpdateAsync(
            s => s.SetProperty(r => r.ResponseStatus, responseStatus).SetProperty(r => r.ResponseBody, responseBody),
            cancellationToken);

    public Task AbandonAsync(Guid recordId, CancellationToken cancellationToken = default) =>
        db.IdempotencyRecords.Where(r => r.Id == recordId).ExecuteDeleteAsync(cancellationToken);

    private Task<IdempotencyRecord?> FindAsync(string key, Guid userId, CancellationToken ct) =>
        db.IdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(r => r.Key == key && r.UserId == userId, ct);

    private static IdempotencyBeginResult Classify(IdempotencyRecord record, string requestHash)
    {
        if (record.RequestHash != requestHash)
        {
            return new IdempotencyBeginResult(IdempotencyState.Mismatch, record.Id, null, null);
        }

        return record.IsCompleted
            ? new IdempotencyBeginResult(IdempotencyState.Replay, record.Id, record.ResponseStatus, record.ResponseBody)
            : new IdempotencyBeginResult(IdempotencyState.InProgress, record.Id, null, null);
    }
}
