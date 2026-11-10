using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Features.Reports.Common;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary>Orders and net revenue of paid orders for one local (branch timezone) clock hour.</summary>
public sealed record LocalHourTotals(DateTime LocalHour, int Orders, decimal Revenue);

/// <summary>
/// Paid orders (business date in the period) bucketed by the local hour they were <b>opened</b> (guest traffic).
/// SQL groups by UTC year/month/day/hour (+ minute slot for zones with non-whole-hour offsets, e.g. +05:30); each
/// small bucket row is then converted to the branch timezone, which is DST-correct and provider-neutral.
/// Revenue = Σ order total − refunds of those orders (same rule as the sales report).
/// </summary>
public static class HourlySalesQueries
{
    public static async Task<IReadOnlyList<LocalHourTotals>> SalesByLocalHourAsync(
        this IApplicationDbContext db, ReportContext ctx, CancellationToken ct)
    {
        var slot = HasWholeHourOffsets(ctx.Zone) ? 60 : 15;
        var paid = db.PaidOrders(ctx.BranchId, ctx.From, ctx.To);
        var gross = await paid
            .GroupBy(o => new { o.OpenedAt.Year, o.OpenedAt.Month, o.OpenedAt.Day, o.OpenedAt.Hour, Slot = o.OpenedAt.Minute / slot })
            .Select(g => new Bucket(g.Key.Year, g.Key.Month, g.Key.Day, g.Key.Hour, g.Key.Slot, g.Count(), g.Sum(o => o.Total)))
            .ToListAsync(ct);
        var refunds = await (
                from r in db.Refunds
                join p in db.Payments on r.PaymentId equals p.Id
                join o in paid on p.OrderId equals o.Id
                group r.Amount by new { o.OpenedAt.Year, o.OpenedAt.Month, o.OpenedAt.Day, o.OpenedAt.Hour, Slot = o.OpenedAt.Minute / slot } into g
                select new Bucket(g.Key.Year, g.Key.Month, g.Key.Day, g.Key.Hour, g.Key.Slot, 0, g.Sum()))
            .ToListAsync(ct);

        return gross.Concat(refunds.Select(r => r with { Amount = -r.Amount }))
            .GroupBy(b => LocalHour(b, slot, ctx.Zone))
            .Select(g => new LocalHourTotals(g.Key, g.Sum(b => b.Orders), g.Sum(b => b.Amount)))
            .OrderBy(h => h.LocalHour)
            .ToList();
    }

    /// <summary>Start of the local clock hour that contains the UTC bucket start.</summary>
    public static DateTime LocalHour(DateTime utc, TimeZoneInfo zone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone);
        return new DateTime(local.Year, local.Month, local.Day, local.Hour, 0, 0, DateTimeKind.Unspecified);
    }

    private static DateTime LocalHour(Bucket bucket, int slot, TimeZoneInfo zone) =>
        LocalHour(new DateTime(bucket.Year, bucket.Month, bucket.Day, bucket.Hour, bucket.Slot * slot % 60, 0, DateTimeKind.Utc), zone);

    private static bool HasWholeHourOffsets(TimeZoneInfo zone) =>
        zone.BaseUtcOffset.Minutes == 0
        && zone.GetAdjustmentRules().All(r => r.DaylightDelta.Minutes == 0 && r.BaseUtcOffsetDelta.Minutes == 0);

    private sealed record Bucket(int Year, int Month, int Day, int Hour, int Slot, int Orders, decimal Amount);
}
