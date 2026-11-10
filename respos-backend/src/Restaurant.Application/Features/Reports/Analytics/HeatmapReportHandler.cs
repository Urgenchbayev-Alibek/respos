using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary>
/// <c>GET /reports/heatmap?from=&amp;to=</c> — always 7 × 24 cells (ISO weekday 1–7 × hour 0–23, branch timezone),
/// orders and net revenue of paid orders by the local hour they were opened.
/// </summary>
public sealed class HeatmapReportHandler(IApplicationDbContext db, ReportScope scope) : IHandler<ReportPeriodQuery, HeatmapReportDto>
{
    public async Task<Result<HeatmapReportDto>> HandleAsync(ReportPeriodQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var hours = await db.SalesByLocalHourAsync(ctx, cancellationToken);
        return Build(hours);
    }

    public static HeatmapReportDto Build(IEnumerable<LocalHourTotals> hours)
    {
        var byCell = hours
            .GroupBy(h => (Weekday: AnalyticsMath.IsoWeekday(h.LocalHour.DayOfWeek), h.LocalHour.Hour))
            .ToDictionary(g => g.Key, g => (Orders: g.Sum(h => h.Orders), Revenue: g.Sum(h => h.Revenue)));
        var cells = new List<HeatmapCellDto>(7 * 24);
        for (var weekday = 1; weekday <= 7; weekday++)
        {
            for (var hour = 0; hour < 24; hour++)
            {
                var value = byCell.GetValueOrDefault((weekday, hour));
                cells.Add(new HeatmapCellDto(weekday, hour, value.Orders, value.Revenue));
            }
        }

        return new HeatmapReportDto(cells.Max(c => c.Revenue), cells.Max(c => c.Orders), cells);
    }
}
