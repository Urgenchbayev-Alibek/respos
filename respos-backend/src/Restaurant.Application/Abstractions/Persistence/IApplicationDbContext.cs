namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>
/// Unit of work + DbSets. Split into one partial file per module (IApplicationDbContext.{Module}.cs);
/// add your module's DbSets in your own file — never edit another module's file.
/// </summary>
/// <remarks>
/// <see cref="SaveChangesAsync"/> dispatches domain events (handlers run inside the same transaction, before commit),
/// stamps audit fields / tenant ids, commits, and then flushes queued realtime notifications.
/// Domain event handlers must NOT call SaveChangesAsync themselves.
/// </remarks>
public partial interface IApplicationDbContext
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs <paramref name="operation"/> in an explicit database transaction (for flows that need several
    /// SaveChanges calls). Realtime notifications are flushed after the commit.
    /// </summary>
    Task<T> ExecuteInTransactionAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken = default);
}
