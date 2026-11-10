using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Customers;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Customers.Common;

/// <summary>Customer + stats computed in SQL (correlated subqueries over paid orders of the org).</summary>
public sealed class CustomerRow
{
    public required Customer Customer { get; init; }
    public int Visits { get; init; }
    public decimal TotalSpent { get; init; }
    public DateTime? LastVisitAt { get; init; }
    public decimal Points { get; init; }
}

/// <summary>Read side of the CRM: stats projection, segments, birthday flags, order customer summaries.</summary>
[ScopedService]
public sealed class CustomerReadService(IApplicationDbContext db, ITenantContext tenant, IClock clock)
{
    public const int SoonDays = 7;
    public const int NewDays = 30;
    public const int SleepingDays = 30;
    public const int RegularMinVisits = 3;

    /// <summary>
    /// Customers of the current org with stats. Visits = paid orders; total spent = Σ paidAmount (net of refunds);
    /// points = balance minus lots already past expiry (expiry is written lazily on the next ledger write).
    /// </summary>
    public IQueryable<CustomerRow> Rows()
    {
        var now = clock.UtcNow;
        return db.Customers.AsNoTracking().Select(c => new CustomerRow
        {
            Customer = c,
            Visits = db.Orders.Count(o => o.CustomerId == c.Id && o.Status == OrderStatus.Paid),
            TotalSpent = db.Orders.Where(o => o.CustomerId == c.Id && o.Status == OrderStatus.Paid).Sum(o => (decimal?)o.PaidAmount) ?? 0m,
            LastVisitAt = db.Orders.Where(o => o.CustomerId == c.Id && o.Status == OrderStatus.Paid).Max(o => o.ClosedAt),
            Points = (db.LoyaltyAccounts.Where(a => a.CustomerId == c.Id).Sum(a => (decimal?)a.Balance) ?? 0m)
                -(db.LoyaltyTransactions
                    .Where(t => t.CustomerId == c.Id && t.RemainingPoints > 0 && t.ExpiresAt <= now)
                    .Sum(t => (decimal?)t.RemainingPoints) ?? 0m),
        });
    }

    public IQueryable<CustomerRow> ApplySegment(IQueryable<CustomerRow> rows, string? segment, DateOnly today)
    {
        var now = clock.UtcNow;
        switch (segment)
        {
            case "new":
                var newSince = now.AddDays(-NewDays);
                return rows.Where(r => r.Customer.CreatedAt >= newSince);
            case "regular":
                return rows.Where(r => r.Visits >= RegularMinVisits);
            case "sleeping":
                var sleepingBefore = now.AddDays(-SleepingDays);
                return rows.Where(r => r.LastVisitAt != null && r.LastVisitAt < sleepingBefore);
            case "birthday":
                var keys = Customer.BirthdayKeys(today, SoonDays).ToList();
                return rows.Where(r => r.Customer.BirthdayKey != null && keys.Contains(r.Customer.BirthdayKey.Value));
            case "vip":
                return rows.Where(r => r.Customer.Tags.Contains(Customer.VipTag));
            default:
                return rows;
        }
    }

    /// <summary>Today in the current branch's timezone (org default timezone when no branch header).</summary>
    public async Task<DateOnly> LocalTodayAsync(CancellationToken ct)
    {
        string? timezone = null;
        if (tenant.BranchId is { } branchId)
        {
            timezone = await db.Branches.AsNoTracking().Where(b => b.Id == branchId).Select(b => b.Timezone).FirstOrDefaultAsync(ct);
        }

        var zone = TimeZoneInfo.TryFindSystemTimeZoneById(timezone ?? RestaurantBranch.DefaultTimezone, out var found) ? found : TimeZoneInfo.Utc;
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(clock.UtcNow, zone));
    }

    public static bool IsBirthdayIn(Customer c, DateOnly today, int days) =>
        c.BirthdayKey is { } key && Customer.BirthdayKeys(today, days).Contains(key);

    public static CustomerListItemDto ToListItem(CustomerRow r, DateOnly today) => new(
        r.Customer.Id, r.Customer.Name, r.Customer.Phone, r.Customer.Birthday, r.Customer.Tags, r.Customer.IsVip,
        IsBirthdayIn(r.Customer, today, 1), IsBirthdayIn(r.Customer, today, SoonDays),
        r.Visits, r.TotalSpent, Average(r), r.LastVisitAt, r.Points, r.Customer.CreatedAt);

    public async Task<CustomerDto?> GetAsync(Guid customerId, CancellationToken ct)
    {
        var row = await Rows().FirstOrDefaultAsync(r => r.Customer.Id == customerId, ct);
        if (row is null)
        {
            return null;
        }

        var account = await db.LoyaltyAccounts.AsNoTracking()
            .Where(a => a.CustomerId == customerId)
            .Select(a => new { a.LifetimeEarned, a.LifetimeRedeemed })
            .FirstOrDefaultAsync(ct);
        var today = await LocalTodayAsync(ct);
        var c = row.Customer;
        return new CustomerDto(
            c.Id, c.Name, c.Phone, c.Birthday, c.Gender, c.Notes, c.Tags, c.MarketingConsent, c.IsVip,
            IsBirthdayIn(c, today, 1), IsBirthdayIn(c, today, SoonDays), c.CreatedAt,
            new CustomerStatsDto(row.Visits, row.TotalSpent, Average(row), row.LastVisitAt),
            new CustomerLoyaltyDto(row.Points, account?.LifetimeEarned ?? 0m, account?.LifetimeRedeemed ?? 0m));
    }

    /// <summary>Summaries for <c>OrderDto.customer</c> keyed by customer id.</summary>
    public async Task<IReadOnlyDictionary<Guid, OrderCustomerDto>> GetSummariesAsync(IEnumerable<Guid?> customerIds, CancellationToken ct)
    {
        var ids = customerIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, OrderCustomerDto>();
        }

        var rows = await Rows().Where(r => ids.Contains(r.Customer.Id))
            .Select(r => new { r.Customer, r.Points })
            .ToListAsync(ct);
        var today = await LocalTodayAsync(ct);
        return rows.ToDictionary(
            r => r.Customer.Id,
            r => new OrderCustomerDto(r.Customer.Id, r.Customer.Name, r.Customer.Phone, IsBirthdayIn(r.Customer, today, 1), r.Customer.IsVip, r.Points));
    }

    private static decimal Average(CustomerRow r) =>
        r.Visits == 0 ? 0m : Math.Round(r.TotalSpent / r.Visits, 2, MidpointRounding.AwayFromZero);
}
