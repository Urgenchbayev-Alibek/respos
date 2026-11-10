using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Integrations;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Domain.Entities.Integrations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Outbound;

/// <summary>Result of one attempt: either a provider result or a skip reason (integration disabled / not configured).</summary>
public sealed record DeliveryOutcome(DeliveryResult? Result, string? SkipReason, IntegrationSetting? Setting, IntegrationType? Type);

/// <summary>
/// Delivers one queued message through the provider of its channel and records the outcome on the message, the
/// integration setting (last success / error) and <see cref="IntegrationErrorLog"/>. Does not save.
/// </summary>
[ScopedService]
public sealed class OutboundDelivery(
    IApplicationDbContext db,
    IntegrationConfigStore store,
    OutboundQueue queue,
    ITelegramSender telegram,
    ISmsSender sms,
    ISmtpSender smtp,
    IPlatformSmtpSettings platformSmtp,
    IClock clock)
{
    public async Task<DeliveryOutcome> DeliverAsync(OutboundMessage message, CancellationToken cancellationToken)
    {
        var payload = queue.ReadPayload(message);
        var outcome = payload is null
            ? new DeliveryOutcome(null, "Payload cannot be decrypted.", null, null)
            : await SendAsync(message, payload, cancellationToken);
        Record(message, outcome);
        return outcome;
    }

    private async Task<DeliveryOutcome> SendAsync(OutboundMessage message, OutboundPayload payload, CancellationToken ct)
    {
        switch (message.Channel)
        {
            case OutboundChannel.Telegram when message.OrganizationId is { } orgId:
            {
                var enabled = await store.EnabledAsync<TelegramConfig>(orgId, IntegrationType.Telegram, ct);
                return enabled is { } t
                    ? new(await telegram.SendMessageAsync(t.Config.BotToken!, payload.Recipient, payload.Body, ct), null, t.Setting, IntegrationType.Telegram)
                    : Skip(IntegrationType.Telegram);
            }

            case OutboundChannel.Sms when message.OrganizationId is { } orgId:
            {
                var enabled = await store.EnabledAsync<EskizConfig>(orgId, IntegrationType.SmsEskiz, ct);
                return enabled is { } s
                    ? new(await sms.SendAsync(s.Config.Credentials(), payload.Recipient, payload.Body, ct), null, s.Setting, IntegrationType.SmsEskiz)
                    : Skip(IntegrationType.SmsEskiz);
            }

            case OutboundChannel.Email:
            {
                var org = message.OrganizationId is { } orgId
                    ? await store.EnabledAsync<SmtpConfig>(orgId, IntegrationType.Smtp, ct)
                    : null;
                var email = new EmailContent(payload.Recipient, payload.Subject ?? message.Summary, payload.Body, payload.HtmlBody);
                return EmailRouting.Choose(org?.Config, platformSmtp.Server) switch
                {
                    EmailRoute.Organization => new(await smtp.SendAsync(org!.Value.Config.Server(), email, ct), null, org.Value.Setting, IntegrationType.Smtp),
                    EmailRoute.Platform => new(await smtp.SendAsync(platformSmtp.Server!, email, ct), null, null, IntegrationType.Smtp),
                    _ => Skip(IntegrationType.Smtp),
                };
            }

            default:
                return new(null, "No organization for this channel.", null, null);
        }
    }

    private static DeliveryOutcome Skip(IntegrationType type) => new(null, "Integration is disabled or not configured.", null, type);

    private void Record(OutboundMessage message, DeliveryOutcome outcome)
    {
        var now = clock.UtcNow;
        if (outcome.Result is not { } result)
        {
            message.MarkSkipped(outcome.SkipReason ?? "Skipped.");
            message.ProtectedPayload = string.Empty;
            return;
        }

        if (result.Succeeded)
        {
            message.MarkSent(now);
            outcome.Setting?.MarkSuccess(now);
        }
        else
        {
            var error = result.Error ?? "Delivery failed.";
            message.MarkFailedAttempt(error, result.Retryable, now, result.RetryAfter);
            outcome.Setting?.MarkError(error, now);
            db.IntegrationErrorLogs.Add(new IntegrationErrorLog
            {
                OrganizationId = message.OrganizationId,
                IntegrationType = outcome.Type,
                Channel = message.Channel,
                Operation = message.Kind,
                Message = error.Length <= IntegrationErrorLog.MessageMaxLength ? error : error[..IntegrationErrorLog.MessageMaxLength],
                OutboundMessageId = message.Id,
                CreatedAt = now,
            });
        }

        if (message.Status != OutboundStatus.Pending)
        {
            // Delivered or given up: the recipient and body are not kept at rest.
            message.ProtectedPayload = string.Empty;
        }
    }
}

public enum EmailRoute { Organization, Platform, Log }

/// <summary>SMTP selection: the organization's enabled SMTP → platform SMTP from env → log-only stub.</summary>
public static class EmailRouting
{
    public static EmailRoute Choose(SmtpConfig? organization, SmtpServer? platform) =>
        organization is { IsConfigured: true } ? EmailRoute.Organization
        : platform is not null ? EmailRoute.Platform
        : EmailRoute.Log;
}
