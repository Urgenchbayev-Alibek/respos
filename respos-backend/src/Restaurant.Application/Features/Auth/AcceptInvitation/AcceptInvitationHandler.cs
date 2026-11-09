using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Auth.AcceptInvitation;

public sealed record AcceptInvitationCommand(string Token, string FullName, string Password);

public sealed class AcceptInvitationValidator : AbstractValidator<AcceptInvitationCommand>
{
    public AcceptInvitationValidator()
    {
        RuleFor(x => x.Token).NotEmpty().MaximumLength(256);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Password).StrongPassword();
    }
}

/// <summary>
/// Accepts an invitation: a new (Invited) user sets name + password; an existing user confirms with their
/// current password. Activates the membership and signs the user in to the inviting organization.
/// </summary>
public sealed class AcceptInvitationHandler(
    IApplicationDbContext db,
    ISecureTokenGenerator tokenGenerator,
    IPasswordHasher hasher,
    SessionIssuer sessions,
    IAuditLogger audit,
    IClock clock) : IHandler<AcceptInvitationCommand, AuthSession>
{
    public async Task<Result<AuthSession>> HandleAsync(AcceptInvitationCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var hash = tokenGenerator.Hash(request.Token);
        var invitation = await db.UserInvitations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.TokenHash == hash, cancellationToken);
        if (invitation is null || invitation.AcceptedAt is not null)
        {
            return AuthErrors.InvalidToken;
        }

        if (!invitation.IsUsable(now))
        {
            return AuthErrors.TokenExpired;
        }

        var user = await db.Users.FirstAsync(u => u.Id == invitation.UserId, cancellationToken);
        var credentials = ApplyCredentials(user, request);
        if (credentials.IsFailure)
        {
            return credentials.Error;
        }

        var membership = await db.UserOrganizations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(uo => uo.UserId == user.Id && uo.OrganizationId == invitation.OrganizationId, cancellationToken);
        if (membership is null)
        {
            return AuthErrors.InvalidToken;
        }

        membership.IsActive = true;
        membership.JoinedAt = now;
        invitation.AcceptedAt = now;
        user.RegisterSuccessfulLogin(now);
        var session = await sessions.IssueAsync(user, invitation.OrganizationId, null, cancellationToken);
        audit.Log(new AuditEntry("user.invitation_accepted", nameof(UserInvitation), invitation.Id.ToString())
        {
            OrganizationId = invitation.OrganizationId,
            UserId = user.Id,
        });
        await db.SaveChangesAsync(cancellationToken);
        return session;
    }

    private Result ApplyCredentials(User user, AcceptInvitationCommand request)
    {
        if (user.Status == UserStatus.Invited || user.PasswordHash is null)
        {
            user.FullName = request.FullName.Trim();
            user.PasswordHash = hasher.Hash(request.Password);
            user.Status = UserStatus.Active;
            return Result.Success();
        }

        if (user.Status != UserStatus.Active || !hasher.Verify(user.PasswordHash, request.Password))
        {
            return Result.Failure(AuthErrors.InvalidCredentials);
        }

        return Result.Success();
    }
}
