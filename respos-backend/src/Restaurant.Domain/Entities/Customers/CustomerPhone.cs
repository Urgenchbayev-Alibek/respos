namespace Restaurant.Domain.Entities.Customers;

/// <summary>
/// Uzbekistan phone normalization to E.164 <c>+998XXXXXXXXX</c>. Accepts spaces, dashes, brackets, a leading
/// <c>+</c>, the 12-digit form starting with 998 and the 9-digit local form (operator code + number).
/// </summary>
public static class CustomerPhone
{
    public const string CountryCode = "998";
    private const int LocalLength = 9;

    public static bool TryNormalize(string? input, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(input))
        {
            return false;
        }

        var trimmed = input.Trim();
        if (trimmed.Any(c => !char.IsAsciiDigit(c) && c is not (' ' or '-' or '(' or ')' or '+')))
        {
            return false;
        }

        if (trimmed.IndexOf('+') > 0 || trimmed.Count(c => c == '+') > 1)
        {
            return false;
        }

        var digits = new string(trimmed.Where(char.IsAsciiDigit).ToArray());
        if (digits.Length == CountryCode.Length + LocalLength && digits.StartsWith(CountryCode, StringComparison.Ordinal))
        {
            digits = digits[CountryCode.Length..];
        }
        else if (digits.Length != LocalLength || trimmed.StartsWith('+'))
        {
            return false;
        }

        normalized = "+" + CountryCode + digits;
        return true;
    }

    /// <summary>Digits of a (partial) phone search term, without a leading country code (for "contains" search).</summary>
    public static string SearchDigits(string term)
    {
        var digits = new string(term.Where(char.IsAsciiDigit).ToArray());
        return digits.Length > LocalLength && digits.StartsWith(CountryCode, StringComparison.Ordinal) ? digits[CountryCode.Length..] : digits;
    }
}
