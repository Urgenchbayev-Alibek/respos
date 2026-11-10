using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary>Pure report math (unit-tested): ABC classes, Δ %, previous period, percentages.</summary>
public static class AnalyticsMath
{
    public const decimal ClassALimit = 80m;
    public const decimal ClassBLimit = 95m;

    public sealed record AbcInput(Guid Id, decimal Value);

    public sealed record AbcResult(Guid Id, decimal Value, decimal SharePercent, decimal CumulativePercent, string Class);

    /// <summary>
    /// Sorts by value (desc, ties keep input order) and assigns A/B/C by the cumulative share of the positive total.
    /// An item is A while the cumulative share <b>before</b> it is &lt; 80 %, B while &lt; 95 %, otherwise C, so the
    /// top seller is always A even when it alone exceeds 80 %. Items with value ≤ 0 (e.g. negative margin) are C with 0 %.
    /// </summary>
    public static IReadOnlyList<AbcResult> ClassifyAbc(IEnumerable<AbcInput> items)
    {
        var ordered = items.Select((item, index) => (item, index))
            .OrderByDescending(x => x.item.Value).ThenBy(x => x.index)
            .Select(x => x.item)
            .ToList();
        var total = ordered.Where(i => i.Value > 0).Sum(i => i.Value);
        var results = new List<AbcResult>(ordered.Count);
        var cumulativeValue = 0m;
        foreach (var item in ordered)
        {
            if (item.Value <= 0 || total == 0)
            {
                results.Add(new AbcResult(item.Id, item.Value, 0m, total == 0 ? 0m : 100m, "C"));
                continue;
            }

            var before = cumulativeValue / total * 100m;
            cumulativeValue += item.Value;
            var cls = before < ClassALimit ? "A" : before < ClassBLimit ? "B" : "C";
            results.Add(new AbcResult(item.Id, item.Value, Percent(item.Value, total), Percent(cumulativeValue, total), cls));
        }

        return results;
    }

    /// <summary>(current − previous) / previous × 100, 1 decimal; <c>null</c> when previous is 0 (no base to compare).</summary>
    public static decimal? DeltaPercent(decimal current, decimal previous) =>
        previous == 0 ? null : Math.Round((current - previous) / Math.Abs(previous) * 100m, 1, MidpointRounding.AwayFromZero);

    /// <summary>The period of equal length that ends the day before <paramref name="from"/>.</summary>
    public static (DateOnly From, DateOnly To) PreviousPeriod(DateOnly from, DateOnly to)
    {
        var length = to.DayNumber - from.DayNumber + 1;
        var previousTo = from.AddDays(-1);
        return (previousTo.AddDays(1 - length), previousTo);
    }

    /// <summary>part / whole × 100, 2 decimals; 0 when whole is 0.</summary>
    public static decimal Percent(decimal part, decimal whole) =>
        whole == 0 ? 0m : Money.Round(part / whole * 100m);

    /// <summary>ISO weekday: Monday = 1 … Sunday = 7.</summary>
    public static int IsoWeekday(DayOfWeek day) => day == DayOfWeek.Sunday ? 7 : (int)day;
}
