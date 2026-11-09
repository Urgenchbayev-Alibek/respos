using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Platform.Common;

/// <summary>Platform view of a tenant: aggregates only, never business data (BR-1.6).</summary>
public sealed record PlatformOrganizationDto(
    Guid Id,
    string Name,
    string Slug,
    OrganizationStatus Status,
    string? PlanCode,
    SubscriptionStatus? SubscriptionStatus,
    int BranchesCount,
    int UsersCount,
    DateTime CreatedAt,
    bool IsDemo,
    DateTime? SubscriptionEndsAt);

public static class PlatformErrors
{
    public static readonly Error SlugTaken = Error.Conflict("organization.slug_taken", "An organization with this slug already exists.");
    public static readonly Error PlanNotFound = Error.NotFound("plan.not_found", "Plan not found.");
    public static readonly Error PlanCodeTaken = Error.Conflict("plan.code_taken", "A plan with this code already exists.");
    public static readonly Error InvalidFeatures = Error.Validation("plan.invalid_features", "Unknown feature codes.");
    public static readonly Error DemoRequestNotFound = Error.NotFound("demo_request.not_found", "Demo request not found.");
}

/// <summary>Audit action names of platform operations (all start with <c>platform.</c> → listed as system events).</summary>
public static class PlatformActions
{
    public const string Prefix = "platform.";
    public const string OrganizationCreated = "platform.organization.created";
    public const string OrganizationSuspended = "platform.organization.suspended";
    public const string OrganizationActivated = "platform.organization.activated";
    public const string SubscriptionUpdated = "platform.subscription.updated";
    public const string TenantAccessGranted = "platform.tenant_access.granted";
    public const string PlanCreated = "platform.plan.created";
    public const string PlanUpdated = "platform.plan.updated";
    public const string FeatureFlagUpdated = "platform.feature_flag.updated";
    public const string DemoRequestStatusChanged = "platform.demo_request.status_changed";

    /// <summary>Integration errors are also shown among system events.</summary>
    public const string IntegrationPrefix = "integration.";
}

public static class PlatformQueries
{
    /// <summary>Organization aggregates (correlated SQL sub-queries; tenant filters ignored explicitly).</summary>
    public static IQueryable<PlatformOrganizationDto> ProjectOrganizations(this IApplicationDbContext db, IQueryable<Organization> query) =>
        query.Select(o => new PlatformOrganizationDto(
            o.Id,
            o.Name,
            o.Slug,
            o.Status,
            db.Subscriptions.IgnoreQueryFilters().Where(s => s.OrganizationId == o.Id)
                .OrderByDescending(s => s.StartsAt).Select(s => s.Plan!.Code).FirstOrDefault(),
            db.Subscriptions.IgnoreQueryFilters().Where(s => s.OrganizationId == o.Id)
                .OrderByDescending(s => s.StartsAt).Select(s => (SubscriptionStatus?)s.Status).FirstOrDefault(),
            db.Branches.IgnoreQueryFilters().Count(b => b.OrganizationId == o.Id && b.IsActive),
            db.UserOrganizations.IgnoreQueryFilters().Count(uo => uo.OrganizationId == o.Id && uo.IsActive),
            o.CreatedAt,
            o.IsDemo,
            db.Subscriptions.IgnoreQueryFilters().Where(s => s.OrganizationId == o.Id)
                .OrderByDescending(s => s.StartsAt).Select(s => s.EndsAt).FirstOrDefault()));
}
