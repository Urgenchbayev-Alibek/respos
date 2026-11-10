namespace Restaurant.Domain.Common;

/// <summary>
/// The one phone normalization of the system (guests, delivery customers/couriers, online reservations, SMS).
/// Input may contain spaces, dashes, brackets and one leading <c>+</c>. Uzbekistan first:
/// <c>90 123-45-67</c> / <c>901234567</c> / <c>998901234567</c> / <c>+998 (90) 123 45 67</c> → <c>+998901234567</c>;
/// other international numbers <c>+&lt;8–15 digits&gt;</c> are kept as E.164. Anything else is invalid.
/// </summary>
public static class PhoneNumbers
{
    public const string UzbekistanCode = "998";
    public const string UzbekistanPrefix = "+" + UzbekistanCode;
    private const int LocalLength = 9;
    private const int UzbekistanLength = 1 + 3 + LocalLength;

    /// <summary>E.164 form, or null when the input is not a phone number.</summary>
    public static string? Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        var trimmed = input.Trim();
        if (trimmed.Any(c => !(char.IsAsciiDigit(c) || c is '+' or ' ' or '-' or '(' or ')')) || trimmed.LastIndexOf('+') > 0)
        {
            return null;
        }

        var digits = new string(trimmed.Where(char.IsAsciiDigit).ToArray());
        var international = trimmed.StartsWith('+');
        if (!international && digits.Length == LocalLength)
        {
            return UzbekistanPrefix + digits;
        }

        if (digits.StartsWith(UzbekistanCode, StringComparison.Ordinal))
        {
            return digits.Length == UzbekistanCode.Length + LocalLength ? "+" + digits : null;
        }

        return international && digits.Length is >= 8 and <= 15 ? "+" + digits : null;
    }

    /// <summary>Uzbekistan number only (<c>+998</c> + 9 digits): guests (CRM) and the Eskiz SMS adapter.</summary>
    public static bool TryNormalizeUz(string? input, out string normalized)
    {
        normalized = Normalize(input) ?? string.Empty;
        var isUz = normalized.Length == UzbekistanLength && normalized.StartsWith(UzbekistanPrefix, StringComparison.Ordinal);
        if (!isUz)
        {
            normalized = string.Empty;
        }

        return isUz;
    }

    /// <summary>Digits of a (partial) phone search term, without a leading country code (for "contains" search).</summary>
    public static string SearchDigits(string term)
    {
        var digits = new string(term.Where(char.IsAsciiDigit).ToArray());
        return digits.Length > LocalLength && digits.StartsWith(UzbekistanCode, StringComparison.Ordinal) ? digits[UzbekistanCode.Length..] : digits;
    }
}
