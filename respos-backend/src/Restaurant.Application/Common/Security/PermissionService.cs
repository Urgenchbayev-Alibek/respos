using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Common.Security;

/// <summary>
/// Loads effective permissions from the DB (never from the token) and caches them for the request scope.
/// Inactive users, inactive memberships and non-active organizations yield no org permissions.
/// Platform admins additionally get all platform.* permissions.
/// </summary>
internal sealed class PermissionService(IApplicationDbContext db, ITenantContext tenant) : IPermissionService
{
    private static readonly IReadOnlySet<string> Empty = new HashSet<string>();
    private readonly Dictionary<(Guid UserId, Guid? OrgId), IReadOnlySet<string>> _cache = [];

    public async Task<IReadOnlySet<string>> GetPermissionsAsync(Guid userId, Guid? organizationId, CancellationToken cancellationToken = default)
    {
        if (_cache.TryGetValue((userId, organizationId), out var cached))
        {
            return cached;
        }

        var result = await LoadAsync(userId, organizationId, cancellationToken);
        _cache[(userId, organizationId)] = result;
        return result;
    }

    public async Task<IReadOnlyList<string>> GetRoleCodesAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default) =>
        await db.UserRoles.IgnoreQueryFilters()
            .Where(ur => ur.UserId == userId && ur.OrganizationId == organizationId)
            .Select(ur => ur.Role!.Code)
            .ToListAsync(cancellationToken);

    public async Task<bool> CurrentUserHasAsync(string permission, CancellationToken cancellationToken = default)
    {
        if (tenant.UserId is not { } userId)
        {
            return false;
        }

        var permissions = await GetPermissionsAsync(userId, tenant.OrganizationId, cancellationToken);
        return permissions.Contains(permission);
    }

    private async Task<IReadOnlySet<string>> LoadAsync(Guid userId, Guid? organizationId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Status, u.IsPlatformAdmin })
            .FirstOrDefaultAsync(ct);
        if (user is null || user.Status != UserStatus.Active)
        {
            return Empty;
        }

        var result = new HashSet<string>(StringComparer.Ordinal);
        if (user.IsPlatformAdmin)
        {
            result.UnionWith(PermissionCatalog.PlatformCodes);
        }

        if (organizationId is { } orgId && await IsActiveMemberAsync(userId, orgId, ct))
        {
            var codes = await db.UserRoles.IgnoreQueryFilters()
                .Where(ur => ur.UserId == userId && ur.OrganizationId == orgId)
                .SelectMany(ur => ur.Role!.Permissions.Select(p => p.PermissionCode))
                .Distinct()
                .ToListAsync(ct);
            result.UnionWith(codes.Where(PermissionCatalog.IsAssignableToRole));
        }

        return result;
    }

    private Task<bool> IsActiveMemberAsync(Guid userId, Guid orgId, CancellationToken ct) =>
        db.UserOrganizations.IgnoreQueryFilters().AnyAsync(
            uo => uo.UserId == userId
                  && uo.OrganizationId == orgId
                  && uo.IsActive
                  && uo.Organization!.Status == OrganizationStatus.Active,
            ct);
}
