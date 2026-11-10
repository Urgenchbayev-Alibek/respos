namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Transaction-scoped database lock (PostgreSQL advisory lock); call inside <c>ExecuteInTransactionAsync</c>.</summary>
public interface IAdvisoryLock
{
    /// <summary>Blocks until the lock for (<paramref name="scope"/>, <paramref name="id"/>) is held; released at commit/rollback.</summary>
    Task AcquireAsync(string scope, Guid id, CancellationToken cancellationToken);
}
