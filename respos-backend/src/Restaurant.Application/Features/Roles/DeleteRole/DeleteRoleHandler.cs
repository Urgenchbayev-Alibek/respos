using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Roles.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Roles.DeleteRole;

public sealed record DeleteRoleCommand(Guid Id);

/// <summary>Deletes a custom role without users (system → 422 roles.system_protected, assigned → 422 roles.in_use).</summary>
public sealed class DeleteRoleHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<DeleteRoleCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(DeleteRoleCommand request, CancellationToken cancellationToken)
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

        if (await db.UserRoles.AnyAsync(ur => ur.RoleId == role.Id, cancellationToken))
        {
            return RoleErrors.InUse;
        }

        role.Permissions.Clear();
        db.Roles.Remove(role);
        audit.Log("role.deleted", "role", role.Id, new { role.Code, role.Name });
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
