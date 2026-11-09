using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Orders / kitchen tickets / payments / cash shifts DbSets.</summary>
public partial interface IApplicationDbContext
{
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<OrderItemModifier> OrderItemModifiers { get; }
    DbSet<OrderStatusHistory> OrderStatusHistory { get; }

    DbSet<KitchenTicket> KitchenTickets { get; }
    DbSet<KitchenTicketItem> KitchenTicketItems { get; }

    DbSet<CashShift> CashShifts { get; }
    DbSet<Payment> Payments { get; }
    DbSet<Refund> Refunds { get; }
}
