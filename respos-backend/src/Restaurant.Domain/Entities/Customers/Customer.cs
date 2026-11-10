using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Customers;

/// <summary>
/// Restaurant guest (CRM), org-scoped. Phone is normalized (+998…) and unique per organization.
/// Stats (visits, spent, average check, last visit) are computed from paid orders, never stored.
/// </summary>
public class Customer : AuditableEntity, ITenantScoped
{
    public const int MaxTags = 20;
    public const int TagMaxLength = 32;
    public const string VipTag = "vip";

    private Customer()
    {
    }

    public Guid OrganizationId { get; set; }
    public string Phone { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public DateOnly? Birthday { get; private set; }

    /// <summary><c>month * 100 + day</c> of <see cref="Birthday"/> — lets "birthday this week" filter run in SQL.</summary>
    public int? BirthdayKey { get; private set; }

    public CustomerGender? Gender { get; set; }
    public string? Notes { get; set; }
    public List<string> Tags { get; private set; } = [];
    public bool MarketingConsent { get; set; }

    public LoyaltyAccount? LoyaltyAccount { get; private set; }

    public bool IsVip => Tags.Contains(VipTag);

    public static Customer Create(Guid organizationId, string phone, string name)
    {
        var customer = new Customer { OrganizationId = organizationId };
        customer.SetPhone(phone);
        customer.Rename(name);
        return customer;
    }

    public void SetPhone(string phone)
    {
        if (!PhoneNumbers.TryNormalizeUz(phone, out var normalized))
        {
            throw new DomainException(CustomerErrors.InvalidPhone);
        }

        Phone = normalized;
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException(CustomerErrors.NameRequired);
        }

        Name = name.Trim();
    }

    public void SetBirthday(DateOnly? birthday)
    {
        Birthday = birthday;
        BirthdayKey = birthday is { } b ? KeyOf(b.Month, b.Day) : null;
    }

    /// <summary>Lower-cased, trimmed, distinct tags (empty ones dropped).</summary>
    public void SetTags(IEnumerable<string>? tags)
    {
        var cleaned = (tags ?? [])
            .Select(t => t.Trim().ToLowerInvariant())
            .Where(t => t.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (cleaned.Count > MaxTags || cleaned.Any(t => t.Length > TagMaxLength))
        {
            throw new DomainException(CustomerErrors.InvalidTags);
        }

        Tags = cleaned;
    }

    public static int KeyOf(int month, int day) => (month * 100) + day;

    /// <summary>Birthday keys of <paramref name="days"/> consecutive days starting at <paramref name="from"/> (Feb 29 → also on Feb 28 of non-leap years).</summary>
    public static IReadOnlyList<int> BirthdayKeys(DateOnly from, int days)
    {
        var keys = new HashSet<int>();
        for (var i = 0; i < days; i++)
        {
            var day = from.AddDays(i);
            keys.Add(KeyOf(day.Month, day.Day));
            if (day is { Month: 2, Day: 28 } && !DateTime.IsLeapYear(day.Year))
            {
                keys.Add(KeyOf(2, 29));
            }
        }

        return keys.ToList();
    }
}
