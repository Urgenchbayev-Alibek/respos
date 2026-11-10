using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Delivery;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Delivery / QR menu DbSets.</summary>
public partial interface IApplicationDbContext
{
    DbSet<Courier> Couriers { get; }
    DbSet<OrderDelivery> OrderDeliveries { get; }
    DbSet<WaiterCall> WaiterCalls { get; }
}
