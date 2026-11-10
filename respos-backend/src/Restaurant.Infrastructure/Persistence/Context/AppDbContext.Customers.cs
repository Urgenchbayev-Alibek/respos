using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Customers;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Guests (CRM) and loyalty DbSets (implements IApplicationDbContext.Customers.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<LoyaltySettings> LoyaltySettings => Set<LoyaltySettings>();
    public DbSet<LoyaltyAccount> LoyaltyAccounts => Set<LoyaltyAccount>();
    public DbSet<LoyaltyTransaction> LoyaltyTransactions => Set<LoyaltyTransaction>();
}
