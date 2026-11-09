using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Auth.Common;

/// <summary>
/// Builds <see cref="MeDto"/> with explicit ids (works before the tenant context is set, e.g. during login).
/// Also lists the user's active organizations for login org selection.
/// </summary>
[ScopedService]
public sealed class MeBuilder(IApplicationDbContext db, IPermissionService permissions, IBranchAccessService branchAccess)
{
    public async Task<IReadOnlyList<OrganizationRefDto>> GetActiveOrganizationsAsync(Guid userId, CancellationToken ct) =>
        await db.UserOrganizations.IgnoreQueryFilters()
            .Where(uo => uo.UserId == userId && uo.IsActive && uo.Organization!.Status == OrganizationStatus.Active)
            .OrderBy(uo => uo.JoinedAt)
            .Select(uo => new OrganizationRefDto(uo.OrganizationId, uo.Organization!.Name))
            .ToListAsync(ct);

    public async Task<MeDto> BuildAsync(Guid userId, Guid? organizationId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        var organizations = await GetActiveOrganizationsAsync(userId, ct);
        var effective = await permissions.GetPermissionsAsync(userId, organizationId, ct);

        CurrentOrganizationDto? current = null;
        IReadOnlyList<string> roles = [];
        IReadOnlyList<MeBranchDto> branches = [];
        if (organizationId is { } orgId)
        {
            current = await db.Organizations.AsNoTracking()
                .Where(o => o.Id == orgId)
                .Select(o => new CurrentOrganizationDto(o.Id, o.Name, o.Currency, o.DefaultLanguage))
                .FirstOrDefaultAsync(ct);
            roles = await permissions.GetRoleCodesAsync(userId, orgId, ct);
            branches = (await branchAccess.GetAccessibleBranchesAsync(userId, orgId, ct))
                .Select(b => new MeBranchDto(b.Id, b.Name, b.Timezone))
                .ToList();
        }

        return new MeDto(
            user.Id,
            user.Email,
            user.FullName,
            user.PreferredLanguage,
            user.IsPlatformAdmin,
            current,
            organizations,
            roles,
            effective.Order(StringComparer.Ordinal).ToList(),
            branches);
    }
}
