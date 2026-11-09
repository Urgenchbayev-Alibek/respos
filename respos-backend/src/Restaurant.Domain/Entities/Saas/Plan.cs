using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Saas;

public class Plan : AuditableEntity
{
    public const string Starter = "starter";
    public const string Business = "business";
    public const string Enterprise = "enterprise";

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int MaxBranches { get; set; }
    public int MaxUsers { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<PlanFeature> Features { get; set; } = [];
}

/// <summary>Global feature dictionary. Key = Code.</summary>
public class Feature
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class PlanFeature
{
    public Guid PlanId { get; set; }
    public string FeatureCode { get; set; } = string.Empty;

    public Plan? Plan { get; set; }
    public Feature? Feature { get; set; }
}

public class Subscription : AuditableEntity, ITenantScoped
{
    public Guid OrganizationId { get; set; }
    public Guid PlanId { get; set; }
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Trial;
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    public Plan? Plan { get; set; }

    public bool IsCurrent(DateTime utcNow) =>
        Status is SubscriptionStatus.Trial or SubscriptionStatus.Active or SubscriptionStatus.PastDue
        && StartsAt <= utcNow
        && (EndsAt is null || EndsAt > utcNow);
}

/// <summary>Feature toggle. OrganizationId null = global default. Not tenant-filtered (platform managed).</summary>
public class FeatureFlag : AuditableEntity
{
    public Guid? OrganizationId { get; set; }
    public string FeatureCode { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
}

/// <summary>Billing event log (entity only; unused in MVP).</summary>
public class BillingEvent : Entity
{
    public Guid OrganizationId { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public string? PayloadJson { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Demo request from the landing page (not tenant-scoped).</summary>
public class DemoRequest : Entity
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string RestaurantName { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? Message { get; set; }
    public string? IpAddress { get; set; }
    public DemoRequestStatus Status { get; set; } = DemoRequestStatus.New;
    public DateTime CreatedAt { get; set; }
}
