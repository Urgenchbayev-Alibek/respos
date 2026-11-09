using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Saas;

namespace Restaurant.Application.Features.Platform.FeatureFlags;

public sealed record FeatureFlagDto(Guid Id, Guid? OrganizationId, string FeatureCode, bool IsEnabled, DateTime? UpdatedAt);

/// <summary><c>GET /platform/feature-flags?organizationId=</c> — global flags, plus that organization's flags when given.</summary>
public sealed record ListFeatureFlagsQuery(Guid? OrganizationId);

public sealed class ListFeatureFlagsHandler(IApplicationDbContext db) : IHandler<ListFeatureFlagsQuery, IReadOnlyList<FeatureFlagDto>>
{
    public async Task<Result<IReadOnlyList<FeatureFlagDto>>> HandleAsync(ListFeatureFlagsQuery request, CancellationToken cancellationToken)
    {
        IReadOnlyList<FeatureFlagDto> flags = await db.FeatureFlags.AsNoTracking()
            .Where(f => f.OrganizationId == null || (request.OrganizationId != null && f.OrganizationId == request.OrganizationId))
            .OrderBy(f => f.OrganizationId != null).ThenBy(f => f.FeatureCode)
            .Select(f => new FeatureFlagDto(f.Id, f.OrganizationId, f.FeatureCode, f.IsEnabled, f.UpdatedAt ?? f.CreatedAt))
            .ToListAsync(cancellationToken);
        return Result.Success(flags);
    }
}

/// <summary><c>PUT /platform/feature-flags { organizationId?, featureCode, isEnabled }</c> — upsert (null org = global). Audited.</summary>
public sealed record SetFeatureFlagCommand(Guid? OrganizationId, string FeatureCode, bool IsEnabled);

public sealed class SetFeatureFlagValidator : AbstractValidator<SetFeatureFlagCommand>
{
    public SetFeatureFlagValidator() => RuleFor(x => x.FeatureCode).NotEmpty().MaximumLength(64);
}

public sealed class SetFeatureFlagHandler(IApplicationDbContext db, IAuditLogger audit) : IHandler<SetFeatureFlagCommand, FeatureFlagDto>
{
    public async Task<Result<FeatureFlagDto>> HandleAsync(SetFeatureFlagCommand request, CancellationToken cancellationToken)
    {
        if (!await db.Features.AnyAsync(f => f.Code == request.FeatureCode, cancellationToken))
        {
            return FeatureErrors.NotFound;
        }

        if (request.OrganizationId is { } orgId && !await db.Organizations.AnyAsync(o => o.Id == orgId, cancellationToken))
        {
            return OrganizationErrors.NotFound;
        }

        var flag = await db.FeatureFlags.FirstOrDefaultAsync(
            f => f.OrganizationId == request.OrganizationId && f.FeatureCode == request.FeatureCode, cancellationToken);
        if (flag is null)
        {
            flag = new FeatureFlag { OrganizationId = request.OrganizationId, FeatureCode = request.FeatureCode };
            db.FeatureFlags.Add(flag);
        }

        flag.IsEnabled = request.IsEnabled;
        audit.Log(new AuditEntry(PlatformActions.FeatureFlagUpdated, nameof(FeatureFlag), flag.Id.ToString(),
            new { request.FeatureCode, request.IsEnabled, Scope = request.OrganizationId is null ? "global" : "organization" })
        {
            OrganizationId = request.OrganizationId,
        });
        await db.SaveChangesAsync(cancellationToken);
        return new FeatureFlagDto(flag.Id, flag.OrganizationId, flag.FeatureCode, flag.IsEnabled, flag.UpdatedAt ?? flag.CreatedAt);
    }
}
