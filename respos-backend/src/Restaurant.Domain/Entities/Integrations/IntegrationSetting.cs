using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Integrations;

/// <summary>
/// One integration of an organization (unique per OrganizationId + Type). The whole provider config (incl. secrets)
/// is stored as JSON encrypted with ASP.NET Core Data Protection in <see cref="ProtectedConfig"/>; it is never returned
/// to clients unmasked. Last success/error drive the computed <see cref="IntegrationStatus"/>.
/// </summary>
public class IntegrationSetting : AuditableEntity, ITenantScoped
{
    public const int LastErrorMaxLength = 500;

    public Guid OrganizationId { get; set; }
    public IntegrationType Type { get; set; }
    public bool IsEnabled { get; set; }
    public string? ProtectedConfig { get; set; }
    public DateTime? LastSuccessAt { get; set; }
    public DateTime? LastErrorAt { get; set; }
    public string? LastError { get; set; }

    public IntegrationStatus Status(bool isConfigured)
    {
        if (!IsEnabled || !isConfigured)
        {
            return IntegrationStatus.NotConfigured;
        }

        return LastErrorAt is { } error && (LastSuccessAt is null || error > LastSuccessAt)
            ? IntegrationStatus.Error
            : IntegrationStatus.Connected;
    }

    public void MarkSuccess(DateTime utcNow) => LastSuccessAt = utcNow;

    public void MarkError(string error, DateTime utcNow)
    {
        LastErrorAt = utcNow;
        LastError = error.Length <= LastErrorMaxLength ? error : error[..LastErrorMaxLength];
    }
}
