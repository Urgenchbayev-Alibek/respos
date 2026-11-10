using Restaurant.Application.Abstractions.Reports;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Analytics;
using Restaurant.Application.Features.Reports.CashShifts;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;
using static Restaurant.Application.Features.Reports.Export.StandardReportDocuments;
using K = Restaurant.Application.Abstractions.Reports.ReportCellKind;

namespace Restaurant.Application.Features.Reports.Export;

/// <summary>Export tables of the F5 analytics reports (same handlers as the JSON endpoints).</summary>
[ScopedService]
public sealed class AnalyticsReportDocuments(
    SalesSummaryHandler summary,
    AbcReportHandler abc,
    FoodCostReportHandler foodCost,
    WaiterPerformanceHandler waiters,
    HeatmapReportHandler heatmap,
    DiscountsCancellationsHandler discounts,
    ZReportHandler zReport)
{
    public static readonly IReadOnlyList<string> Names =
        ["sales-summary", "abc", "food-cost", "waiters", "heatmap", "discounts-cancellations", "z-report"];

    /// <summary>Reports that also have a print (PDF via the browser) layout.</summary>
    public static readonly IReadOnlyList<string> PrintableNames = ["sales-summary", "z-report"];

    public async Task<Result<ReportContent>> BuildAsync(ExportReportQuery request, ReportLabels l, CancellationToken ct)
    {
        var period = new ReportPeriodQuery { From = request.From, To = request.To };
        return request.Name switch
        {
            "sales-summary" => Map(await summary.HandleAsync(period, ct), r => SalesSummary(r, l)),
            "abc" => Map(await abc.HandleAsync(new AbcQuery { From = request.From, To = request.To, Metric = request.Metric ?? AbcMetric.Revenue }, ct),
                r => new ReportContent([new(l["summary.metric"], l.Value(r.Metric)), new(l["total"], r.Total, r.Metric == AbcMetric.Quantity ? K.Quantity : K.Money)],
                [
                    new ReportSheet(l["sheet.data"],
                        [
                            l.Column("menuItemId", K.Id), l.Column("name", K.Text, "item"), l.Column("class"), l.Column("quantity", K.Quantity),
                            l.Column("revenue", K.Money), l.Column("cost", K.Money), l.Column("margin", K.Money),
                            l.Column("sharePercent", K.Percent), l.Column("cumulativePercent", K.Percent),
                        ],
                        Rows(r.Items, i => [i.MenuItemId, i.Name, i.Class, i.Quantity, i.Revenue, i.Cost, i.Margin, i.SharePercent, i.CumulativePercent])),
                ])),
            "food-cost" => Map(await foodCost.HandleAsync(new FoodCostQuery { Threshold = request.Threshold }, ct),
                r => new ReportContent(
                    [new(l["summary.threshold"], r.ThresholdPercent, K.Percent), new(l["summary.aboveThreshold"], r.AboveThresholdCount, K.Integer)],
                    [
                        new ReportSheet(l["sheet.data"],
                            [
                                l.Column("menuItemId", K.Id), l.Column("variantId", K.Id), l.Column("name", K.Text, "item"), l.Column("variant"),
                                l.Column("category"), l.Column("price", K.Money), l.Column("recipeCost", K.Money),
                                l.Column("foodCostPercent", K.Percent), l.Column("marginAmount", K.Money), l.Column("marginPercent", K.Percent),
                                l.Column("hasRecipe", K.Boolean), l.Column("aboveThreshold", K.Boolean),
                            ],
                            Rows(r.Items, i => [i.MenuItemId, i.VariantId, i.Name, i.VariantName, i.CategoryName, i.Price, i.RecipeCost,
                                i.FoodCostPercent, i.MarginAmount, i.MarginPercent, i.HasRecipe, i.IsAboveThreshold])),
                    ])),
            "waiters" => Map(await waiters.HandleAsync(period, ct), r => ReportContent.Single(new ReportSheet(l["sheet.data"],
                [
                    l.Column("waiterId", K.Id), l.Column("name", K.Text, "waiter"), l.Column("orders", K.Integer), l.Column("revenue", K.Money),
                    l.Column("averageCheck", K.Money), l.Column("itemsSold", K.Quantity), l.Column("cancelledOrders", K.Integer),
                    l.Column("cancelledItems", K.Integer), l.Column("discountsAmount", K.Money), l.Column("tips", K.Money),
                ],
                Rows(r, w => [w.WaiterId, w.Name, w.OrdersCount, w.Revenue, w.AverageCheck, w.ItemsSold, w.CancelledOrders,
                    w.CancelledItems, w.DiscountsAmount, w.TipsAmount])))),
            "heatmap" => Map(await heatmap.HandleAsync(period, ct), r => Heatmap(r, l)),
            "discounts-cancellations" => Map(await discounts.HandleAsync(period, ct), r => DiscountsCancellations(r, l)),
            _ => Map(await zReport.HandleAsync(new ZReportQuery { ShiftId = request.ShiftId }, ct), r => ZReport(r, l)),
        };
    }

    private static ReportContent SalesSummary(SalesSummaryDto r, ReportLabels l)
    {
        (string Key, object Current, object Previous, decimal? Delta, K Kind)[] metrics =
        [
            ("revenue", r.Current.Revenue, r.Previous.Revenue, r.Deltas.Revenue, K.Money),
            ("orders", r.Current.OrdersCount, r.Previous.OrdersCount, r.Deltas.OrdersCount, K.Integer),
            ("averageCheck", r.Current.AverageCheck, r.Previous.AverageCheck, r.Deltas.AverageCheck, K.Money),
            ("itemsSold", r.Current.ItemsSold, r.Previous.ItemsSold, r.Deltas.ItemsSold, K.Quantity),
            ("discountsAmount", r.Current.DiscountsAmount, r.Previous.DiscountsAmount, r.Deltas.DiscountsAmount, K.Money),
            ("refunds", r.Current.Refunds, r.Previous.Refunds, AnalyticsMath.DeltaPercent(r.Current.Refunds, r.Previous.Refunds), K.Money),
            ("guests", r.Current.GuestsCount, r.Previous.GuestsCount, r.Deltas.GuestsCount, K.Integer),
        ];
        var days = r.ByDay.Select((day, index) => (IReadOnlyList<object?>)
        [
            day.Date, day.Revenue, day.Orders,
            index < r.PreviousByDay.Count ? r.PreviousByDay[index].Date : null,
            index < r.PreviousByDay.Count ? r.PreviousByDay[index].Revenue : null,
            index < r.PreviousByDay.Count ? r.PreviousByDay[index].Orders : null,
        ]).ToList();
        return new ReportContent(
            [
                new(l["summary.period"], $"{r.From:dd.MM.yyyy} – {r.To:dd.MM.yyyy}"),
                new(l["summary.previousPeriod"], $"{r.PreviousFrom:dd.MM.yyyy} – {r.PreviousTo:dd.MM.yyyy}"),
            ],
            [
                new ReportSheet(l["sheet.summary"],
                    [l.Column("metric", K.Text, "summary.metric"), l.Column("current", K.Money), l.Column("previous", K.Money), l.Column("deltaPercent", K.Percent)],
                    metrics.Select(m => (IReadOnlyList<object?>)[l[m.Key], new ReportValue(m.Current, m.Kind), new ReportValue(m.Previous, m.Kind), m.Delta]).ToList()),
                new ReportSheet(l["sheet.byDay"],
                    [
                        l.Column("date", K.Date), l.Column("revenue", K.Money), l.Column("orders", K.Integer),
                        l.Column("previousDate", K.Date), l.Column("previousRevenue", K.Money), l.Column("previousOrders", K.Integer),
                    ],
                    days),
            ]);
    }

    private static ReportContent Heatmap(HeatmapReportDto r, ReportLabels l)
    {
        var hours = Enumerable.Range(0, 24).ToList();
        var grid = Enumerable.Range(1, 7).Select(weekday => (IReadOnlyList<object?>)
            [l.Weekday(weekday), .. hours.Select(h => (object?)r.Cells.First(c => c.Weekday == weekday && c.Hour == h).Revenue)]).ToList();
        return new ReportContent([],
        [
            new ReportSheet(l["sheet.data"],
                [l.Column("weekday", K.Integer), l.Column("hour", K.Integer), l.Column("orders", K.Integer), l.Column("revenue", K.Money)],
                Rows(r.Cells, c => [c.Weekday, c.Hour, c.Orders, c.Revenue])),
            new ReportSheet(l["sheet.grid"],
                [l.Column("weekday"), .. hours.Select(h => new ReportColumn($"h{h:00}", $"{h:00}", K.Money))],
                grid),
        ]);
    }

    private static ReportContent DiscountsCancellations(DiscountsCancellationsDto r, ReportLabels l)
    {
        var d = r.Discounts;
        var c = r.Cancellations;
        return new ReportContent(
            [
                new(l["discountedOrders"], d.OrdersCount, K.Integer), new(l["discountsAmount"], d.Amount, K.Money),
                new(l["cancelledOrders"], c.OrdersCount, K.Integer), new(l["cancelledOrdersAmount"], c.OrdersAmount, K.Money),
                new(l["cancelledItems"], c.ItemsCount, K.Integer), new(l["cancelledItemsAmount"], c.ItemsAmount, K.Money),
            ],
            [
                new ReportSheet(l["sheet.discountedOrders"],
                    [
                        l.Column("orderId", K.Id), l.Column("number", K.Integer), l.Column("businessDate", K.Date, "date"), l.Column("waiter"),
                        l.Column("discountType"), l.Column("discountValue", K.Quantity), l.Column("subtotal", K.Money),
                        l.Column("discountAmount", K.Money), l.Column("total", K.Money),
                    ],
                    Rows(d.Orders, o => [o.OrderId, o.Number, o.BusinessDate, o.WaiterName, o.DiscountType, o.DiscountValue, o.Subtotal, o.DiscountAmount, o.Total])),
                new ReportSheet(l["sheet.cancelReasons"],
                    [l.Column("reason"), l.Column("orders", K.Integer), l.Column("items", K.Integer), l.Column("amount", K.Money)],
                    Rows(c.ByReason, x => [x.Reason.Length == 0 ? l["noReason"] : x.Reason, x.OrdersCount, x.ItemsCount, x.Amount])),
                new ReportSheet(l["sheet.byWaiter"],
                    [
                        l.Column("waiterId", K.Id), l.Column("name", K.Text, "waiter"), l.Column("discountedOrders", K.Integer),
                        l.Column("discountsAmount", K.Money), l.Column("cancellations", K.Integer, "cancelledItems"), l.Column("cancelledAmount", K.Money, "amount"),
                    ],
                    ByWaiter(d.ByWaiter, c.ByWaiter)),
            ]);
    }

    private static IReadOnlyList<IReadOnlyList<object?>> ByWaiter(IReadOnlyList<StaffAmountDto> discounts, IReadOnlyList<StaffAmountDto> cancellations) =>
        discounts.Select(x => x.WaiterId).Union(cancellations.Select(x => x.WaiterId))
            .Select(id =>
            {
                var d = discounts.FirstOrDefault(x => x.WaiterId == id);
                var c = cancellations.FirstOrDefault(x => x.WaiterId == id);
                return (IReadOnlyList<object?>)[id, d?.Name ?? c?.Name, d?.Count ?? 0, d?.Amount ?? 0m, c?.Count ?? 0, c?.Amount ?? 0m];
            })
            .ToList();

    private static ReportContent ZReport(ZReportDto r, ReportLabels l) => new(
        [
            new(l["summary.branch"], r.BranchName),
            new(l["status"], l.Value(r.Status)),
            new(l["openedAt"], r.OpenedAt, K.DateTime),
            new(l["openedBy"], r.OpenedByName),
            new(l["closedAt"], r.ClosedAt, K.DateTime),
            new(l["closedBy"], r.ClosedByName),
            new(l["openingAmount"], r.OpeningAmount, K.Money),
            new(l["payments"], r.TotalPayments, K.Money),
            new(l["refunds"], r.TotalRefunds, K.Money),
            new(l["net"], r.NetAmount, K.Money),
            new(l["shiftOrders"], r.OrdersCount, K.Integer),
            new(l["tips"], r.TipsAmount, K.Money),
            new(l["expectedCash"], r.ExpectedCashAmount, K.Money),
            new(l["actualCash"], r.ActualCashAmount, K.Money),
            new(l["difference"], r.Difference, K.Money),
        ],
        [
            new ReportSheet(l["sheet.methods"],
                [
                    l.Column("method"), l.Column("paymentsCount", K.Integer), l.Column("payments", K.Money),
                    l.Column("refundsCount", K.Integer), l.Column("refunds", K.Money), l.Column("net", K.Money),
                ],
                Rows(r.Methods, m => [m.Method, m.PaymentsCount, m.Payments, m.RefundsCount, m.Refunds, m.Net])),
        ]);
}
