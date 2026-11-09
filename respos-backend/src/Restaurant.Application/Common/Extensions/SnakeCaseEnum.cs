namespace Restaurant.Application.Common.Extensions;

/// <summary>
/// Query-string helpers shared by all modules: contract snake_case enum values (<c>no_show</c>, <c>in_progress</c>,
/// comma lists) and UTC normalisation. Bind multi-word enum filters as <c>string</c> and parse here — the default MVC
/// binder does not understand snake_case (400 for <c>status=no_show</c>).
/// </summary>
public static class SnakeCaseEnum
{
    public static bool TryParse<TEnum>(string? value, out TEnum result)
        where TEnum : struct, Enum
    {
        result = default;
        return !string.IsNullOrWhiteSpace(value)
               && !value.Any(char.IsDigit)
               && Enum.TryParse(value.Trim().Replace("_", string.Empty, StringComparison.Ordinal), ignoreCase: true, out result)
               && Enum.IsDefined(result);
    }

    public static bool IsValidOrEmpty<TEnum>(string? value)
        where TEnum : struct, Enum => string.IsNullOrWhiteSpace(value) || TryParse<TEnum>(value, out _);

    /// <summary>Every comma-separated value is a known enum value (or the list is empty).</summary>
    public static bool IsValidListOrEmpty<TEnum>(string? value)
        where TEnum : struct, Enum =>
        string.IsNullOrWhiteSpace(value)
        || value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).All(v => TryParse<TEnum>(v, out _));

    /// <summary>Parses <c>a,b,c</c>; unknown values are ignored.</summary>
    public static IReadOnlyList<TEnum> ParseList<TEnum>(string? value)
        where TEnum : struct, Enum =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(v => TryParse<TEnum>(v, out var parsed) ? (TEnum?)parsed : null)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .Distinct()
                .ToList();

    /// <summary>Unspecified kind is treated as UTC (contract: dates are ISO 8601 UTC).</summary>
    public static DateTime AsUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}
