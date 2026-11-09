using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Platform.FeatureFlags;

/// <summary>Server-side feature check. Precedence: organization flag &gt; global flag &gt; current plan feature.</summary>
public interface IFeatureFlags
{
    /// <summary>For the current organization (false without an organization context unless a global flag enables it).</summary>
    Task<bool> IsEnabledAsync(string featureCode, CancellationToken cancellationToken = default);

    Task<bool> IsEnabledAsync(Guid organizationId, string featureCode, CancellationToken cancellationToken = default);
}

public static class FeatureErrors
{
    public static Error Disabled(string featureCode) =>
        Error.Forbidden("feature.disabled", $"The feature '{featureCode}' is not available for this organization.");

    public static readonly Error NotFound = Error.NotFound("feature.not_found", "Feature not found.");
}

internal sealed class FeatureFlagService(IApplicationDbContext db, ITenantContext tenant, IClock clock) : IFeatureFlags
{
    private readonly Dictionary<(Guid?, string), bool> _cache = [];

    public Task<bool> IsEnabledAsync(string featureCode, CancellationToken cancellationToken = default) =>
        ResolveAsync(tenant.OrganizationId, featureCode, cancellationToken);

    public Task<bool> IsEnabledAsync(Guid organizationId, string featureCode, CancellationToken cancellationToken = default) =>
        ResolveAsync(organizationId, featureCode, cancellationToken);

    private async Task<bool> ResolveAsync(Guid? organizationId, string featureCode, CancellationToken ct)
    {
        if (_cache.TryGetValue((organizationId, featureCode), out var cached))
        {
            return cached;
        }

        var flags = await db.FeatureFlags.AsNoTracking()
            .Where(f => f.FeatureCode == featureCode && (f.OrganizationId == null || f.OrganizationId == organizationId))
            .Select(f => new { f.OrganizationId, f.IsEnabled })
            .ToListAsync(ct);
        var enabled = flags.FirstOrDefault(f => f.OrganizationId is not null && f.OrganizationId == organizationId)?.IsEnabled
                      ?? flags.FirstOrDefault(f => f.OrganizationId is null)?.IsEnabled
                      ?? (organizationId is { } orgId && await PlanIncludesAsync(orgId, featureCode, ct));
        _cache[(organizationId, featureCode)] = enabled;
        return enabled;
    }

    private Task<bool> PlanIncludesAsync(Guid organizationId, string featureCode, CancellationToken ct)
    {
        var now = clock.UtcNow;
        return db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.OrganizationId == organizationId
                        && (s.Status == SubscriptionStatus.Trial || s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.PastDue)
                        && s.StartsAt <= now
                        && (s.EndsAt == null || s.EndsAt > now))
            .AnyAsync(s => s.Plan!.Features.Any(f => f.FeatureCode == featureCode), ct);
    }
}
