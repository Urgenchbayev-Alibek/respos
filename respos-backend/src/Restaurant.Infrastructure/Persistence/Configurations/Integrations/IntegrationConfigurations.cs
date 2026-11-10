using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Integrations;
using Restaurant.Infrastructure.Integrations.DataProtection;
using static Restaurant.Infrastructure.Persistence.Configurations.ConfigurationExtensions;

namespace Restaurant.Infrastructure.Persistence.Configurations.Integrations;

internal sealed class IntegrationSettingConfiguration : IEntityTypeConfiguration<IntegrationSetting>
{
    public void Configure(EntityTypeBuilder<IntegrationSetting> builder)
    {
        builder.ToTable("integration_settings");
        builder.HasKey(e => e.Id);
        builder.HasTenant();
        builder.HasIndex(e => new { e.OrganizationId, e.Type }).IsUnique();
        builder.Property(e => e.ProtectedConfig).HasMaxLength(16_000);
        builder.Property(e => e.LastError).HasMaxLength(IntegrationSetting.LastErrorMaxLength);
    }
}

internal sealed class OutboundMessageConfiguration : IEntityTypeConfiguration<OutboundMessage>
{
    public void Configure(EntityTypeBuilder<OutboundMessage> builder)
    {
        builder.ToTable("outbound_messages");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Kind).HasMaxLength(CodeLength).IsRequired();
        builder.Property(e => e.RecipientMasked).HasMaxLength(EmailLength).IsRequired();
        builder.Property(e => e.Summary).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.ProtectedPayload).HasMaxLength(64_000).IsRequired();
        builder.Property(e => e.DedupeKey).HasMaxLength(300);
        builder.Property(e => e.LastError).HasMaxLength(OutboundMessage.ErrorMaxLength);
        builder.HasIndex(e => e.DedupeKey).IsUnique().HasFilter("dedupe_key IS NOT NULL");
        builder.HasIndex(e => new { e.Status, e.NextAttemptAt });
        builder.HasIndex(e => new { e.OrganizationId, e.CreatedAt });
        builder.HasOne<Organization>().WithMany().HasForeignKey(e => e.OrganizationId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class IntegrationErrorLogConfiguration : IEntityTypeConfiguration<IntegrationErrorLog>
{
    public void Configure(EntityTypeBuilder<IntegrationErrorLog> builder)
    {
        builder.ToTable("integration_error_logs");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Operation).HasMaxLength(CodeLength).IsRequired();
        builder.Property(e => e.Message).HasMaxLength(IntegrationErrorLog.MessageMaxLength).IsRequired();
        builder.HasIndex(e => new { e.OrganizationId, e.CreatedAt });
        builder.HasIndex(e => e.CreatedAt);
        builder.HasOne<Organization>().WithMany().HasForeignKey(e => e.OrganizationId).OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>Data Protection key ring table (read/written by <see cref="PostgresXmlRepository"/>, created by migrations).</summary>
internal sealed class DataProtectionKeyRecordConfiguration : IEntityTypeConfiguration<DataProtectionKeyRecord>
{
    public void Configure(EntityTypeBuilder<DataProtectionKeyRecord> builder)
    {
        builder.ToTable(PostgresXmlRepository.TableName);
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).UseIdentityAlwaysColumn();
        builder.Property(e => e.FriendlyName).HasMaxLength(NameLength);
        builder.Property(e => e.Xml).IsRequired();
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
    }
}
