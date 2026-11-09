using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Auth.Refresh;

/// <param name="RefreshToken">Raw token from the httpOnly cookie.</param>
public sealed record RefreshCommand(string? RefreshToken);

/// <summary>
/// Rotates the refresh token. Presenting an already revoked token = reuse → the whole family is revoked (audited).
/// The session is refused when the user or the membership is no longer active.
/// </summary>
public sealed class RefreshHandler(
    IApplicationDbContext db,
    SessionIssuer sessions,
    IAuditLogger audit,
    IClock clock) : IHandler<RefreshCommand, AuthSession>
{
    public async Task<Result<AuthSession>> HandleAsync(RefreshCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var token = await sessions.FindRefreshTokenAsync(request.RefreshToken, cancellationToken);
        if (token is null)
        {
            return AuthErrors.InvalidRefreshToken;
        }

        if (token.IsRevoked)
        {
            await sessions.RevokeFamilyAsync(token.FamilyId, cancellationToken);
            audit.Log(new AuditEntry("auth.refresh_token_reused", nameof(RefreshToken), token.FamilyId.ToString())
            {
                OrganizationId = token.OrganizationId,
                UserId = token.UserId,
            });
            await db.SaveChangesAsync(cancellationToken);
            return AuthErrors.RefreshTokenReused;
        }

        if (!token.IsActive(now))
        {
            return AuthErrors.SessionExpired;
        }

        var user = await db.Users.FirstAsync(u => u.Id == token.UserId, cancellationToken);
        if (user.Status != UserStatus.Active || !await IsSessionOrganizationValidAsync(user, token, cancellationToken))
        {
            token.Revoke(now);
            await db.SaveChangesAsync(cancellationToken);
            return AuthErrors.InvalidRefreshToken;
        }

        var (session, replacement) = await sessions.IssueWithTokenAsync(user, token.OrganizationId, token.FamilyId, cancellationToken);
        token.Revoke(now, replacement.Id);
        await db.SaveChangesAsync(cancellationToken);
        return session;
    }

    private async Task<bool> IsSessionOrganizationValidAsync(User user, RefreshToken token, CancellationToken ct) =>
        token.OrganizationId is not { } orgId
        || (await sessions.ResolveOrganizationAsync(user, orgId, ct)).IsSuccess;
}
