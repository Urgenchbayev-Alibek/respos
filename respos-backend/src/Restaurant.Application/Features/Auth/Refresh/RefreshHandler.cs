using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Application.Features.Staff.Pin;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Auth.Refresh;

/// <param name="RefreshToken">Raw token from the httpOnly cookie.</param>
public sealed record RefreshCommand(string? RefreshToken)
{
    /// <summary>Raw shared-device credential (cookie <c>device_token</c>); required to refresh PIN sessions (ADR-0014).</summary>
    public string? DeviceToken { get; init; }
}

/// <summary>
/// Rotates the refresh token. Presenting an already revoked token = reuse → the whole family is revoked (audited),
/// except inside the grace window (<see cref="AuthOptions.RefreshReuseGraceSeconds"/>, ADR-0003): a token rotated
/// moments ago whose successor is still active is a benign race (two tabs / a retry) → the current chain tip is
/// rotated instead. Rotation is atomic (conditional UPDATE … WHERE revoked_at IS NULL), so two simultaneous
/// refreshes of one token never fork the family. The session is refused when the user or membership is inactive.
/// </summary>
public sealed class RefreshHandler(
    IApplicationDbContext db,
    SessionIssuer sessions,
    PinSessionGuard pinSessions,
    IAuditLogger audit,
    IClock clock,
    IOptions<AuthOptions> options) : IHandler<RefreshCommand, AuthSession>
{
    /// <summary>
    /// Bound on loop steps per request: each lost rotation race costs two (re-read + hop to the successor), so this
    /// tolerates ~8 tabs refreshing the same cookie at once; beyond that → 401 (without revoking the family).
    /// </summary>
    private const int MaxSteps = 16;

    public async Task<Result<AuthSession>> HandleAsync(RefreshCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var token = await sessions.FindRefreshTokenAsync(request.RefreshToken, cancellationToken);
        if (token is null)
        {
            return AuthErrors.InvalidRefreshToken;
        }

        for (var step = 0; step < MaxSteps; step++)
        {
            if (token.IsRevoked)
            {
                var successor = await FindGraceSuccessorAsync(token, now, cancellationToken);
                if (successor is null)
                {
                    return await RevokeFamilyAsync(token, cancellationToken);
                }

                token = successor;
                continue;
            }

            if (!token.IsActive(now))
            {
                return AuthErrors.SessionExpired;
            }

            var user = await db.Users.FirstAsync(u => u.Id == token.UserId, cancellationToken);
            if (user.Status != UserStatus.Active || !await IsSessionOrganizationValidAsync(user, token, cancellationToken))
            {
                await RevokeIfActiveAsync(token.Id, null, now, cancellationToken);
                return AuthErrors.InvalidRefreshToken;
            }

            // PIN session (ADR-0014): same active device + still eligible, keeps its branch scope and absolute expiry.
            var scope = await pinSessions.ResolveScopeAsync(token, user, request.DeviceToken, now, cancellationToken);
            if (scope.IsFailure)
            {
                await RevokeIfActiveAsync(token.Id, null, now, cancellationToken);
                return AuthErrors.InvalidRefreshToken;
            }

            var session = await TryRotateAsync(user, token, scope.Value, now, cancellationToken);
            if (session is not null)
            {
                return session;
            }

            // Lost the race: a concurrent request rotated this token first → re-read it (now revoked, with a successor).
            token = await db.RefreshTokens.AsNoTracking().FirstAsync(t => t.Id == token.Id, cancellationToken);
        }

        return AuthErrors.InvalidRefreshToken;
    }

    /// <summary>
    /// Issues the replacement and claims <paramref name="token"/> in one transaction. The conditional UPDATE takes the
    /// row lock; a concurrent claimer blocks, then matches 0 rows → returns null (the caller follows the successor).
    /// </summary>
    private Task<AuthSession?> TryRotateAsync(
        User user, RefreshToken token, SessionScope? scope, DateTime now, CancellationToken cancellationToken) =>
        db.ExecuteInTransactionAsync<AuthSession?>(async ct =>
        {
            var (session, replacement) = await sessions.IssueWithTokenAsync(user, token.OrganizationId, token.FamilyId, ct, scope);
            if (await RevokeIfActiveAsync(token.Id, replacement.Id, now, ct) == 0)
            {
                db.RefreshTokens.Remove(replacement); // Added → Detached: nothing is inserted
                return null;
            }

            await db.SaveChangesAsync(ct);
            return session;
        }, cancellationToken);

    private Task<int> RevokeIfActiveAsync(Guid tokenId, Guid? replacedBy, DateTime now, CancellationToken ct) =>
        db.RefreshTokens
            .Where(t => t.Id == tokenId && t.RevokedAt == null && t.ReplacedByTokenId == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.RevokedAt, now)
                .SetProperty(t => t.ReplacedByTokenId, replacedBy), ct);

    /// <summary>The successor of a token rotated less than the grace window ago, or null (→ treat as reuse).</summary>
    private async Task<RefreshToken?> FindGraceSuccessorAsync(RefreshToken token, DateTime now, CancellationToken ct)
    {
        var grace = TimeSpan.FromSeconds(Math.Max(0, options.Value.RefreshReuseGraceSeconds));
        if (token.ReplacedByTokenId is not { } successorId || token.RevokedAt is not { } rotatedAt || rotatedAt <= now - grace)
        {
            return null;
        }

        var successor = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.Id == successorId, ct);
        return successor is not null && successor.FamilyId == token.FamilyId && successor.UserId == token.UserId
            ? successor
            : null;
    }

    private async Task<Result<AuthSession>> RevokeFamilyAsync(RefreshToken token, CancellationToken ct)
    {
        await sessions.RevokeFamilyAsync(token.FamilyId, ct);
        audit.Log(new AuditEntry("auth.refresh_token_reused", nameof(RefreshToken), token.FamilyId.ToString())
        {
            OrganizationId = token.OrganizationId,
            UserId = token.UserId,
        });
        await db.SaveChangesAsync(ct);
        return AuthErrors.RefreshTokenReused;
    }

    private async Task<bool> IsSessionOrganizationValidAsync(User user, RefreshToken token, CancellationToken ct) =>
        token.OrganizationId is not { } orgId
        || (await sessions.ResolveOrganizationAsync(user, orgId, ct)).IsSuccess;
}
