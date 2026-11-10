using System.Globalization;
using System.Net;
using System.Text;
using Restaurant.Application.Abstractions.Reports;

namespace Restaurant.Application.Features.Reports.Export;

/// <summary>
/// "PDF" export (ADR-0015): a self-contained, script-free, A4 print layout. The admin app prints it through the
/// browser (Print → Save as PDF). Every value is HTML-encoded; the response is served with a <c>default-src 'none'</c> CSP.
/// </summary>
public static class PrintHtmlWriter
{
    public const string ContentType = "text/html; charset=utf-8";

    private const string Styles =
        "@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#0f172a;font-size:12px;margin:0}"
        + "h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px}.sub{color:#475569;margin:0 0 12px}"
        + "dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:0 0 8px}dt{color:#475569}dd{margin:0;font-weight:600}"
        + "table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}"
        + "th,td{border-bottom:1px solid #e2e8f0;padding:4px 6px;text-align:left;vertical-align:top}"
        + "th{background:#f1f5f9;font-weight:600}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}"
        + "footer{margin-top:16px;color:#64748b;font-size:10px}";

    public static byte[] Write(ReportDocument document, ReportLabels labels, DateTime? generatedAtUtc = null)
    {
        var culture = Culture(labels.Language);
        var html = new StringBuilder(4096);
        html.Append("<!doctype html><html lang=\"").Append(labels.Language).Append("\"><head><meta charset=\"utf-8\">")
            .Append("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>").Append(Encode(document.Title))
            .Append("</title><style>").Append(Styles).Append("</style></head><body><h1>").Append(Encode(document.Title)).Append("</h1>");
        if (document.Subtitle is not null)
        {
            html.Append("<p class=\"sub\">").Append(Encode(document.Subtitle)).Append("</p>");
        }

        if (document.Summary.Count > 0)
        {
            html.Append("<dl>");
            foreach (var line in document.Summary)
            {
                html.Append("<dt>").Append(Encode(line.Label)).Append("</dt><dd>")
                    .Append(Encode(Format(line.Value, line.Kind, document, culture))).Append("</dd>");
            }

            html.Append("</dl>");
        }

        foreach (var sheet in document.Sheets)
        {
            AppendTable(html, sheet, document, culture);
        }

        var generated = TimeZoneInfo.ConvertTimeFromUtc(generatedAtUtc ?? DateTime.UtcNow, document.TimeZone);
        html.Append("<footer>").Append(Encode(labels["summary.generatedAt"])).Append(": ")
            .Append(generated.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture)).Append("</footer></body></html>");
        return Encoding.UTF8.GetBytes(html.ToString());
    }

    /// <summary>Human formatting shared with tests: money/quantities with the UI culture, instants in branch time.</summary>
    public static string Format(object? value, ReportCellKind kind, ReportDocument document, CultureInfo culture) => value switch
    {
        null => "—",
        ReportValue typed => Format(typed.Value, typed.Kind, document, culture),
        string s => s,
        DateTime utc => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), document.TimeZone)
            .ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture),
        DateOnly date => date.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture),
        int i => i.ToString("N0", culture),
        decimal d => kind switch
        {
            ReportCellKind.Quantity => d.ToString("#,##0.###", culture),
            ReportCellKind.Integer => d.ToString("N0", culture),
            ReportCellKind.Percent => d.ToString("0.##", culture) + " %",
            _ => d.ToString("N2", culture),
        },
        bool or Enum => document.Localize(value),
        _ => Convert.ToString(value, culture) ?? string.Empty,
    };

    public static CultureInfo Culture(string language) => CultureInfo.GetCultureInfo(language switch
    {
        "uz" => "uz-Latn-UZ",
        "en" => "en-US",
        _ => "ru-RU",
    });

    private static void AppendTable(StringBuilder html, ReportSheet sheet, ReportDocument document, CultureInfo culture)
    {
        var columns = sheet.Columns.Select((c, i) => (Column: c, Index: i)).Where(c => c.Column.Kind != ReportCellKind.Id).ToList();
        html.Append("<h2>").Append(Encode(sheet.Name)).Append("</h2><table><thead><tr>");
        foreach (var (column, _) in columns)
        {
            html.Append(IsNumeric(column.Kind) ? "<th class=\"n\">" : "<th>").Append(Encode(column.Title)).Append("</th>");
        }

        html.Append("</tr></thead><tbody>");
        foreach (var row in sheet.Rows)
        {
            html.Append("<tr>");
            foreach (var (column, index) in columns)
            {
                var value = index < row.Count ? row[index] : null;
                html.Append(IsNumeric(column.Kind) ? "<td class=\"n\">" : "<td>")
                    .Append(Encode(Format(value, column.Kind, document, culture))).Append("</td>");
            }

            html.Append("</tr>");
        }

        html.Append("</tbody></table>");
    }

    private static bool IsNumeric(ReportCellKind kind) =>
        kind is ReportCellKind.Integer or ReportCellKind.Money or ReportCellKind.Quantity or ReportCellKind.Percent;

    private static string Encode(string text) => WebUtility.HtmlEncode(text);
}
