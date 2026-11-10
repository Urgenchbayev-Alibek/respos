using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>F2 DbSets: split bills, provider payment intents, per-branch provider switches.</summary>
public partial interface IApplicationDbContext
{
    DbSet<OrderBill> OrderBills { get; }
    DbSet<OrderBillItem> OrderBillItems { get; }
    DbSet<PaymentIntent> PaymentIntents { get; }
    DbSet<BranchPaymentProvider> BranchPaymentProviders { get; }
}
