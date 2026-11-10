using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Integrations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Settings;

/// <summary><c>GET /integrations</c> — all three integrations of the current organization (defaults when never saved).</summary>
public sealed record ListIntegrationsQuery;

public sealed class ListIntegrationsHandler(IApplicationDbContext db, ITenantContext tenant, IntegrationConfigStore store)
    : IHandler<ListIntegrationsQuery, IReadOnlyList<IntegrationDto>>
{
    public async Task<Result<IReadOnlyList<IntegrationDto>>> HandleAsync(ListIntegrationsQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var settings = await db.IntegrationSettings.AsNoTracking().ToListAsync(cancellationToken);
        IReadOnlyList<IntegrationDto> result = Enum.GetValues<IntegrationType>()
            .Select(type =>
            {
                var setting = settings.FirstOrDefault(s => s.Type == type);
                return IntegrationDto.From(type, setting, store.Read(setting));
            })
            .ToList();
        return Result.Success(result);
    }
}

/// <summary>
/// <c>PUT /integrations/{type}</c> <c>{ isEnabled, config }</c>. Secret fields sent empty or masked keep the stored value.
/// Enabled integrations must be complete (400 validation.failed). Audited without secret values.
/// </summary>
public sealed record UpdateIntegrationCommand(bool IsEnabled, JsonElement Config)
{
    public string Type { get; init; } = string.Empty;
}

public sealed class UpdateIntegrationHandler(
    IApplicationDbContext db, ITenantContext tenant, IntegrationConfigStore store, IAuditLogger audit)
    : IHandler<UpdateIntegrationCommand, IntegrationDto>
{
    public async Task<Result<IntegrationDto>> HandleAsync(UpdateIntegrationCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        if (!SnakeCaseEnum.TryParse<IntegrationType>(request.Type, out var type))
        {
            return IntegrationErrors.NotFound;
        }

        IIntegrationConfig? incoming;
        try
        {
            incoming = IntegrationConfigCodec.FromElement(type, request.Config);
        }
        catch (JsonException)
        {
            incoming = null;
        }

        if (incoming is null)
        {
            return IntegrationErrors.InvalidConfig(new() { ["config"] = ["Config object is required."] });
        }

        var setting = await store.FindAsync(orgId, type, cancellationToken);
        var existing = store.Read(setting);
        var merged = incoming.WithSecretsFrom(existing);
        var errors = merged.Validate(request.IsEnabled);
        if (errors.Count > 0)
        {
            return IntegrationErrors.InvalidConfig(errors);
        }

        if (setting is null)
        {
            setting = new IntegrationSetting { OrganizationId = orgId, Type = type };
            db.IntegrationSettings.Add(setting);
        }

        var wasEnabled = setting.IsEnabled;
        setting.IsEnabled = request.IsEnabled;
        store.Write(setting, merged);
        audit.Log("integration.updated", nameof(IntegrationSetting), setting.Id, new
        {
            type,
            isEnabled = request.IsEnabled,
            wasEnabled,
            changedFields = ChangedFields(existing, merged),
        });
        await db.SaveChangesAsync(cancellationToken);
        return IntegrationDto.From(type, setting, merged);
    }

    /// <summary>Names (never values) of config fields that changed; secret changes are visible only as a field name.</summary>
    internal static IReadOnlyList<string> ChangedFields(IIntegrationConfig? before, IIntegrationConfig after)
    {
        var a = before is null ? new JsonObject() : JsonNode.Parse(IntegrationConfigCodec.Serialize(before))!.AsObject();
        var b = JsonNode.Parse(IntegrationConfigCodec.Serialize(after))!.AsObject();
        return b.Select(p => p.Key)
            .Where(key => !JsonNode.DeepEquals(a[key], b[key]))
            .ToList();
    }
}
