using FluentValidation;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Application.Features.Integrations.Outbound;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Integrations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Settings;

/// <summary>
/// <c>POST /integrations/{type}/test</c> <c>{ recipient? }</c> — sends one test message synchronously with the SAVED config:
/// Telegram → every configured chat; SMS → <c>recipient</c> phone; SMTP → <c>recipient</c> e-mail. The attempt is
/// recorded in the outbound log (kind <c>test</c>); failures go to the integration error log. 422 when not enabled/configured.
/// </summary>
public sealed record TestIntegrationCommand(string? Recipient)
{
    public string Type { get; init; } = string.Empty;
}

public sealed class TestIntegrationValidator : AbstractValidator<TestIntegrationCommand>
{
    public TestIntegrationValidator() => RuleFor(x => x.Recipient).MaximumLength(CommonRules.EmailMaxLength);
}

public sealed class TestIntegrationHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IntegrationConfigStore store,
    OutboundQueue queue,
    OutboundDelivery delivery,
    IAuditLogger audit)
    : IHandler<TestIntegrationCommand, IntegrationTestResultDto>
{
    /// <summary>Eskiz test-mode accounts accept only this text.</summary>
    public const string SmsTestText = "Это тест от Eskiz";

    public async Task<Result<IntegrationTestResultDto>> HandleAsync(TestIntegrationCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        if (!SnakeCaseEnum.TryParse<IntegrationType>(request.Type, out var type))
        {
            return IntegrationErrors.NotFound;
        }

        var setting = await store.FindAsync(orgId, type, cancellationToken);
        var config = store.Read(setting);
        if (setting is not { IsEnabled: true } || config is not { IsConfigured: true })
        {
            return IntegrationErrors.NotConfigured;
        }

        var recipients = Recipients(type, config, request.Recipient?.Trim());
        if (recipients.IsFailure)
        {
            return recipients.Error;
        }

        string? error = null;
        foreach (var recipient in recipients.Value)
        {
            var message = queue.Enqueue(TestMessage(orgId, type, recipient));
            message.MaxAttempts = 1;
            var outcome = await delivery.DeliverAsync(message, cancellationToken);
            error ??= outcome.Result is { Succeeded: false } failed ? failed.Error : outcome.SkipReason;
        }

        audit.Log("integration.tested", nameof(IntegrationSetting), setting.Id, new { type, success = error is null });
        await db.SaveChangesAsync(cancellationToken);
        return new IntegrationTestResultDto(error is null, error, IntegrationDto.From(type, setting, config));
    }

    private static Result<IReadOnlyList<string>> Recipients(IntegrationType type, IIntegrationConfig config, string? recipient)
    {
        if (type == IntegrationType.Telegram)
        {
            return Result.Success<IReadOnlyList<string>>(((TelegramConfig)config).ChatIds);
        }

        var valid = type == IntegrationType.Smtp
            ? recipient is { Length: > 3 } && recipient.Contains('@')
            : recipient is not null && PhoneNumbers.TryNormalizeUz(recipient, out _);
        if (!valid)
        {
            return Result.Failure<IReadOnlyList<string>>(IntegrationErrors.InvalidConfig(
                new() { ["recipient"] = [type == IntegrationType.Smtp ? "Valid e-mail is required." : "Valid phone is required."] }));
        }

        return Result.Success<IReadOnlyList<string>>([recipient!]);
    }

    private static OutboundRequest TestMessage(Guid orgId, IntegrationType type, string recipient) => type switch
    {
        IntegrationType.Telegram => new(orgId, null, OutboundChannel.Telegram, "test", recipient, "Тестовое сообщение",
            "✅ RestaurantOS: тестовое сообщение. Уведомления настроены. / Bildirishnomalar sozlandi."),
        IntegrationType.SmsEskiz => new(orgId, null, OutboundChannel.Sms, "test", recipient, "Тестовое SMS", SmsTestText),
        _ => new(orgId, null, OutboundChannel.Email, "test", recipient, "Тестовое письмо",
            "RestaurantOS: тестовое письмо. SMTP настроен.\n\nRestaurantOS: test xati. SMTP sozlandi.",
            "RestaurantOS — тестовое письмо / test xati"),
    };
}
