using ClosedXML.Excel;
using Restaurant.Application.Abstractions.Reports;

namespace Restaurant.Infrastructure.Reports;

/// <summary>
/// XLSX via ClosedXML (MIT). One worksheet per <see cref="ReportSheet"/>; the first one starts with the title, subtitle
/// and summary lines. Numbers stay numeric (with number formats), instants are converted to branch-local time,
/// <see cref="ReportCellKind.Id"/> columns are omitted. Text is always written as a string value (never a formula).
/// </summary>
public sealed class ClosedXmlSpreadsheetWriter : ISpreadsheetWriter
{
    private const int MaxSheetNameLength = 31;
    private const double MaxColumnWidth = 60;
    private static readonly char[] InvalidSheetChars = [':', '\\', '/', '?', '*', '[', ']'];

    public byte[] Write(ReportDocument document)
    {
        using var workbook = new XLWorkbook();
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < document.Sheets.Count; index++)
        {
            var sheet = document.Sheets[index];
            var worksheet = workbook.Worksheets.Add(SheetName(sheet.Name, used));
            var row = 1;
            if (index == 0)
            {
                row = WriteHeader(worksheet, document);
            }

            WriteTable(worksheet, sheet, document, row);
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static int WriteHeader(IXLWorksheet worksheet, ReportDocument document)
    {
        var row = 1;
        worksheet.Cell(row, 1).SetValue(document.Title);
        worksheet.Cell(row, 1).Style.Font.SetBold().Font.SetFontSize(14);
        row++;
        if (document.Subtitle is not null)
        {
            worksheet.Cell(row++, 1).SetValue(document.Subtitle);
        }

        foreach (var line in document.Summary)
        {
            worksheet.Cell(row, 1).SetValue(line.Label);
            worksheet.Cell(row, 1).Style.Font.SetFontColor(XLColor.Gray);
            SetCell(worksheet.Cell(row, 2), line.Value, line.Kind, document);
            worksheet.Cell(row, 2).Style.Font.SetBold();
            row++;
        }

        return row + 1;
    }

    private static void WriteTable(IXLWorksheet worksheet, ReportSheet sheet, ReportDocument document, int firstRow)
    {
        var columns = sheet.Columns.Select((c, i) => (Column: c, Index: i)).Where(c => c.Column.Kind != ReportCellKind.Id).ToList();
        for (var c = 0; c < columns.Count; c++)
        {
            var header = worksheet.Cell(firstRow, c + 1);
            header.SetValue(columns[c].Column.Title);
            header.Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#F1F5F9"));
        }

        for (var r = 0; r < sheet.Rows.Count; r++)
        {
            var values = sheet.Rows[r];
            for (var c = 0; c < columns.Count; c++)
            {
                var (column, index) = columns[c];
                SetCell(worksheet.Cell(firstRow + 1 + r, c + 1), index < values.Count ? values[index] : null, column.Kind, document);
            }
        }

        if (columns.Count > 0)
        {
            var lastRow = firstRow + Math.Max(sheet.Rows.Count, 1);
            worksheet.Range(firstRow, 1, lastRow, columns.Count).SetAutoFilter();
            worksheet.SheetView.FreezeRows(firstRow);
            worksheet.Columns(1, columns.Count).AdjustToContents(firstRow, lastRow);
            foreach (var column in worksheet.Columns(1, columns.Count))
            {
                column.Width = Math.Min(column.Width, MaxColumnWidth);
            }
        }
    }

    private static void SetCell(IXLCell cell, object? value, ReportCellKind kind, ReportDocument document)
    {
        switch (value)
        {
            case null:
                return;
            case ReportValue typed:
                SetCell(cell, typed.Value, typed.Kind, document);
                return;
            case string text:
                cell.SetValue(text);
                return;
            case int number:
                cell.SetValue(number);
                cell.Style.NumberFormat.Format = "#,##0";
                return;
            case decimal number:
                cell.SetValue(number);
                cell.Style.NumberFormat.Format = kind switch
                {
                    ReportCellKind.Quantity => "#,##0.###",
                    ReportCellKind.Percent => "0.00",
                    ReportCellKind.Integer => "#,##0",
                    _ => "#,##0.00",
                };
                return;
            case DateOnly date:
                cell.SetValue(date.ToDateTime(TimeOnly.MinValue));
                cell.Style.DateFormat.Format = "dd.mm.yyyy";
                return;
            case DateTime utc:
                cell.SetValue(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), document.TimeZone));
                cell.Style.DateFormat.Format = "dd.mm.yyyy hh:mm";
                return;
            case bool or Enum:
                cell.SetValue(document.Localize(value));
                return;
            default:
                cell.SetValue(value.ToString() ?? string.Empty);
                return;
        }
    }

    private static string SheetName(string name, HashSet<string> used)
    {
        var clean = new string(name.Select(ch => InvalidSheetChars.Contains(ch) ? ' ' : ch).ToArray()).Trim();
        if (clean.Length == 0)
        {
            clean = "Sheet";
        }

        clean = clean.Length > MaxSheetNameLength ? clean[..MaxSheetNameLength] : clean;
        var candidate = clean;
        for (var i = 2; !used.Add(candidate); i++)
        {
            var suffix = $" ({i})";
            candidate = (clean.Length + suffix.Length > MaxSheetNameLength ? clean[..(MaxSheetNameLength - suffix.Length)] : clean) + suffix;
        }

        return candidate;
    }
}
