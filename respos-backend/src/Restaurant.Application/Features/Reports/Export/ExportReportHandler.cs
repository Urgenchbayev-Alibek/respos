using FluentValidation;
using Restaurant.Application.Abstractions.Reports;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Platform.FeatureFlags;
using Restaurant.Application.Features.Reports.Analytics;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Application.Features.Reports.Sales;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Export;

/// <summary>
/// <c>GET /reports/{name}/export?format=csv|xlsx|pdf&amp;from=&amp;to=&amp;limit=&amp;metric=&amp;threshold=&amp;shiftId=&amp;lang=</c>.
/// <c>lang</c> (ru|uz|en, default ru) localizes XLSX / print headers; CSV headers are stable keys.
/// </summary>
public sealed record ExportReportQuery : ReportPeriodQuery
{
    public string Name { get; init; } = string.Empty;
    public string Format { get; init; } = ReportFormats.Csv;
    public int? Limit { get; init; }
    public AbcMetric? Metric { get; init; }
    public decimal? Threshold { get; init; }
    public Guid? ShiftId { get; init; }
    public string? Lang { get; init; }
}

public static class ReportFormats
{
    public const string Csv = "csv";
    public const string Xlsx = "xlsx";

    /// <summary>Print-ready HTML (A4) that the browser prints / saves as PDF — see ADR-0015.</summary>
    public const string Pdf = "pdf";

    public static readonly IReadOnlyList<string> All = [Csv, Xlsx, Pdf];
}

public sealed class ExportReportQueryValidator : AbstractValidator<ExportReportQuery>
{
    public ExportReportQueryValidator()
    {
        ReportPeriodRules.Apply(this);
        RuleFor(x => x.Format).Must(f => f is not null && ReportFormats.All.Contains(f.ToLowerInvariant()))
            .WithErrorCode(ReportErrors.UnsupportedFormat.Code).WithMessage(ReportErrors.UnsupportedFormat.Message);
        RuleFor(x => x.Limit).InclusiveBetween(1, TopItemsQuery.MaxLimit).When(x => x.Limit is not null);
        RuleFor(x => x.Metric).IsInEnum().When(x => x.Metric is not null);
        RuleFor(x => x.Threshold).InclusiveBetween(1m, 100m).When(x => x.Threshold is not null);
        RuleFor(x => x.Lang).Must(l => l is null || ReportLabels.Languages.Contains(l));
    }
}

public sealed record ReportFile(string FileName, string ContentType, byte[] Content);

/// <summary>
/// Builds a report file from the same handlers as the JSON reports (requires the <c>csv_export</c> plan feature for
/// every format). CSV = first sheet; XLSX = all sheets (ClosedXML); pdf = print HTML, only for <see cref="AnalyticsReportDocuments.PrintableNames"/>.
/// </summary>
public sealed class ExportReportHandler(
    IFeatureFlags features,
    ReportScope scope,
    StandardReportDocuments standard,
    AnalyticsReportDocuments analytics,
    ISpreadsheetWriter spreadsheet) : IHandler<ExportReportQuery, ReportFile>
{
    public const string FeatureCode = "csv_export";

    public static readonly IReadOnlyList<string> Names = [.. StandardReportDocuments.Names, .. AnalyticsReportDocuments.Names];

    public async Task<Result<ReportFile>> HandleAsync(ExportReportQuery request, CancellationToken cancellationToken)
    {
        if (!Names.Contains(request.Name))
        {
            return ReportErrors.NotFound;
        }

        var format = request.Format.ToLowerInvariant();
        if (format == ReportFormats.Pdf && !AnalyticsReportDocuments.PrintableNames.Contains(request.Name))
        {
            return ReportErrors.UnsupportedFormat;
        }

        if (!await features.IsEnabledAsync(FeatureCode, cancellationToken))
        {
            return FeatureErrors.Disabled(FeatureCode);
        }

        var labels = ReportLabels.For(request.Lang);
        var content = StandardReportDocuments.Names.Contains(request.Name)
            ? await standard.BuildAsync(request, labels, cancellationToken)
            : await analytics.BuildAsync(request, labels, cancellationToken);
        if (content.IsFailure)
        {
            return content.Error;
        }

        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var suffix = request.From is null ? string.Empty : $"_{request.From:yyyy-MM-dd}_{request.To ?? request.From:yyyy-MM-dd}";
        var document = new ReportDocument(
            $"{request.Name}{suffix}", labels[$"report.{request.Name}"], Subtitle(request, ctx), ctx.Zone,
            content.Value.Summary, content.Value.Sheets, labels.Value);

        return format switch
        {
            ReportFormats.Xlsx => new ReportFile($"{document.FileName}.xlsx", ISpreadsheetWriter.ContentType, spreadsheet.Write(document)),
            ReportFormats.Pdf => new ReportFile($"{document.FileName}.html", PrintHtmlWriter.ContentType, PrintHtmlWriter.Write(document, labels)),
            _ => new ReportFile($"{document.FileName}.csv", CsvWriter.ContentType,
                CsvWriter.Write(document.Sheets[0].Columns.Select(c => c.Key).ToList(), document.Sheets[0].Rows)),
        };
    }

    private static string? Subtitle(ExportReportQuery request, ReportContext ctx) =>
        request.Name is "stock" or "low-stock" or "food-cost" or "z-report" ? null : $"{ctx.From:dd.MM.yyyy} – {ctx.To:dd.MM.yyyy}";
}
