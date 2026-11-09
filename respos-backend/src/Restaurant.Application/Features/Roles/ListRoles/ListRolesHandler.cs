using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Roles.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Roles.ListRoles;

public sealed record ListRolesQuery;

public sealed class ListRolesHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListRolesQuery, IReadOnlyList<RoleDto>>
{
    public async Task<Result<IReadOnlyList<RoleDto>>> HandleAsync(ListRolesQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var rows = await db.Roles.AsNoTracking()
            .OrderByDescending(r => r.IsSystem).ThenBy(r => r.Name)
            .Select(r => new
            {
                r.Id,
                r.Code,
                r.Name,
                r.IsSystem,
                Permissions = r.Permissions.Select(p => p.PermissionCode).ToList(),
                UserCount = r.UserRoles.Count,
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new RoleDto(r.Id, r.Code, r.Name, r.IsSystem, r.Permissions.Order(StringComparer.Ordinal).ToList(), r.UserCount))
            .ToList();
    }
}

public sealed record ListPermissionsQuery;

/// <summary>Assignable (non-platform) permissions from the catalog.</summary>
public sealed class ListPermissionsHandler : IHandler<ListPermissionsQuery, IReadOnlyList<PermissionDto>>
{
    public Task<Result<IReadOnlyList<PermissionDto>>> HandleAsync(ListPermissionsQuery request, CancellationToken cancellationToken)
    {
        IReadOnlyList<PermissionDto> list = Domain.Constants.PermissionCatalog.All
            .Where(p => !Domain.Constants.Permissions.IsPlatform(p.Code))
            .Select(p => new PermissionDto(p.Code, p.Module, p.Description))
            .ToList();
        return Task.FromResult(Result.Success(list));
    }
}
