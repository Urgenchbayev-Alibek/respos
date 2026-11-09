using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Users.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Users.UpdateUser;

/// <summary>Updates profile fields and replaces roles/branches (owner protection + last-owner guard).</summary>
public sealed class UpdateUserHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    UserAssignmentService assignments,
    UserReadService reader,
    IAuditLogger audit) : IHandler<UpdateUserCommand, UserDto>
{
    public async Task<Result<UserDto>> HandleAsync(UpdateUserCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var isMember = await db.UserOrganizations.AnyAsync(uo => uo.UserId == request.Id, cancellationToken);
        var user = isMember ? await db.Users.FirstOrDefaultAsync(u => u.Id == request.Id, cancellationToken) : null;
        if (user is null)
        {
            return UserErrors.NotFound;
        }

        var roles = await assignments.ResolveRolesAsync(request.RoleIds, cancellationToken);
        if (roles.IsFailure)
        {
            return roles.Error;
        }

        var guard = await GuardAsync(request, roles.Value, cancellationToken);
        if (guard.IsFailure)
        {
            return guard.Error;
        }

        user.FullName = request.FullName.Trim();
        user.Phone = request.Phone;
        await assignments.ReplaceAssignmentsAsync(user.Id, roles.Value, request.BranchIds, cancellationToken);

        audit.Log("user.updated", "user", user.Id, new { user.FullName, request.RoleIds, request.BranchIds });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(user.Id, cancellationToken))!;
    }

    private async Task<Result> GuardAsync(UpdateUserCommand request, IReadOnlyList<Role> roles, CancellationToken ct)
    {
        var branches = await assignments.ValidateBranchesAsync(request.BranchIds, ct);
        if (branches.IsFailure)
        {
            return branches;
        }

        var keepsOwner = roles.Any(r => r.Code == SystemRoles.Owner);
        var manage = await assignments.EnsureActorMayManageAsync(request.Id, keepsOwner, ct);
        if (manage.IsFailure)
        {
            return manage;
        }

        return keepsOwner ? Result.Success() : await assignments.EnsureNotLastOwnerAsync(request.Id, ct);
    }
}
