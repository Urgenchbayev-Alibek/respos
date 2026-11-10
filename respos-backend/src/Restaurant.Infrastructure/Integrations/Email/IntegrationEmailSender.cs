using Microsoft.Extensions.Logging;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Email;
using Restaurant.Application.Abstractions.Integrations;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Features.Integrations.Alerts;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Application.Features.Integrations.Outbound;
using Restaurant.Domain.Enums;
using Restaurant.Infrastructure.Services;

namespace Restaurant.Infrastructure.Integrations.Email;

/// <summary>
/// <see cref="IEmailSender"/> used by invitations / password reset. Route (<see cref="EmailRouting"/>): the current
/// organization's enabled SMTP → platform SMTP (<c>Integrations:Smtp</c>) → the log-only stub. SMTP e-mails are queued
/// (encrypted payload) and delivered by the outbound dispatcher with retries.
/// </summary>
internal sealed class IntegrationEmailSender(
    IApplicationDbContext db,
    ITenantContext tenant,
    IntegrationConfigStore store,
    IPlatformSmtpSettings platform,
    OutboundQueue queue,
    LogEmailSender fallback,
    ILogger<IntegrationEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var orgId = tenant.OrganizationId;
        var organizationSmtp = orgId is { } id
            ? (await store.EnabledAsync<SmtpConfig>(id, IntegrationType.Smtp, cancellationToken))?.Config
            : null;
        var route = EmailRouting.Choose(organizationSmtp, platform.Server);
        if (route == EmailRoute.Log)
        {
            await fallback.SendAsync(message, cancellationToken);
            return;
        }

        var queued = queue.Enqueue(new OutboundRequest(orgId, null, OutboundChannel.Email, AlertKinds.Email, message.To,
            message.Subject, message.Body, message.Subject, message.HtmlBody));
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Email to {Recipient} queued via {Route} SMTP (outbound {OutboundId})", queued.RecipientMasked, route, queued.Id);
    }
}
