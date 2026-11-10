using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Staff;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Staff module DbSets (implements IApplicationDbContext.Staff.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
    public DbSet<ShiftSchedule> ShiftSchedules => Set<ShiftSchedule>();
    public DbSet<StaffDevice> StaffDevices => Set<StaffDevice>();
    public DbSet<StaffPin> StaffPins => Set<StaffPin>();
    public DbSet<PinSession> PinSessions => Set<PinSession>();
}
