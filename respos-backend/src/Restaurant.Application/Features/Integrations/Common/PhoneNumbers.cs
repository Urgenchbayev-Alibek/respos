namespace Restaurant.Application.Features.Integrations.Common;

/// <summary>Phone normalization to E.164 (Uzbekistan default): <c>90 123 45 67</c> / <c>998901234567</c> → <c>+998901234567</c>.</summary>
public static class PhoneNumbers
{
    public const string UzPrefix = "+998";

    /// <summary>E.164 (<c>+</c> and 7–15 digits); 9 local digits get the +998 prefix. Null when invalid.</summary>
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var trimmed = raw.Trim();
        if (trimmed.Any(c => !char.IsDigit(c) && c is not ('+' or ' ' or '-' or '(' or ')')))
        {
            return null;
        }

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (trimmed.StartsWith('+'))
        {
            return digits.Length is >= 7 and <= 15 ? "+" + digits : null;
        }

        return digits.Length switch
        {
            9 => UzPrefix + digits,
            12 when digits.StartsWith("998", StringComparison.Ordinal) => "+" + digits,
            _ => null,
        };
    }

    /// <summary>Uzbek mobile number (+998 and 9 digits) — the only numbers the Eskiz adapter sends to.</summary>
    public static bool TryNormalizeUz(string? raw, out string normalized)
    {
        normalized = Normalize(raw) ?? string.Empty;
        return normalized.Length == 13 && normalized.StartsWith(UzPrefix, StringComparison.Ordinal);
    }
}
