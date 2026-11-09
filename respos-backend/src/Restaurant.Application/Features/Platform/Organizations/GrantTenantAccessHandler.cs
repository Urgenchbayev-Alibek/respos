using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Platform.Organizations;

public sealed record GrantTenantAccessCommand(string Reason)
{
    public Guid OrganizationId { get; init; }
}

public sealed class GrantTenantAccessValidator : AbstractValidator<GrantTenantAccessCommand>
{
    public const int MinReasonLength = 10;

    public GrantTenantAccessValidator() =>
        RuleFor(x => x.Reason).NotEmpty().Must(r => r.Trim().Length >= MinReasonLength).MaximumLength(500)
            .WithMessage($"A reason of at least {MinReasonLength} characters is required.");
}

public sealed record TenantAccessDto(
    string AccessToken, DateTime ExpiresAt, Guid OrganizationId, string OrganizationName, IReadOnlyList<string> Permissions);

/// <summary>
/// Break-glass (BR-1.6): <c>POST /platform/organizations/{id}/access { reason }</c> → 30-minute access token for that
/// organization with read-only permissions (org <c>*.read</c>, GET only), no refresh token. Every grant is audited
/// (visible in the platform system events and in the organization's own audit log).
/// </summary>
public sealed class GrantTenantAccessHandler(
    IApplicationDbContext db, ITenantContext tenant, ITokenService tokens, IAuditLogger audit)
    : IHandler<GrantTenantAccessCommand, TenantAccessDto>
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

    public async Task<Result<TenantAccessDto>> HandleAsync(GrantTenantAccessCommand request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsPlatformAdmin, cancellationToken);
        if (user is null)
        {
            return Error.Forbidden("auth.forbidden", "Platform administrator rights are required.");
        }

        var organization = await db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == request.OrganizationId, cancellationToken);
        if (organization is null)
        {
            return OrganizationErrors.NotFound;
        }

        var token = tokens.CreateTenantAccessToken(user, organization.Id, Lifetime);
        audit.Log(new AuditEntry(PlatformActions.TenantAccessGranted, nameof(Organization), organization.Id.ToString(),
            new { Reason = request.Reason.Trim(), token.ExpiresAt, Mode = "read_only" })
        {
            OrganizationId = organization.Id,
            UserId = userId,
        });
        await db.SaveChangesAsync(cancellationToken);

        var permissions = PermissionCatalog.OrganizationCodes.Where(c => c.EndsWith(".read", StringComparison.Ordinal)).ToList();
        return new TenantAccessDto(token.Token, token.ExpiresAt, organization.Id, organization.Name, permissions);
    }
}
