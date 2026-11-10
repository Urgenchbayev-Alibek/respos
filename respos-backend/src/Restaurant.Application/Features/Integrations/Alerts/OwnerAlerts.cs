using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Application.Features.Integrations.Outbound;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Alerts;

/// <summary>What happened to an alert: queued for delivery, or a no-op because the integration/event is off.</summary>
public enum AlertStatus { Queued, Disabled, NotConfigured }

/// <summary>Context for alert texts (resolved without tenant filters — works in event handlers, jobs and public requests).</summary>
public sealed record AlertContext(Guid OrganizationId, Guid BranchId, string BranchName, string Currency, TimeZoneInfo TimeZone);

/// <summary>
/// Queues owner alerts (Telegram) and guest SMS. Never saves — callers' unit of work commits atomically, so alerts of a
/// rolled-back operation are never sent.
/// </summary>
[ScopedService]
public sealed class OwnerAlerts(IApplicationDbContext db, IntegrationConfigStore store, OutboundQueue queue)
{
    public async Task<AlertStatus> TelegramAsync(
        Guid organizationId, Guid? branchId, string kind, Func<TelegramConfig, bool> isWanted, string summary, string text,
        CancellationToken cancellationToken, string? dedupeKey = null)
    {
        var enabled = await store.EnabledAsync<TelegramConfig>(organizationId, IntegrationType.Telegram, cancellationToken);
        if (enabled is not { } telegram)
        {
            return AlertStatus.NotConfigured;
        }

        if (!isWanted(telegram.Config))
        {
            return AlertStatus.Disabled;
        }

        foreach (var chatId in telegram.Config.ChatIds)
        {
            queue.Enqueue(new OutboundRequest(organizationId, branchId, OutboundChannel.Telegram, kind, chatId, summary, text,
                DedupeKey: dedupeKey is null ? null : $"{dedupeKey}:{chatId}"));
        }

        return AlertStatus.Queued;
    }

    /// <summary>Guest SMS via Eskiz (Uzbek numbers only); no-op with a status when SMS is off or the number is foreign.</summary>
    public async Task<AlertStatus> SmsAsync(
        Guid organizationId, Guid? branchId, string kind, string phone, string summary, string text, CancellationToken cancellationToken)
    {
        var enabled = await store.EnabledAsync<EskizConfig>(organizationId, IntegrationType.SmsEskiz, cancellationToken);
        if (enabled is not { } sms)
        {
            return AlertStatus.NotConfigured;
        }

        if (!sms.Config.ReservationConfirmationEnabled || !PhoneNumbers.TryNormalizeUz(phone, out var normalized))
        {
            return AlertStatus.Disabled;
        }

        queue.Enqueue(new OutboundRequest(organizationId, branchId, OutboundChannel.Sms, kind, normalized, summary, text));
        return AlertStatus.Queued;
    }

    public async Task<AlertContext?> ContextAsync(Guid organizationId, Guid branchId, CancellationToken cancellationToken)
    {
        var branch = db.Branches.Local.FirstOrDefault(b => b.Id == branchId)
                     ?? await db.Branches.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId, cancellationToken);
        if (branch is null)
        {
            return null;
        }

        var orgId = organizationId != Guid.Empty ? organizationId : branch.OrganizationId;
        var currency = await db.Organizations.IgnoreQueryFilters().Where(o => o.Id == orgId)
            .Select(o => o.Currency).FirstOrDefaultAsync(cancellationToken) ?? "UZS";
        return new AlertContext(orgId, branch.Id, branch.Name, currency, Floor.Common.BranchTimeService.Resolve(branch.Timezone));
    }
}

/// <summary>Plain-text formatting for alert messages (RU, invariant digits).</summary>
public static class AlertFormat
{
    private static readonly NumberFormatInfo Numbers = new() { NumberGroupSeparator = " ", NumberDecimalSeparator = "," };

    public static string Money(decimal amount, string currency) =>
        amount.ToString(amount == decimal.Truncate(amount) ? "#,0" : "#,0.00", Numbers) + " " + currency;

    public static string Quantity(decimal value) => value.ToString("0.###", CultureInfo.InvariantCulture);

    public static string LocalTime(DateTime utc, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone).ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture);
}
