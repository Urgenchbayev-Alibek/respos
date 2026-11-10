using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Integrations;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Integrations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Common;

/// <summary>
/// Loads/saves <see cref="IntegrationSetting"/> rows by EXPLICIT organization id (works in background jobs and anonymous
/// requests without a tenant context) and decrypts their config.
/// </summary>
[ScopedService]
public sealed class IntegrationConfigStore(IApplicationDbContext db, ISecretProtector protector)
{
    /// <summary>Tracked setting or null.</summary>
    public async Task<IntegrationSetting?> FindAsync(Guid organizationId, IntegrationType type, CancellationToken cancellationToken) =>
        db.IntegrationSettings.Local.FirstOrDefault(s => s.OrganizationId == organizationId && s.Type == type)
        ?? await db.IntegrationSettings.IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.OrganizationId == organizationId && s.Type == type, cancellationToken);

    /// <summary>Decrypted config; null when absent or undecryptable (lost Data Protection keys → re-enter secrets).</summary>
    public IIntegrationConfig? Read(IntegrationSetting? setting)
    {
        if (setting?.ProtectedConfig is not { Length: > 0 } protectedConfig)
        {
            return null;
        }

        var json = protector.Unprotect(protectedConfig);
        return json is null ? null : IntegrationConfigCodec.Deserialize(setting.Type, json);
    }

    public void Write(IntegrationSetting setting, IIntegrationConfig config) =>
        setting.ProtectedConfig = protector.Protect(IntegrationConfigCodec.Serialize(config));

    /// <summary>The config only when the integration is enabled and complete.</summary>
    public async Task<(IntegrationSetting Setting, T Config)?> EnabledAsync<T>(
        Guid organizationId, IntegrationType type, CancellationToken cancellationToken)
        where T : class, IIntegrationConfig
    {
        var setting = await FindAsync(organizationId, type, cancellationToken);
        if (setting is not { IsEnabled: true } || Read(setting) is not T { IsConfigured: true } config)
        {
            return null;
        }

        return (setting, config);
    }
}
