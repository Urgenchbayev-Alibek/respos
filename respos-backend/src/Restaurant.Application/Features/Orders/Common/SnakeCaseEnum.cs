namespace Restaurant.Application.Features.Orders.Common;

/// <summary>Query-string helpers: snake_case enum values (<c>in_progress</c>, comma lists) and UTC normalisation.</summary>
public static class SnakeCaseEnum
{
    public static bool TryParse<TEnum>(string? value, out TEnum result)
        where TEnum : struct, Enum
    {
        result = default;
        return !string.IsNullOrWhiteSpace(value)
               && Enum.TryParse(value.Trim().Replace("_", string.Empty), ignoreCase: true, out result)
               && Enum.IsDefined(result);
    }

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
