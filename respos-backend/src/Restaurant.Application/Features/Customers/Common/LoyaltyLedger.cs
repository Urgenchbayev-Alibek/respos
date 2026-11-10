using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Customers;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Customers.Common;

/// <summary>Loyalty write helpers: settings, tracked accounts (open lots + lazy expiry), per-order ledger sums.</summary>
[ScopedService]
public sealed class LoyaltyLedger(IApplicationDbContext db)
{
    /// <summary>Settings of the organization (explicit id, works in domain event handlers); defaults (disabled) if never saved.</summary>
    public async Task<LoyaltySettings> GetSettingsAsync(Guid organizationId, CancellationToken ct) =>
        await db.LoyaltySettings.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(s => s.OrganizationId == organizationId, ct)
        ?? LoyaltySettings.Default(organizationId);

    /// <summary>Tracked account with its open lots (created when missing); lots past expiry are expired first.</summary>
    public async Task<LoyaltyAccount> GetAccountAsync(Guid organizationId, Guid customerId, DateTime utcNow, CancellationToken ct)
    {
        var account = db.LoyaltyAccounts.Local.FirstOrDefault(a => a.CustomerId == customerId)
            ?? await db.LoyaltyAccounts.IgnoreQueryFilters()
                .Include(a => a.Transactions.Where(t => t.RemainingPoints > 0))
                .FirstOrDefaultAsync(a => a.OrganizationId == organizationId && a.CustomerId == customerId, ct);
        if (account is null)
        {
            account = LoyaltyAccount.Open(organizationId, customerId, utcNow);
            db.LoyaltyAccounts.Add(account);
        }

        account.ExpireDue(utcNow);
        return account;
    }

    /// <summary>Ledger entries of one order: saved rows + rows pending in this unit of work.</summary>
    public async Task<IReadOnlyList<LoyaltyTransaction>> OrderEntriesAsync(Guid orderId, CancellationToken ct)
    {
        var saved = await db.LoyaltyTransactions.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.OrderId == orderId)
            .ToListAsync(ct);
        var savedIds = saved.Select(t => t.Id).ToHashSet();
        var pending = db.LoyaltyTransactions.Local.Where(t => t.OrderId == orderId && !savedIds.Contains(t.Id));
        return saved.Concat(pending).ToList();
    }

    /// <summary>Points currently spent on the order: redeemed minus everything given back for it.</summary>
    public static decimal NetRedeemed(IEnumerable<LoyaltyTransaction> entries) =>
        -entries.Where(t => t.Type == LoyaltyTransactionType.Redeem || (t.Type == LoyaltyTransactionType.Reverse && t.Points > 0)).Sum(t => t.Points);
}
