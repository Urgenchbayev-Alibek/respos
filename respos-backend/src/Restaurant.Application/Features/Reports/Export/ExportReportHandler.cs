using FluentValidation;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Platform.FeatureFlags;
using Restaurant.Application.Features.Reports.CashShifts;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Application.Features.Reports.Sales;
using Restaurant.Application.Features.Reports.Stock;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Export;

/// <summary><c>GET /reports/{name}/export?format=csv&amp;from=&amp;to=&amp;limit=</c>.</summary>
public sealed record ExportReportQuery : ReportPeriodQuery
{
    public string Name { get; init; } = string.Empty;
    public string Format { get; init; } = "csv";
    public int? Limit { get; init; }
}

public sealed class ExportReportQueryValidator : AbstractValidator<ExportReportQuery>
{
    public ExportReportQueryValidator()
    {
        ReportPeriodRules.Apply(this);
        RuleFor(x => x.Format).Must(f => string.Equals(f, "csv", StringComparison.OrdinalIgnoreCase))
            .WithErrorCode(ReportErrors.UnsupportedFormat.Code).WithMessage(ReportErrors.UnsupportedFormat.Message);
        RuleFor(x => x.Limit).InclusiveBetween(1, TopItemsQuery.MaxLimit).When(x => x.Limit is not null);
    }
}

public sealed record ReportFile(string FileName, string ContentType, byte[] Content);

/// <summary>Builds a CSV from the same handlers as the JSON reports (requires the <c>csv_export</c> feature).</summary>
public sealed class ExportReportHandler(
    IFeatureFlags features,
    SalesReportHandler sales,
    TopItemsReportHandler topItems,
    SalesByCategoryReportHandler byCategory,
    PaymentMethodsReportHandler paymentMethods,
    StockReportHandler stock,
    StockMovementsReportHandler movements,
    CashShiftsReportHandler shifts) : IHandler<ExportReportQuery, ReportFile>
{
    public const string FeatureCode = "csv_export";

    public static readonly IReadOnlyList<string> Names =
        ["sales", "top-items", "sales-by-category", "payment-methods", "stock", "low-stock", "stock-movements", "cash-shifts"];

    public async Task<Result<ReportFile>> HandleAsync(ExportReportQuery request, CancellationToken cancellationToken)
    {
        if (!Names.Contains(request.Name))
        {
            return ReportErrors.NotFound;
        }

        if (!await features.IsEnabledAsync(FeatureCode, cancellationToken))
        {
            return FeatureErrors.Disabled(FeatureCode);
        }

        var period = new ReportPeriodQuery { From = request.From, To = request.To };
        var table = await BuildAsync(request, period, cancellationToken);
        if (table.IsFailure)
        {
            return table.Error;
        }

        var suffix = request.From is null ? string.Empty : $"_{request.From:yyyy-MM-dd}_{request.To ?? request.From:yyyy-MM-dd}";
        var content = CsvWriter.Write(table.Value.Headers, table.Value.Rows);
        return new ReportFile($"{request.Name}{suffix}.csv", CsvWriter.ContentType, content);
    }

    private sealed record Table(IReadOnlyList<string> Headers, IEnumerable<IReadOnlyList<object?>> Rows);

    private async Task<Result<Table>> BuildAsync(ExportReportQuery request, ReportPeriodQuery period, CancellationToken ct) =>
        request.Name switch
        {
            "sales" => Map(await sales.HandleAsync(period, ct), r => new Table(
                ["date", "revenue", "orders"], r.ByDay.Select(d => Row(d.Date, d.Revenue, d.Orders)))),
            "top-items" => Map(await topItems.HandleAsync(new TopItemsQuery { From = period.From, To = period.To, Limit = request.Limit }, ct),
                r => new Table(["menuItemId", "name", "quantity", "revenue"], r.Select(i => Row(i.MenuItemId, i.Name, i.Quantity, i.Revenue)))),
            "sales-by-category" => Map(await byCategory.HandleAsync(period, ct), r => new Table(
                ["categoryId", "name", "revenue", "quantity"], r.Select(c => Row(c.CategoryId, c.Name, c.Revenue, c.Quantity)))),
            "payment-methods" => Map(await paymentMethods.HandleAsync(period, ct), r => new Table(
                ["method", "amount", "count", "refundedAmount"], r.Select(p => Row(p.Method, p.Amount, p.Count, p.RefundedAmount)))),
            "stock" or "low-stock" => Map(await stock.HandleAsync(new StockReportQuery(request.Name == "low-stock"), ct), r => new Table(
                ["ingredientId", "name", "sku", "unit", "quantity", "minQuantity", "isLow", "costPrice", "stockValue"],
                r.Select(s => Row(s.IngredientId, s.Name, s.Sku, s.UnitCode, s.Quantity, s.MinQuantity, s.IsLow, s.CostPrice, s.StockValue)))),
            "stock-movements" => Map(await movements.HandleAsync(period, ct), r => new Table(
                ["type", "ingredientId", "ingredient", "unit", "quantity", "count"],
                r.Select(m => Row(m.Type, m.IngredientId, m.IngredientName, m.UnitCode, m.Quantity, m.Count)))),
            _ => Map(await shifts.HandleAsync(period, ct), r => new Table(
                ["id", "openedAt", "openedBy", "closedAt", "closedBy", "status", "openingAmount", "cash", "card", "other", "refunds",
                    "expectedCash", "actualCash", "difference"],
                r.Select(s => Row(s.Id, s.OpenedAt, s.OpenedByName, s.ClosedAt, s.ClosedByName, s.Status, s.OpeningAmount,
                    s.CashPayments, s.CardPayments, s.OtherPayments, s.Refunds, s.ExpectedCashAmount, s.ActualCashAmount, s.Difference)))),
        };

    private static IReadOnlyList<object?> Row(params object?[] cells) => cells;

    private static Result<Table> Map<T>(Result<T> result, Func<T, Table> map) =>
        result.IsSuccess ? map(result.Value) : Result.Failure<Table>(result.Error);
}
