using System.Globalization;
using System.Text;

namespace Restaurant.Application.Features.Reports.Export;

/// <summary>
/// RFC 4180 CSV (comma, CRLF) encoded as UTF-8 with BOM (opens correctly in Excel).
/// CSV-injection safe: text cells starting with <c>= + - @</c> (or tab / CR) are prefixed with <c>'</c>.
/// Numbers are written with the invariant culture and never prefixed.
/// </summary>
public static class CsvWriter
{
    public const string ContentType = "text/csv; charset=utf-8";

    private static readonly char[] FormulaPrefixes = ['=', '+', '-', '@', '\t', '\r'];
    private static readonly char[] QuoteTriggers = [',', '"', '\n', '\r'];

    public static byte[] Write(IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<object?>> rows)
    {
        var builder = new StringBuilder();
        AppendRow(builder, headers);
        foreach (var row in rows)
        {
            AppendRow(builder, row);
        }

        var encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);
        return [.. encoding.GetPreamble(), .. encoding.GetBytes(builder.ToString())];
    }

    public static string FormatCell(object? value) => value switch
    {
        null => string.Empty,
        decimal d => d.ToString(CultureInfo.InvariantCulture),
        int i => i.ToString(CultureInfo.InvariantCulture),
        bool b => b ? "true" : "false",
        DateOnly date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        DateTime time => DateTime.SpecifyKind(time, DateTimeKind.Utc).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture),
        Guid id => id.ToString(),
        Enum e => EnumName(e),
        _ => EscapeText(Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty),
    };

    public static string EscapeText(string text)
    {
        if (text.Length > 0 && FormulaPrefixes.Contains(text[0]))
        {
            text = "'" + text;
        }

        return text.IndexOfAny(QuoteTriggers) >= 0 ? "\"" + text.Replace("\"", "\"\"") + "\"" : text;
    }

    private static void AppendRow<T>(StringBuilder builder, IEnumerable<T> cells)
    {
        builder.AppendJoin(',', cells.Select(c => c is string s ? EscapeText(s) : FormatCell(c)));
        builder.Append("\r\n");
    }

    private static string EnumName(Enum value)
    {
        var name = value.ToString();
        var result = new StringBuilder(name.Length + 4);
        for (var i = 0; i < name.Length; i++)
        {
            if (char.IsUpper(name[i]) && i > 0)
            {
                result.Append('_');
            }

            result.Append(char.ToLowerInvariant(name[i]));
        }

        return result.ToString();
    }
}
