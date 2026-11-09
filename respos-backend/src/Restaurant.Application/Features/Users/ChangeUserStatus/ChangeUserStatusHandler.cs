using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Users.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Users.ChangeUserStatus;

public enum UserStatusAction { Block, Unblock, Deactivate }

public sealed record ChangeUserStatusCommand(Guid Id, UserStatusAction Action);

/// <summary>
/// Block / unblock / deactivate. Self and last-owner are protected; block/deactivate revoke refresh tokens.
/// Known MVP limitation: <see cref="User.Status"/> is global, so blocking affects the user's other organizations too;
/// deactivate additionally disables the membership of the current organization.
/// </summary>
public sealed class ChangeUserStatusHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    UserAssignmentService assignments,
    UserReadService reader,
    IAuditLogger audit) : IHandler<ChangeUserStatusCommand, UserDto>
{
    public async Task<Result<UserDto>> HandleAsync(ChangeUserStatusCommand request, CancellationToken cancellationToken)
    {
        var actorId = tenant.RequireUserId();
        var membership = await db.UserOrganizations.FirstOrDefaultAsync(uo => uo.UserId == request.Id, cancellationToken);
        var user = membership is null ? null : await db.Users.FirstOrDefaultAsync(u => u.Id == request.Id, cancellationToken);
        if (membership is null || user is null)
        {
            return UserErrors.NotFound;
        }

        var guard = await GuardAsync(request, actorId, cancellationToken);
        if (guard.IsFailure)
        {
            return guard.Error;
        }

        await ApplyAsync(request.Action, user, membership, cancellationToken);
        audit.Log($"user.{ActionName(request.Action)}", "user", user.Id);
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(user.Id, cancellationToken))!;
    }

    private async Task<Result> GuardAsync(ChangeUserStatusCommand request, Guid actorId, CancellationToken ct)
    {
        var disabling = request.Action != UserStatusAction.Unblock;
        if (disabling && request.Id == actorId)
        {
            return UserErrors.CannotModifySelf;
        }

        var manage = await assignments.EnsureActorMayManageAsync(request.Id, false, ct);
        if (manage.IsFailure || !disabling)
        {
            return manage;
        }

        return await assignments.EnsureNotLastOwnerAsync(request.Id, ct);
    }

    private async Task ApplyAsync(UserStatusAction action, User user, UserOrganization membership, CancellationToken ct)
    {
        switch (action)
        {
            case UserStatusAction.Block:
                user.Status = UserStatus.Blocked;
                await assignments.RevokeSessionsAsync(user.Id, ct);
                break;
            case UserStatusAction.Deactivate:
                user.Status = UserStatus.Deactivated;
                membership.IsActive = false;
                await assignments.RevokeSessionsAsync(user.Id, ct);
                break;
            case UserStatusAction.Unblock:
                user.Status = user.PasswordHash is null ? UserStatus.Invited : UserStatus.Active;
                membership.IsActive = user.Status == UserStatus.Active || membership.IsActive;
                user.ResetLockout();
                break;
        }
    }

    private static string ActionName(UserStatusAction action) => action switch
    {
        UserStatusAction.Block => "blocked",
        UserStatusAction.Unblock => "unblocked",
        _ => "deactivated",
    };
}
