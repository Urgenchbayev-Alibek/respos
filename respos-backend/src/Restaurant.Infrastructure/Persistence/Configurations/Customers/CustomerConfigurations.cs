using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Customers;
using Restaurant.Domain.Entities.Orders;
using static Restaurant.Infrastructure.Persistence.Configurations.ConfigurationExtensions;

namespace Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.Property(e => e.Phone).HasMaxLength(PhoneLength).IsRequired();
        builder.Property(e => e.Name).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.Notes).HasMaxLength(2000);
        builder.Property(e => e.Tags).HasColumnType("text[]");
        builder.HasIndex(e => new { e.OrganizationId, e.Phone }).IsUnique();
        builder.HasIndex(e => new { e.OrganizationId, e.BirthdayKey });
        builder.HasIndex(e => new { e.OrganizationId, e.CreatedAt });
        builder.Ignore(e => e.IsVip);
        builder.HasOne(e => e.LoyaltyAccount).WithOne()
            .HasForeignKey<LoyaltyAccount>(a => a.CustomerId).OnDelete(DeleteBehavior.Cascade);

        // orders.customer_id (F1) — configured here so the Orders module mapping stays untouched.
        builder.HasMany<Order>().WithOne()
            .HasForeignKey(o => o.CustomerId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class LoyaltySettingsConfiguration : IEntityTypeConfiguration<LoyaltySettings>
{
    public void Configure(EntityTypeBuilder<LoyaltySettings> builder)
    {
        builder.ToTable("loyalty_settings");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.HasIndex(e => e.OrganizationId).IsUnique();
    }
}

internal sealed class LoyaltyAccountConfiguration : IEntityTypeConfiguration<LoyaltyAccount>
{
    public void Configure(EntityTypeBuilder<LoyaltyAccount> builder)
    {
        builder.ToTable("loyalty_accounts");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.HasTenant();
        builder.HasIndex(e => e.CustomerId).IsUnique();
        builder.Property(e => e.RowVersion).IsRowVersion();
        builder.HasMany(e => e.Transactions).WithOne()
            .HasForeignKey(t => t.AccountId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class LoyaltyTransactionConfiguration : IEntityTypeConfiguration<LoyaltyTransaction>
{
    public void Configure(EntityTypeBuilder<LoyaltyTransaction> builder)
    {
        builder.ToTable("loyalty_transactions");
        builder.HasKey(e => e.Id);

        // Entries are added through LoyaltyAccount.Transactions: a client-set key must mean "new row".
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.HasTenant();
        builder.HasIndex(e => new { e.CustomerId, e.CreatedAt });
        builder.HasIndex(e => new { e.AccountId, e.RemainingPoints });

        // Earning is idempotent per order (one earn entry per order).
        builder.HasIndex(e => new { e.OrderId, e.Type }).IsUnique().HasFilter("order_id IS NOT NULL AND type = 'earn'");
        builder.HasOne<Order>().WithMany()
            .HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Restrict);
    }
}
