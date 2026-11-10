using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Integrations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Common;

/// <summary>
/// <c>config</c> is the provider config with secrets masked (<c>****abcd</c>): TelegramConfig | EskizConfig | SmtpConfig.
/// </summary>
public sealed record IntegrationDto(
    IntegrationType Type,
    bool IsEnabled,
    IntegrationStatus Status,
    bool IsConfigured,
    object Config,
    DateTime? LastSuccessAt,
    DateTime? LastErrorAt,
    string? LastError,
    DateTime? UpdatedAt)
{
    public static IntegrationDto From(IntegrationType type, IntegrationSetting? setting, IIntegrationConfig? config)
    {
        var effective = config ?? IntegrationConfigCodec.Default(type);
        var configured = config?.IsConfigured == true;
        return new IntegrationDto(
            type,
            setting?.IsEnabled ?? false,
            setting?.Status(configured) ?? IntegrationStatus.NotConfigured,
            configured,
            effective.Masked(),
            setting?.LastSuccessAt,
            setting?.LastErrorAt,
            setting?.LastError,
            setting?.UpdatedAt ?? setting?.CreatedAt);
    }
}

public sealed record IntegrationTestResultDto(bool Success, string? Error, IntegrationDto Integration);

public sealed record OutboundMessageDto(
    Guid Id, OutboundChannel Channel, string Kind, string RecipientMasked, string Summary, OutboundStatus Status,
    int Attempts, int MaxAttempts, DateTime NextAttemptAt, string? LastError, DateTime CreatedAt, DateTime? SentAt, Guid? BranchId);

public sealed record IntegrationErrorDto(
    Guid Id, Guid? OrganizationId, string? OrganizationName, IntegrationType? IntegrationType, OutboundChannel? Channel,
    string Operation, string Message, Guid? OutboundMessageId, DateTime CreatedAt);

public static class IntegrationErrors
{
    public static readonly Error NotFound = Error.NotFound("integration.not_found", "Unknown integration type.");

    public static readonly Error NotConfigured =
        Error.BusinessRule("integration.not_configured", "Enable and configure the integration before sending a test.");

    public static Error InvalidConfig(Dictionary<string, string[]> errors) =>
        Error.Validation("validation.failed", "One or more fields are invalid.") with { Details = errors };
}
