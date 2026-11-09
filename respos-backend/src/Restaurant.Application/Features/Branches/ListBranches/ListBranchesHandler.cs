using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Branches.ListBranches;

public sealed record ListBranchesQuery;

/// <summary>All branches of the current organization (tenant filter), oldest first.</summary>
public sealed class ListBranchesHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListBranchesQuery, IReadOnlyList<BranchDto>>
{
    public async Task<Result<IReadOnlyList<BranchDto>>> HandleAsync(ListBranchesQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var branches = await db.Branches.AsNoTracking()
            .OrderBy(b => b.CreatedAt).ThenBy(b => b.Name)
            .Select(b => new BranchDto(b.Id, b.Name, b.Address, b.Phone, b.Timezone, b.IsActive))
            .ToListAsync(cancellationToken);
        return branches;
    }
}
