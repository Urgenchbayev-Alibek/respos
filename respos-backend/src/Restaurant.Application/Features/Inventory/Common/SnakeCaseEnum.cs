namespace Restaurant.Application.Features.Inventory.Common;

/// <summary>Parses contract snake_case enum values from query strings (e.g. <c>write_off</c> → WriteOff).</summary>
public static class SnakeCaseEnum
{
    public static bool TryParse<TEnum>(string? value, out TEnum result)
        where TEnum : struct, Enum
    {
        result = default;
        return !string.IsNullOrWhiteSpace(value)
            && !value.Any(char.IsDigit)
            && Enum.TryParse(value.Replace("_", string.Empty, StringComparison.Ordinal), ignoreCase: true, out result)
            && Enum.IsDefined(result);
    }

    public static bool IsValidOrEmpty<TEnum>(string? value)
        where TEnum : struct, Enum => string.IsNullOrWhiteSpace(value) || TryParse<TEnum>(value, out _);
}
