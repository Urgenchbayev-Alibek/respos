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

internal sealed class UserInvitationConfiguration : IEntityTypeConfiguration<UserInvitation>
{
    public void Configure(EntityTypeBuilder<UserInvitation> builder)
    {
        builder.ToTable("user_invitations");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.Property(e => e.Email).HasMaxLength(EmailLength).IsRequired();
        builder.Property(e => e.TokenHash).HasMaxLength(128).IsRequired();
        builder.HasIndex(e => e.TokenHash).IsUnique();
        builder.Property(e => e.RoleIds).HasColumnType("uuid[]");
        builder.Property(e => e.BranchIds).HasColumnType("uuid[]");
        builder.HasOne<User>().WithMany()
            .HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
