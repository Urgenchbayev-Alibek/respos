using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Saas;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Application.Features.Users.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Users.CreateUser;

/// <summary>
/// Creates an active user in the current org. MVP: an e-mail that already exists anywhere (even in another org)
/// → 409 users.email_taken; use an invitation to add an existing user to another organization.
/// </summary>
public sealed class CreateUserHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IPasswordHasher hasher,
    PlanLimitService planLimits,
    UserAssignmentService assignments,
    OrganizationProvisioner provisioner,
    UserReadService reader,
    IAuditLogger audit) : IHandler<CreateUserCommand, UserDto>
{
    public async Task<Result<UserDto>> HandleAsync(CreateUserCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var email = User.NormalizeEmail(request.Email);
        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            return UserErrors.EmailTaken;
        }

        var limit = await planLimits.EnsureCanAddUserAsync(orgId, cancellationToken);
        if (limit.IsFailure)
        {
            return limit.Error;
        }

        var roles = await assignments.ResolveRolesAsync(request.RoleIds, cancellationToken);
        if (roles.IsFailure)
        {
            return roles.Error;
        }

        var check = await Checks(request, roles.Value, cancellationToken);
        if (check.IsFailure)
        {
            return check.Error;
        }

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Phone = request.Phone,
            Status = UserStatus.Active,
            PasswordHash = hasher.Hash(request.Password),
        };
        user.SetEmail(email);
        db.Users.Add(user);
        provisioner.AddMember(orgId, user, roles.Value, request.BranchIds);

        audit.Log("user.created", "user", user.Id, new { user.Email, user.FullName, request.RoleIds, request.BranchIds });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(user.Id, cancellationToken))!;
    }

    private async Task<Result> Checks(CreateUserCommand request, IReadOnlyList<Role> roles, CancellationToken ct)
    {
        var branches = await assignments.ValidateBranchesAsync(request.BranchIds, ct);
        if (branches.IsFailure)
        {
            return branches;
        }

        return await assignments.EnsureActorMayManageAsync(null, roles.Any(r => r.Code == SystemRoles.Owner), ct);
    }
}
