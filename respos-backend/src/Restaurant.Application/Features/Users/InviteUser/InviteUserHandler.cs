using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Email;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Options;
using Restaurant.Application.Common.Saas;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Application.Features.Users.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Users.InviteUser;

/// <summary>
/// Invites a user: new e-mail → User(status invited, no password); existing user of another org → reused.
/// Membership is inactive until the invitation is accepted (POST /auth/accept-invitation).
/// MVP: the invite link is returned to the admin because e-mail delivery is a stub.
/// </summary>
public sealed class InviteUserHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IClock clock,
    ISecureTokenGenerator tokens,
    IEmailSender email,
    IOptions<AuthOptions> authOptions,
    IOptions<FrontendOptions> frontendOptions,
    PlanLimitService planLimits,
    UserAssignmentService assignments,
    OrganizationProvisioner provisioner,
    IAuditLogger audit) : IHandler<InviteUserCommand, InvitationCreatedDto>
{
    public async Task<Result<InvitationCreatedDto>> HandleAsync(InviteUserCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var normalized = User.NormalizeEmail(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalized, cancellationToken);
        if (user is not null && await db.UserOrganizations.AnyAsync(uo => uo.UserId == user.Id, cancellationToken))
        {
            return UserErrors.EmailTaken;
        }

        var validation = await ValidateAsync(orgId, request, cancellationToken);
        if (validation.IsFailure)
        {
            return validation.Error;
        }

        if (user is null)
        {
            user = new User { FullName = request.FullName.Trim(), Status = UserStatus.Invited };
            user.SetEmail(normalized);
            db.Users.Add(user);
        }

        provisioner.AddMember(orgId, user, validation.Value, request.BranchIds, isActive: false);
        var rawToken = tokens.Generate();
        var invitation = new UserInvitation
        {
            OrganizationId = orgId,
            UserId = user.Id,
            Email = normalized,
            RoleIds = request.RoleIds.Distinct().ToArray(),
            BranchIds = request.BranchIds.Distinct().ToArray(),
            TokenHash = tokens.Hash(rawToken),
            ExpiresAt = clock.UtcNow.AddDays(authOptions.Value.InvitationDays),
        };
        db.UserInvitations.Add(invitation);

        audit.Log("user.invited", "user", user.Id, new { normalized, request.RoleIds, request.BranchIds });
        await db.SaveChangesAsync(cancellationToken);

        var link = $"{frontendOptions.Value.AppUrl.TrimEnd('/')}/accept-invitation?token={Uri.EscapeDataString(rawToken)}";
        await email.SendAsync(new EmailMessage(normalized, "Приглашение в RestaurantOS", $"Accept the invitation: {link}", true), cancellationToken);
        return new InvitationCreatedDto(invitation.Id, link);
    }

    private async Task<Result<IReadOnlyList<Role>>> ValidateAsync(Guid orgId, InviteUserCommand request, CancellationToken ct)
    {
        var limit = await planLimits.EnsureCanAddUserAsync(orgId, ct);
        if (limit.IsFailure)
        {
            return Result.Failure<IReadOnlyList<Role>>(limit.Error);
        }

        var roles = await assignments.ResolveRolesAsync(request.RoleIds, ct);
        if (roles.IsFailure)
        {
            return roles;
        }

        var branches = await assignments.ValidateBranchesAsync(request.BranchIds, ct);
        if (branches.IsFailure)
        {
            return Result.Failure<IReadOnlyList<Role>>(branches.Error);
        }

        var owner = await assignments.EnsureActorMayManageAsync(null, roles.Value.Any(r => r.Code == SystemRoles.Owner), ct);
        return owner.IsFailure ? Result.Failure<IReadOnlyList<Role>>(owner.Error) : roles;
    }
}
