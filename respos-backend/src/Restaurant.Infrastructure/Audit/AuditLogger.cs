using System.Text.Json;
using System.Text.Json.Nodes;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Domain.Entities.Audit;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Audit;

/// <summary>Adds sanitized AuditLog rows to the current DbContext (committed with the caller's SaveChangesAsync).</summary>
internal sealed class AuditLogger(AppDbContext db, ITenantContext tenant, IRequestInfo request, IClock clock) : IAuditLogger
{
    private static readonly string[] SensitiveKeyParts = ["password", "token", "hash", "secret"];
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public void Log(AuditEntry entry)
    {
        db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = entry.OrganizationId ?? tenant.OrganizationId,
            BranchId = entry.BranchId ?? tenant.BranchId,
            UserId = entry.UserId ?? tenant.UserId,
            Action = entry.Action,
            EntityType = entry.EntityType,
            EntityId = entry.EntityId,
            CorrelationId = request.CorrelationId,
            IpAddress = request.IpAddress,
            ChangesJson = Sanitize(entry.Changes),
            CreatedAt = clock.UtcNow,
        });
    }

    internal static string? Sanitize(object? changes)
    {
        if (changes is null)
        {
            return null;
        }

        var node = JsonSerializer.SerializeToNode(changes, JsonOptions);
        RemoveSensitive(node);
        return node?.ToJsonString();
    }

    private static void RemoveSensitive(JsonNode? node)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var key in obj.Select(p => p.Key).Where(IsSensitive).ToList())
                {
                    obj.Remove(key);
                }

                foreach (var child in obj.Select(p => p.Value).ToList())
                {
                    RemoveSensitive(child);
                }

                break;
            case JsonArray array:
                foreach (var child in array)
                {
                    RemoveSensitive(child);
                }

                break;
        }
    }

    private static bool IsSensitive(string key) =>
        SensitiveKeyParts.Any(part => key.Contains(part, StringComparison.OrdinalIgnoreCase));
}
