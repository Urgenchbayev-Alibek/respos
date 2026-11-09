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

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_logs");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Action).HasMaxLength(100).IsRequired();
        builder.Property(e => e.EntityType).HasMaxLength(100).IsRequired();
        builder.Property(e => e.EntityId).HasMaxLength(CodeLength);
        builder.Property(e => e.CorrelationId).HasMaxLength(CodeLength);
        builder.Property(e => e.IpAddress).HasMaxLength(CodeLength);
        builder.Property(e => e.ChangesJson).HasColumnType("jsonb");
        builder.HasIndex(e => new { e.OrganizationId, e.CreatedAt });
        builder.HasIndex(e => new { e.EntityType, e.EntityId });
        builder.HasIndex(e => e.Action);
    }
}
