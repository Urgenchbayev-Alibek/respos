using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Audit;

/// <summary>Append-only audit entry. Not tenant-filtered globally (platform events have no org); query by org explicitly.</summary>
public class AuditLog : Entity
{
    public Guid? OrganizationId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? CorrelationId { get; set; }
    public string? ChangesJson { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Stored response for an Idempotency-Key (unique Key + UserId, kept 24h).</summary>
public class IdempotencyRecord : Entity
{
    public string Key { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public string RequestHash { get; set; } = string.Empty;
    public int? ResponseStatus { get; set; }
    public string? ResponseBody { get; set; }
    public DateTime CreatedAt { get; set; }

    public bool IsCompleted => ResponseStatus is not null;
}
