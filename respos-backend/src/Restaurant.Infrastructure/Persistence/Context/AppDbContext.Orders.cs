using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Orders module DbSets (implements IApplicationDbContext.Orders.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderItemModifier> OrderItemModifiers => Set<OrderItemModifier>();
    public DbSet<OrderStatusHistory> OrderStatusHistory => Set<OrderStatusHistory>();
    public DbSet<KitchenTicket> KitchenTickets => Set<KitchenTicket>();
    public DbSet<KitchenTicketItem> KitchenTicketItems => Set<KitchenTicketItem>();
    public DbSet<CashShift> CashShifts => Set<CashShift>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Refund> Refunds => Set<Refund>();
}
