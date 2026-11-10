using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Customers;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Guests (CRM) and loyalty DbSets (F1).</summary>
public partial interface IApplicationDbContext
{
    DbSet<Customer> Customers { get; }
    DbSet<LoyaltySettings> LoyaltySettings { get; }
    DbSet<LoyaltyAccount> LoyaltyAccounts { get; }
    DbSet<LoyaltyTransaction> LoyaltyTransactions { get; }
}
