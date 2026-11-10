namespace Restaurant.Application.Abstractions.Reports;

/// <summary>How a cell is rendered in XLSX / print. <see cref="Id"/> columns appear only in CSV (machine use).</summary>
public enum ReportCellKind
{
    Text,
    Id,
    Integer,
    Money,
    Quantity,
    Percent,
    Date,
    DateTime,
    Boolean,
}

/// <summary><paramref name="Key"/> = CSV header (stable, camelCase); <paramref name="Title"/> = localized header for XLSX / print.</summary>
public sealed record ReportColumn(string Key, string Title, ReportCellKind Kind = ReportCellKind.Text);

/// <summary>A cell value with its own kind, overriding the column kind (e.g. a quantity row in a money column).</summary>
public sealed record ReportValue(object? Value, ReportCellKind Kind);

public sealed record ReportSheet(string Name, IReadOnlyList<ReportColumn> Columns, IReadOnlyList<IReadOnlyList<object?>> Rows);

/// <summary>Label/value line shown above the tables (period, totals, Δ %…), values already formatted or numeric.</summary>
public sealed record ReportSummaryLine(string Label, object? Value, ReportCellKind Kind = ReportCellKind.Text);

/// <summary>
/// A format-neutral report: CSV writes the first sheet, XLSX writes every sheet (summary on top of the first),
/// print HTML writes the summary and all sheets. <see cref="TimeZone"/> converts UTC instants to branch-local time
/// (XLSX / print); CSV keeps ISO UTC. <see cref="Localize"/> renders enum / bool cells for people (XLSX / print);
/// CSV keeps snake_case / true|false.
/// </summary>
public sealed record ReportDocument(
    string FileName,
    string Title,
    string? Subtitle,
    TimeZoneInfo TimeZone,
    IReadOnlyList<ReportSummaryLine> Summary,
    IReadOnlyList<ReportSheet> Sheets,
    Func<object, string> Localize);

/// <summary>XLSX writer (Infrastructure: ClosedXML, MIT).</summary>
public interface ISpreadsheetWriter
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    byte[] Write(ReportDocument document);
}
