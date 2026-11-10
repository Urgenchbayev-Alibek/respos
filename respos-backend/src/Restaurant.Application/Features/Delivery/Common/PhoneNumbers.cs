using FluentValidation;

namespace Restaurant.Application.Features.Delivery.Common;

/// <summary>
/// Uzbekistan-first phone normalization to E.164: "90 123-45-67" / "901234567" → <c>+998901234567</c>,
/// "998901234567" → <c>+998901234567</c>; other "+&lt;8–15 digits&gt;" numbers are kept. Anything else is invalid (null).
/// </summary>
public static class PhoneNumbers
{
    public const string UzbekistanCode = "998";
    private const int LocalLength = 9;

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
            return $"+{UzbekistanCode}{digits}";
        }

        if (digits.StartsWith(UzbekistanCode, StringComparison.Ordinal))
        {
            return digits.Length == UzbekistanCode.Length + LocalLength ? $"+{digits}" : null;
        }

        return international && digits.Length is >= 8 and <= 15 ? $"+{digits}" : null;
    }

    public static IRuleBuilderOptions<T, string> NormalizablePhone<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().MaximumLength(32).Must(p => Normalize(p) is not null).WithMessage("Phone number is invalid.");
}
