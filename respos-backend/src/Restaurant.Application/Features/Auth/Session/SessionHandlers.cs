using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Auth.Session;

public sealed record LogoutCommand(string? RefreshToken);

/// <summary>Revokes the presented refresh token (if any). Always succeeds.</summary>
public sealed class LogoutHandler(IApplicationDbContext db, SessionIssuer sessions, IClock clock) : IHandler<LogoutCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(LogoutCommand request, CancellationToken cancellationToken)
    {
        var token = await sessions.FindRefreshTokenAsync(request.RefreshToken, cancellationToken);
        if (token is { IsRevoked: false })
        {
            token.Revoke(clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Unit.Value;
    }
}

public sealed record GetMeQuery;

public sealed class GetMeHandler(ITenantContext tenant, MeBuilder meBuilder) : IHandler<GetMeQuery, MeDto>
{
    public async Task<Result<MeDto>> HandleAsync(GetMeQuery request, CancellationToken cancellationToken) =>
        await meBuilder.BuildAsync(tenant.RequireUserId(), tenant.OrganizationId, cancellationToken, tenant.SessionBranchId);
}

public sealed record SwitchOrganizationCommand(Guid OrganizationId)
{
    /// <summary>Raw refresh token from the cookie (set by the controller, not from the body).</summary>
    public string? CurrentRefreshToken { get; init; }
}

public sealed class SwitchOrganizationValidator : AbstractValidator<SwitchOrganizationCommand>
{
    public SwitchOrganizationValidator() => RuleFor(x => x.OrganizationId).NotEmpty();
}

/// <summary>Issues a new session for another organization the user is an active member of; revokes the current refresh token.</summary>
public sealed class SwitchOrganizationHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    SessionIssuer sessions,
    IAuditLogger audit,
    IClock clock) : IHandler<SwitchOrganizationCommand, AuthSession>
{
    public async Task<Result<AuthSession>> HandleAsync(SwitchOrganizationCommand request, CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstAsync(u => u.Id == tenant.RequireUserId(), cancellationToken);
        var organization = await sessions.ResolveOrganizationAsync(user, request.OrganizationId, cancellationToken);
        if (organization.IsFailure)
        {
            return organization.Error;
        }

        var current = await sessions.FindRefreshTokenAsync(request.CurrentRefreshToken, cancellationToken);
        if (current is not null && current.UserId == user.Id)
        {
            current.Revoke(clock.UtcNow);
        }

        var session = await sessions.IssueAsync(user, organization.Value, null, cancellationToken);
        audit.Log(new AuditEntry("auth.organization_switched", nameof(User), user.Id.ToString())
        {
            OrganizationId = organization.Value,
        });
        await db.SaveChangesAsync(cancellationToken);
        return session;
    }
}
