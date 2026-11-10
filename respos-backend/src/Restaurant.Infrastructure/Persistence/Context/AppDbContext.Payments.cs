using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>F2 DbSets (implements IApplicationDbContext.Payments.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<OrderBill> OrderBills => Set<OrderBill>();
    public DbSet<OrderBillItem> OrderBillItems => Set<OrderBillItem>();
    public DbSet<PaymentIntent> PaymentIntents => Set<PaymentIntent>();
    public DbSet<BranchPaymentProvider> BranchPaymentProviders => Set<BranchPaymentProvider>();
}
