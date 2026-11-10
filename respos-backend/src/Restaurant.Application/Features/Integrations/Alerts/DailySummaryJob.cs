using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Alerts;

/// <summary>
/// Daily Telegram summary per branch, at <c>DailySummaryTime</c> in the BRANCH timezone. Idempotent per branch and local
/// day: the dedupe key <c>{org}:daily_summary:{branch}:{yyyy-MM-dd}</c> is checked first and unique in the DB. Runs
/// across all tenants (no tenant context → explicit ids, query filters ignored).
/// </summary>
[ScopedService]
public sealed class DailySummaryJob(IApplicationDbContext db, IntegrationConfigStore store, OwnerAlerts alerts, IClock clock)
{
    public sealed record BranchDaySummary(decimal Revenue, int Orders, decimal Refunds, int CancelledOrders, IReadOnlyList<(string Name, decimal Quantity)> TopItems);

    /// <summary>Returns the number of branch summaries queued in this run.</summary>
    public async Task<int> RunAsync(CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var settings = await db.IntegrationSettings.IgnoreQueryFilters().AsNoTracking()
            .Where(s => s.Type == IntegrationType.Telegram && s.IsEnabled)
            .ToListAsync(cancellationToken);

        var queued = 0;
        foreach (var setting in settings)
        {
            if (store.Read(setting) is not TelegramConfig { IsConfigured: true, DailySummaryEnabled: true, DailySummaryAt: { } at })
            {
                continue;
            }

            var branches = await db.Branches.IgnoreQueryFilters().AsNoTracking()
                .Where(b => b.OrganizationId == setting.OrganizationId && b.IsActive && b.Organization!.Status == OrganizationStatus.Active)
                .ToListAsync(cancellationToken);
            foreach (var branch in branches)
            {
                var local = TimeZoneInfo.ConvertTimeFromUtc(now, BranchTimeService.Resolve(branch.Timezone));
                if (TimeOnly.FromDateTime(local) < at)
                {
                    continue;
                }

                var date = DateOnly.FromDateTime(local);
                var key = DedupeKey(setting.OrganizationId, branch.Id, date);
                if (await db.OutboundMessages.AnyAsync(m => m.DedupeKey != null && m.DedupeKey.StartsWith(key), cancellationToken))
                {
                    continue;
                }

                var ctx = await alerts.ContextAsync(setting.OrganizationId, branch.Id, cancellationToken);
                var summary = await SummarizeAsync(setting.OrganizationId, branch.Id, date, cancellationToken);
                var text = Format(ctx!, date, summary);
                var status = await alerts.TelegramAsync(setting.OrganizationId, branch.Id, AlertKinds.DailySummary, _ => true,
                    $"Итоги дня {date:dd.MM.yyyy}: {branch.Name}", text, cancellationToken, key);
                if (status == AlertStatus.Queued)
                {
                    await db.SaveChangesAsync(cancellationToken);
                    queued++;
                }
            }
        }

        return queued;
    }

    public static string DedupeKey(Guid organizationId, Guid branchId, DateOnly date) =>
        $"{organizationId:N}:{AlertKinds.DailySummary}:{branchId:N}:{date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}";

    public async Task<BranchDaySummary> SummarizeAsync(Guid organizationId, Guid branchId, DateOnly date, CancellationToken ct)
    {
        var orders = db.Orders.IgnoreQueryFilters()
            .Where(o => o.OrganizationId == organizationId && o.BranchId == branchId && o.BusinessDate == date);
        var paid = orders.Where(o => o.Status == OrderStatus.Paid);
        var gross = await paid.SumAsync(o => (decimal?)o.Total, ct) ?? 0m;
        var count = await paid.CountAsync(ct);
        var cancelled = await orders.CountAsync(o => o.Status == OrderStatus.Cancelled, ct);
        var refunds = await (
                from r in db.Refunds.IgnoreQueryFilters()
                join p in db.Payments.IgnoreQueryFilters() on r.PaymentId equals p.Id
                join o in paid on p.OrderId equals o.Id
                select (decimal?)r.Amount)
            .SumAsync(ct) ?? 0m;
        var top = await paid.SelectMany(o => o.Items)
            .Where(i => i.Status != OrderItemStatus.Cancelled)
            .GroupBy(i => i.NameSnapshot)
            .Select(g => new { Name = g.Key, Quantity = g.Sum(i => i.Quantity) })
            .OrderByDescending(x => x.Quantity)
            .Take(3)
            .ToListAsync(ct);
        return new BranchDaySummary(gross - refunds, count, refunds, cancelled, top.Select(t => (t.Name, t.Quantity)).ToList());
    }

    public static string Format(AlertContext ctx, DateOnly date, BranchDaySummary s)
    {
        var average = s.Orders == 0 ? 0m : Math.Round(s.Revenue / s.Orders, 2, MidpointRounding.AwayFromZero);
        var lines = new List<string>
        {
            $"📊 Итоги дня {date.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture)} — {ctx.BranchName}",
            $"Выручка: {AlertFormat.Money(s.Revenue, ctx.Currency)}",
            $"Заказов: {s.Orders}, средний чек: {AlertFormat.Money(average, ctx.Currency)}",
            $"Возвраты: {AlertFormat.Money(s.Refunds, ctx.Currency)}, отменено заказов: {s.CancelledOrders}",
        };
        if (s.TopItems.Count > 0)
        {
            lines.Add("Топ блюд: " + string.Join(", ", s.TopItems.Select(t => $"{t.Name} × {AlertFormat.Quantity(t.Quantity)}")));
        }

        return string.Join('\n', lines);
    }
}
