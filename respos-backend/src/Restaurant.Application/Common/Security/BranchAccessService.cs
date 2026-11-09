using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Constants;

namespace Restaurant.Application.Common.Security;

/// <summary>
/// Branch access rules: owner/admin roles → every active branch of the org; others → UserBranchAccess rows.
/// Works with explicit ids (ignores tenant filters) so it can run before the tenant context is complete (hub, filters).
/// </summary>
/// A break-glass (read-only platform) session sees every active branch of its organization.
internal sealed class BranchAccessService(IApplicationDbContext db, ITenantContext tenant) : IBranchAccessService
{
    public async Task<bool> HasAccessAsync(Guid userId, Guid organizationId, Guid branchId, CancellationToken cancellationToken = default)
    {
        var branches = await GetAccessibleBranchesAsync(userId, organizationId, cancellationToken);
        return branches.Any(b => b.Id == branchId);
    }

    public async Task<IReadOnlyList<BranchSummary>> GetAccessibleBranchesAsync(
        Guid userId, Guid organizationId, CancellationToken cancellationToken = default)
    {
        var isBreakGlass = tenant.IsReadOnlyTenantAccess && tenant.UserId == userId && tenant.OrganizationId == organizationId;
        var isMember = isBreakGlass || await db.UserOrganizations.IgnoreQueryFilters()
            .AnyAsync(uo => uo.UserId == userId && uo.OrganizationId == organizationId && uo.IsActive, cancellationToken);
        if (!isMember)
        {
            return [];
        }

        var allBranchRoles = SystemRoles.AllBranchRoles.ToArray();
        var hasAllBranches = isBreakGlass || await db.UserRoles.IgnoreQueryFilters()
            .AnyAsync(ur => ur.UserId == userId
                            && ur.OrganizationId == organizationId
                            && allBranchRoles.Contains(ur.Role!.Code), cancellationToken);

        var query = db.Branches.IgnoreQueryFilters()
            .Where(b => b.OrganizationId == organizationId && b.IsActive);
        if (!hasAllBranches)
        {
            query = query.Where(b => db.UserBranchAccesses.IgnoreQueryFilters()
                .Any(a => a.UserId == userId && a.BranchId == b.Id && a.OrganizationId == organizationId));
        }

        return await query
            .OrderBy(b => b.CreatedAt).ThenBy(b => b.Name)
            .Select(b => new BranchSummary(b.Id, b.Name, b.Timezone))
            .ToListAsync(cancellationToken);
    }
}
