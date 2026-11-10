using System.Text;
using System.Text.RegularExpressions;

namespace Restaurant.Domain.Entities.Identity;

/// <summary>
/// Public QR-menu address of a branch: lowercase latin letters, digits and single hyphens, 3–64 chars.
/// Generated as <c>{transliterated-name}-{6 hex of the branch id}</c> so it is unique without a lookup.
/// </summary>
public static partial class BranchSlug
{
    public const int MinLength = 3;
    public const int MaxLength = 64;
    private const int NamePartMaxLength = 40;

    private static readonly Dictionary<char, string> Cyrillic = new()
    {
        ['а'] = "a", ['б'] = "b", ['в'] = "v", ['г'] = "g", ['д'] = "d", ['е'] = "e", ['ё'] = "yo", ['ж'] = "zh",
        ['з'] = "z", ['и'] = "i", ['й'] = "y", ['к'] = "k", ['л'] = "l", ['м'] = "m", ['н'] = "n", ['о'] = "o",
        ['п'] = "p", ['р'] = "r", ['с'] = "s", ['т'] = "t", ['у'] = "u", ['ф'] = "f", ['х'] = "h", ['ц'] = "ts",
        ['ч'] = "ch", ['ш'] = "sh", ['щ'] = "sch", ['ъ'] = "", ['ы'] = "y", ['ь'] = "", ['э'] = "e", ['ю'] = "yu",
        ['я'] = "ya", ['ў'] = "o", ['қ'] = "q", ['ғ'] = "g", ['ҳ'] = "h",
    };

    public static bool IsValid(string? slug) =>
        slug is { Length: >= MinLength and <= MaxLength } && Pattern().IsMatch(slug);

    /// <summary>Slug for a new branch, e.g. "Ташкент — Центр" → <c>tashkent-tsentr-1a2b3c</c>.</summary>
    public static string Generate(string name, Guid branchId)
    {
        var namePart = Slugify(name);
        if (namePart.Length > NamePartMaxLength)
        {
            namePart = namePart[..NamePartMaxLength].TrimEnd('-');
        }

        var suffix = branchId.ToString("N")[..6];
        return namePart.Length == 0 ? $"branch-{suffix}" : $"{namePart}-{suffix}";
    }

    /// <summary>Lowercase, transliterated (ru/uz Cyrillic), non-alphanumerics collapsed into single hyphens.</summary>
    public static string Slugify(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var ch in value.ToLowerInvariant())
        {
            if (ch is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                builder.Append(ch);
            }
            else if (Cyrillic.TryGetValue(ch, out var latin))
            {
                builder.Append(latin);
            }
            else if (builder.Length > 0 && builder[^1] != '-')
            {
                builder.Append('-');
            }
        }

        return builder.ToString().Trim('-');
    }

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex Pattern();
}
