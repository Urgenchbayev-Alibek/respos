using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Auth.Common;

/// <summary>
/// Issues access + refresh tokens (refresh stored as SHA-256 hash, grouped in a rotation family),
/// resolves which organization a session belongs to, and revokes token families.
/// Adds rows to the context; callers save.
/// </summary>
[ScopedService]
public sealed class SessionIssuer(
    IApplicationDbContext db,
    ITokenService tokens,
    ISecureTokenGenerator tokenGenerator,
    MeBuilder meBuilder,
    IRequestInfo request,
    IClock clock,
    IOptions<AuthOptions> options)
{
    public async Task<AuthSession> IssueAsync(User user, Guid? organizationId, Guid? familyId, CancellationToken ct)
    {
        var (session, _) = await IssueWithTokenAsync(user, organizationId, familyId, ct);
        return session;
    }

    /// <param name="scope">PIN quick-login restriction (branch claim, shorter refresh lifetime); null for password sessions.</param>
    public async Task<(AuthSession Session, RefreshToken Token)> IssueWithTokenAsync(
        User user, Guid? organizationId, Guid? familyId, CancellationToken ct, SessionScope? scope = null)
    {
        var now = clock.UtcNow;
        var raw = tokenGenerator.Generate();
        var refresh = new RefreshToken
        {
            UserId = user.Id,
            OrganizationId = organizationId,
            TokenHash = tokenGenerator.Hash(raw),
            FamilyId = familyId ?? Guid.NewGuid(),
            CreatedAt = now,
            ExpiresAt = scope is null ? now.AddDays(options.Value.RefreshTokenDays) : now.Add(scope.RefreshLifetime),
            CreatedByIp = request.IpAddress,
        };
        db.RefreshTokens.Add(refresh);

        var access = tokens.CreateAccessToken(user, organizationId, scope?.BranchId);
        var me = await meBuilder.BuildAsync(user.Id, organizationId, ct, scope?.BranchId);
        var session = new AuthSession(new AuthResponse(access.Token, access.ExpiresAt, me), raw, refresh.ExpiresAt);
        return (session, refresh);
    }

    /// <summary>
    /// Picks the session organization: the requested one (must be an active membership) or the first active one.
    /// Platform admins without memberships get an org-less session.
    /// </summary>
    public async Task<Result<Guid?>> ResolveOrganizationAsync(User user, Guid? requested, CancellationToken ct)
    {
        var organizations = await meBuilder.GetActiveOrganizationsAsync(user.Id, ct);
        if (requested is { } wanted)
        {
            if (organizations.Any(o => o.Id == wanted))
            {
                return Result.Success<Guid?>(wanted);
            }

            return await HasInactiveOrganizationAsync(user.Id, wanted, ct)
                ? Result.Failure<Guid?>(AuthErrors.OrganizationSuspended)
                : Result.Failure<Guid?>(AuthErrors.OrganizationForbidden);
        }

        if (organizations.Count > 0)
        {
            return Result.Success<Guid?>(organizations[0].Id);
        }

        if (user.IsPlatformAdmin)
        {
            return Result.Success<Guid?>(null);
        }

        return await HasInactiveOrganizationAsync(user.Id, null, ct)
            ? Result.Failure<Guid?>(AuthErrors.OrganizationSuspended)
            : Result.Failure<Guid?>(AuthErrors.NoOrganization);
    }

    /// <summary>Active membership in an organization that is suspended/closed (optionally a specific one).</summary>
    private Task<bool> HasInactiveOrganizationAsync(Guid userId, Guid? organizationId, CancellationToken ct) =>
        db.UserOrganizations.IgnoreQueryFilters().AnyAsync(
            uo => uo.UserId == userId
                  && uo.IsActive
                  && (organizationId == null || uo.OrganizationId == organizationId)
                  && uo.Organization!.Status != OrganizationStatus.Active,
            ct);

    public Task<RefreshToken?> FindRefreshTokenAsync(string? rawToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
        {
            return Task.FromResult<RefreshToken?>(null);
        }

        var hash = tokenGenerator.Hash(rawToken);
        return db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
    }

    public Task RevokeFamilyAsync(Guid familyId, CancellationToken ct)
    {
        var now = clock.UtcNow;
        return db.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }

    /// <summary>Revokes all active refresh tokens of the user except (optionally) one family.</summary>
    public Task RevokeAllForUserAsync(Guid userId, Guid? exceptFamilyId, CancellationToken ct)
    {
        var now = clock.UtcNow;
        return db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null && t.FamilyId != exceptFamilyId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }
}
