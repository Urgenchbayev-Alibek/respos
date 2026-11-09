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

internal sealed class TableReservationConfiguration : IEntityTypeConfiguration<TableReservation>
{
    public void Configure(EntityTypeBuilder<TableReservation> builder)
    {
        builder.ToTable("table_reservations");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.GuestName).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.GuestPhone).HasMaxLength(PhoneLength).IsRequired();
        builder.Property(e => e.Comment).HasMaxLength(CommentLength);
        builder.Property(e => e.CancelReason).HasMaxLength(ReasonLength);
        builder.HasIndex(e => new { e.BranchId, e.StartsAt });
        builder.HasIndex(e => new { e.TableId, e.StartsAt });
        builder.HasOne<DiningTable>().WithMany()
            .HasForeignKey(e => e.TableId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<DiningArea>().WithMany()
            .HasForeignKey(e => e.PreferredAreaId).OnDelete(DeleteBehavior.Restrict);
    }
}
