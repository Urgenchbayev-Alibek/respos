using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Staff;
using static Restaurant.Infrastructure.Persistence.Configurations.ConfigurationExtensions;

namespace Restaurant.Infrastructure.Persistence.Configurations;

internal sealed class TimeEntryConfiguration : IEntityTypeConfiguration<TimeEntry>
{
    public void Configure(EntityTypeBuilder<TimeEntry> builder)
    {
        builder.ToTable("time_entries");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.Note).HasMaxLength(ReasonLength);
        builder.Property(e => e.EditReason).HasMaxLength(ReasonLength);
        builder.HasIndex(e => new { e.BranchId, e.ClockInAt });
        builder.HasIndex(e => new { e.UserId, e.ClockInAt });

        // At most one open entry per user per organization (also across branches).
        builder.HasIndex(e => new { e.OrganizationId, e.UserId }).IsUnique().HasFilter("clock_out_at IS NULL")
            .HasDatabaseName("ix_time_entries_org_user_open");
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.EditedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ShiftScheduleConfiguration : IEntityTypeConfiguration<ShiftSchedule>
{
    public void Configure(EntityTypeBuilder<ShiftSchedule> builder)
    {
        builder.ToTable("shift_schedules");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.RoleNote).HasMaxLength(CodeLength);
        builder.Property(e => e.Note).HasMaxLength(ReasonLength);
        builder.HasIndex(e => new { e.BranchId, e.Date });
        builder.HasIndex(e => new { e.UserId, e.Date });
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class StaffDeviceConfiguration : IEntityTypeConfiguration<StaffDevice>
{
    public void Configure(EntityTypeBuilder<StaffDevice> builder)
    {
        builder.ToTable("staff_devices");
        builder.HasKey(e => e.Id);
        builder.HasBranch();
        builder.Property(e => e.Name).HasMaxLength(NameLength).IsRequired();
        builder.Property(e => e.TokenHash).HasMaxLength(128).IsRequired();
        builder.HasIndex(e => e.TokenHash).IsUnique();
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.RevokedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class StaffPinConfiguration : IEntityTypeConfiguration<StaffPin>
{
    public void Configure(EntityTypeBuilder<StaffPin> builder)
    {
        builder.ToTable("staff_pins");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.PinHash).HasMaxLength(512).IsRequired();
        builder.HasIndex(e => e.UserId).IsUnique();
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.UpdatedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class PinSessionConfiguration : IEntityTypeConfiguration<PinSession>
{
    public void Configure(EntityTypeBuilder<PinSession> builder)
    {
        builder.ToTable("pin_sessions");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.FamilyId).IsUnique();
        builder.HasIndex(e => e.DeviceId);
        builder.HasOne<StaffDevice>().WithMany().HasForeignKey(e => e.DeviceId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Organization>().WithMany().HasForeignKey(e => e.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<RestaurantBranch>().WithMany().HasForeignKey(e => e.BranchId).OnDelete(DeleteBehavior.Restrict);
    }
}
