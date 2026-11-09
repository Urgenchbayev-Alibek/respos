using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;

namespace Restaurant.Application.Features.Orders.Common;

/// <summary>Resolves user display names for DTOs (waiter, cashier, history authors) in one query.</summary>
[ScopedService]
public sealed class UserNameLookup(IApplicationDbContext db)
{
    public async Task<IReadOnlyDictionary<Guid, string>> GetAsync(IEnumerable<Guid?> userIds, CancellationToken ct)
    {
        var ids = userIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        return await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName })
            .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
    }
}
