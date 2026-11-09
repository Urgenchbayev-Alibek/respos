namespace Restaurant.Application.Abstractions.Audit;

/// <summary>
/// Audit entry. Organization/branch/user default to the current tenant context when null.
/// <see cref="Changes"/> is serialized to JSON with sensitive keys (password, token, hash, secret) removed.
/// </summary>
public sealed record AuditEntry(string Action, string EntityType, string? EntityId, object? Changes = null)
{
    public Guid? OrganizationId { get; init; }
    public Guid? BranchId { get; init; }
    public Guid? UserId { get; init; }
}

/// <summary>Adds append-only AuditLog rows to the current unit of work (saved with the caller's SaveChangesAsync).</summary>
public interface IAuditLogger
{
    void Log(AuditEntry entry);
}

public static class AuditLoggerExtensions
{
    public static void Log(this IAuditLogger logger, string action, string entityType, Guid? entityId, object? changes = null) =>
        logger.Log(new AuditEntry(action, entityType, entityId?.ToString(), changes));
}
