using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Roles.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Roles.UpdateRole;

/// <summary>Renames a custom role and replaces its permissions. System roles are protected.</summary>
public sealed class UpdateRoleHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<UpdateRoleCommand, RoleDto>
{
    public async Task<Result<RoleDto>> HandleAsync(UpdateRoleCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var role = await db.Roles.Include(r => r.Permissions).FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        if (role is null)
        {
            return RoleErrors.NotFound;
        }

        if (role.IsSystem)
        {
            return RoleErrors.SystemProtected;
        }

        var invalid = RoleRules.InvalidPermissions(request.Permissions);
        if (invalid.Count > 0)
        {
            return RoleErrors.InvalidPermissions(invalid);
        }

        var name = request.Name.Trim();
        if (await db.Roles.AnyAsync(r => r.Id != role.Id && r.Name == name, cancellationToken))
        {
            return RoleErrors.NameTaken;
        }

        var before = role.Permissions.Select(p => p.PermissionCode).ToList();
        role.Name = name;
        role.SetPermissions(request.Permissions);
        audit.Log("role.updated", "role", role.Id, new { role.Name, before, after = request.Permissions });
        await db.SaveChangesAsync(cancellationToken);

        var userCount = await db.UserRoles.CountAsync(ur => ur.RoleId == role.Id, cancellationToken);
        var permissions = role.Permissions.Select(p => p.PermissionCode).Order(StringComparer.Ordinal).ToList();
        return new RoleDto(role.Id, role.Code, role.Name, role.IsSystem, permissions, userCount);
    }
}
