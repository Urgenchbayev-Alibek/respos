using Restaurant.Application.Abstractions.Reports;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.CashShifts;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Application.Features.Reports.Sales;
using Restaurant.Application.Features.Reports.Stock;
using Restaurant.Domain.Common;
using K = Restaurant.Application.Abstractions.Reports.ReportCellKind;

namespace Restaurant.Application.Features.Reports.Export;

/// <summary>Sheets + summary of a report; the export handler adds title, file name and timezone.</summary>
public sealed record ReportContent(IReadOnlyList<ReportSummaryLine> Summary, IReadOnlyList<ReportSheet> Sheets)
{
    public static ReportContent Single(ReportSheet sheet, params ReportSummaryLine[] summary) => new(summary, [sheet]);
}

/// <summary>Export tables of the v1 reports (CSV headers/rows unchanged since MVP).</summary>
[ScopedService]
public sealed class StandardReportDocuments(
    SalesReportHandler sales,
    TopItemsReportHandler topItems,
    SalesByCategoryReportHandler byCategory,
    PaymentMethodsReportHandler paymentMethods,
    StockReportHandler stock,
    StockMovementsReportHandler movements,
    CashShiftsReportHandler shifts)
{
    public static readonly IReadOnlyList<string> Names =
        ["sales", "top-items", "sales-by-category", "payment-methods", "stock", "low-stock", "stock-movements", "cash-shifts"];

    public async Task<Result<ReportContent>> BuildAsync(ExportReportQuery request, ReportLabels l, CancellationToken ct)
    {
        var period = new ReportPeriodQuery { From = request.From, To = request.To };
        var data = l["sheet.data"];
        return request.Name switch
        {
            "sales" => Map(await sales.HandleAsync(period, ct), r => ReportContent.Single(new ReportSheet(data,
                [l.Column("date", K.Date), l.Column("revenue", K.Money), l.Column("orders", K.Integer)],
                Rows(r.ByDay, d => [d.Date, d.Revenue, d.Orders])))),
            "top-items" => Map(await topItems.HandleAsync(new TopItemsQuery { From = period.From, To = period.To, Limit = request.Limit }, ct),
                r => ReportContent.Single(new ReportSheet(data,
                    [l.Column("menuItemId", K.Id), l.Column("name", K.Text, "item"), l.Column("quantity", K.Quantity), l.Column("revenue", K.Money)],
                    Rows(r, i => [i.MenuItemId, i.Name, i.Quantity, i.Revenue])))),
            "sales-by-category" => Map(await byCategory.HandleAsync(period, ct), r => ReportContent.Single(new ReportSheet(data,
                [l.Column("categoryId", K.Id), l.Column("name", K.Text, "category"), l.Column("revenue", K.Money), l.Column("quantity", K.Quantity)],
                Rows(r, c => [c.CategoryId, c.Name, c.Revenue, c.Quantity])))),
            "payment-methods" => Map(await paymentMethods.HandleAsync(period, ct), r => ReportContent.Single(new ReportSheet(data,
                [l.Column("method"), l.Column("amount", K.Money), l.Column("count", K.Integer), l.Column("refundedAmount", K.Money)],
                Rows(r, p => [p.Method, p.Amount, p.Count, p.RefundedAmount])))),
            "stock" or "low-stock" => Map(await stock.HandleAsync(new StockReportQuery(request.Name == "low-stock"), ct),
                r => ReportContent.Single(new ReportSheet(data,
                    [
                        l.Column("ingredientId", K.Id), l.Column("name", K.Text, "ingredient"), l.Column("sku"), l.Column("unit"),
                        l.Column("quantity", K.Quantity), l.Column("minQuantity", K.Quantity), l.Column("isLow", K.Boolean),
                        l.Column("costPrice", K.Money), l.Column("stockValue", K.Money),
                    ],
                    Rows(r, s => [s.IngredientId, s.Name, s.Sku, s.UnitCode, s.Quantity, s.MinQuantity, s.IsLow, s.CostPrice, s.StockValue])))),
            "stock-movements" => Map(await movements.HandleAsync(period, ct), r => ReportContent.Single(new ReportSheet(data,
                [
                    l.Column("type"), l.Column("ingredientId", K.Id), l.Column("ingredient"), l.Column("unit"),
                    l.Column("quantity", K.Quantity), l.Column("count", K.Integer),
                ],
                Rows(r, m => [m.Type, m.IngredientId, m.IngredientName, m.UnitCode, m.Quantity, m.Count])))),
            _ => Map(await shifts.HandleAsync(period, ct), r => ReportContent.Single(new ReportSheet(data,
                [
                    l.Column("id", K.Id), l.Column("openedAt", K.DateTime), l.Column("openedBy"), l.Column("closedAt", K.DateTime),
                    l.Column("closedBy"), l.Column("status"), l.Column("openingAmount", K.Money), l.Column("cash", K.Money),
                    l.Column("card", K.Money), l.Column("other", K.Money), l.Column("refunds", K.Money), l.Column("expectedCash", K.Money),
                    l.Column("actualCash", K.Money), l.Column("difference", K.Money),
                ],
                Rows(r, s => [s.Id, s.OpenedAt, s.OpenedByName, s.ClosedAt, s.ClosedByName, s.Status, s.OpeningAmount,
                    s.CashPayments, s.CardPayments, s.OtherPayments, s.Refunds, s.ExpectedCashAmount, s.ActualCashAmount, s.Difference])))),
        };
    }

    public static IReadOnlyList<IReadOnlyList<object?>> Rows<T>(IEnumerable<T> items, Func<T, object?[]> row) =>
        items.Select(i => (IReadOnlyList<object?>)row(i)).ToList();

    public static Result<ReportContent> Map<T>(Result<T> result, Func<T, ReportContent> map) =>
        result.IsSuccess ? map(result.Value) : Result.Failure<ReportContent>(result.Error);
}
