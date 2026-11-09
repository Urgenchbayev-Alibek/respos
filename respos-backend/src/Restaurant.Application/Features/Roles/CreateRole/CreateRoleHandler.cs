using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Roles.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Roles.CreateRole;

/// <summary>Creates a custom role; code = "custom_" + 8 hex chars.</summary>
public sealed class CreateRoleHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<CreateRoleCommand, RoleDto>
{
    public async Task<Result<RoleDto>> HandleAsync(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var invalid = RoleRules.InvalidPermissions(request.Permissions);
        if (invalid.Count > 0)
        {
            return RoleErrors.InvalidPermissions(invalid);
        }

        var name = request.Name.Trim();
        if (await db.Roles.AnyAsync(r => r.Name == name, cancellationToken))
        {
            return RoleErrors.NameTaken;
        }

        var role = new Role { OrganizationId = orgId, Name = name, Code = "custom_" + Guid.NewGuid().ToString("N")[..8] };
        role.SetPermissions(request.Permissions);
        db.Roles.Add(role);
        audit.Log("role.created", "role", role.Id, new { role.Code, role.Name, request.Permissions });
        await db.SaveChangesAsync(cancellationToken);

        var permissions = role.Permissions.Select(p => p.PermissionCode).Order(StringComparer.Ordinal).ToList();
        return new RoleDto(role.Id, role.Code, role.Name, role.IsSystem, permissions, 0);
    }
}
