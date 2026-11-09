using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Audit;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Entities.Notifications;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Entities.Procurement;
using Restaurant.Domain.Entities.Recipes;
using Restaurant.Domain.Entities.Reservations;
using Restaurant.Domain.Entities.Saas;
using static Restaurant.Infrastructure.Persistence.Configurations.ConfigurationExtensions;

namespace Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class KitchenTicketConfiguration : IEntityTypeConfiguration<KitchenTicket>
{
    public void Configure(EntityTypeBuilder<KitchenTicket> builder)
    {
        builder.ToTable("kitchen_tickets");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.HasIndex(e => new { e.BranchId, e.Status, e.CreatedAt });
        builder.HasIndex(e => new { e.OrderId, e.KitchenStationId, e.Number });
        builder.HasOne<Order>().WithMany()
            .HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(e => e.KitchenStation).WithMany()
            .HasForeignKey(e => e.KitchenStationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.Items).WithOne(i => i.Ticket)
            .HasForeignKey(i => i.TicketId).OnDelete(DeleteBehavior.Cascade);
    }
}
