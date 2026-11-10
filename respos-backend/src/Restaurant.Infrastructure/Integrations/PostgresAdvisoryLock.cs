using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Integrations;

/// <summary><c>pg_advisory_xact_lock(scopeHash, idHash)</c> — released automatically at commit/rollback.</summary>
internal sealed class PostgresAdvisoryLock(AppDbContext db) : IAdvisoryLock
{
    public async Task AcquireAsync(string scope, Guid id, CancellationToken cancellationToken)
    {
        if (db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Advisory locks must be acquired inside a transaction.");
        }

        var scopeKey = StableHash(scope);
        var idKey = StableHash(id.ToString("N"));
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({scopeKey}, {idKey})", cancellationToken);
    }

    /// <summary>FNV-1a 32-bit — stable across processes (string.GetHashCode is randomized per process).</summary>
    private static int StableHash(string value)
    {
        unchecked
        {
            var hash = (int)2166136261;
            foreach (var c in value)
            {
                hash = (hash ^ c) * 16777619;
            }

            return hash;
        }
    }
}
