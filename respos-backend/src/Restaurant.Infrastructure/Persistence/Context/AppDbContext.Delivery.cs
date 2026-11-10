using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Delivery;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Delivery / QR menu DbSets (implements IApplicationDbContext.Delivery.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<Courier> Couriers => Set<Courier>();
    public DbSet<OrderDelivery> OrderDeliveries => Set<OrderDelivery>();
    public DbSet<WaiterCall> WaiterCalls => Set<WaiterCall>();
}
