using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Public.ListPublicPlans;

public sealed record ListPublicPlansQuery;

public sealed record PublicPlanDto(string Code, string Name, int MaxBranches, int MaxUsers, IReadOnlyList<string> Features);

/// <summary>Active plans with their feature codes (informational, anonymous).</summary>
public sealed class ListPublicPlansHandler(IApplicationDbContext db) : IHandler<ListPublicPlansQuery, IReadOnlyList<PublicPlanDto>>
{
    public async Task<Result<IReadOnlyList<PublicPlanDto>>> HandleAsync(ListPublicPlansQuery request, CancellationToken cancellationToken)
    {
        var plans = await db.Plans.AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.MaxBranches).ThenBy(p => p.Code)
            .Select(p => new PublicPlanDto(
                p.Code, p.Name, p.MaxBranches, p.MaxUsers, p.Features.Select(f => f.FeatureCode).OrderBy(c => c).ToList()))
            .ToListAsync(cancellationToken);
        return plans;
    }
}
